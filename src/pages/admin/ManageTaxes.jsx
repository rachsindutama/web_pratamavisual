import { useState, useMemo, useRef, useEffect } from 'react';
import { useFirestoreCollection, orderBy, addDocument, updateDocument } from '../../hooks/useFirestore';
import { useStorage } from '../../hooks/useStorage';
import { formatRupiah } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Filter, X, CheckCircle } from 'lucide-react';
import '../../styles/admin.css';
import { useSiteSettings } from '../../hooks/useSiteSettings';

export default function ManageTaxes() {
  const { data: bookings, loading } = useFirestoreCollection('bookings', [
    orderBy('createdAt', 'desc')
  ]);
  const { settings } = useSiteSettings();
  const [filterMonth, setFilterMonth] = useState(-1);
  const [filterYear, setFilterYear] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const { uploadFile, uploading, progress } = useStorage();
  const fileInputRef = useRef(null);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    document.title = `Pajak PPh — ${settings?.brandName || ''}`;
  }, [settings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.eventDate) {
        const d = new Date(b.eventDate);
        const matchMonth = filterMonth === -1 || d.getMonth() === filterMonth;
        const matchYear = filterYear === 'all' || d.getFullYear() === filterYear;
        if (!matchMonth || !matchYear) {
          return false;
        }
      } else {
        return false;
      }
      return true;
    });
  }, [bookings, filterMonth, filterYear]);

  // Determine PPh paid status per booking using pphPaid field
  const getIsPphPaid = (b) => {
    return b.pphPaid === true;
  };

  const totalPph = filteredBookings.reduce((sum, b) => sum + (b.pphAmount || 0), 0);
  const pphPaid = filteredBookings.reduce((sum, b) => getIsPphPaid(b) ? sum + (b.pphAmount || 0) : sum, 0);
  const pphUnpaid = totalPph - pphPaid;

  // All unpaid bookings can be selected
  const selectableBookings = filteredBookings.filter(b => !getIsPphPaid(b));

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === selectableBookings.length && selectableBookings.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableBookings.map(b => b.id));
    }
  };

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedIds([]);
    }
    setIsSelectMode(!isSelectMode);
  };

  const selectedBookingsData = filteredBookings.filter(b => selectedIds.includes(b.id));
  const totalSelectedPph = selectedBookingsData.reduce((sum, b) => sum + (b.pphAmount || 0), 0);

  const getDefaultCatatan = () => {
    if (selectedBookingsData.length === 0) return 'Pembayaran PPh';
    
    const sortedDates = selectedBookingsData
      .map(b => new Date(b.eventDate))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a - b);
      
    if (sortedDates.length === 0) return 'Pembayaran PPh';

    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    const firstStr = `${months[firstDate.getMonth()]} ${firstDate.getFullYear()}`;
    const lastStr = `${months[lastDate.getMonth()]} ${lastDate.getFullYear()}`;

    if (firstStr === lastStr) {
      return `Pembayaran PPh ${firstStr}`;
    }
    
    return `Pembayaran PPh ${firstStr} - ${lastStr}`;
  };

  const openConfirmModal = () => {
    setCatatan(getDefaultCatatan());
    setShowConfirmModal(true);
  };

  const handleBayarPph = async () => {
    if (selectedIds.length === 0) return;
    try {
      setPaying(true);

      let uploadedProofUrl = null;
      if (proofFile) {
        uploadedProofUrl = await uploadFile(proofFile, `pph-proofs/${Date.now()}_${proofFile.name}`);
      }

      // 1. Mark each selected booking as pphPaid = true
      for (const id of selectedIds) {
        await updateDocument('bookings', id, { pphPaid: true });
      }

      // 2. Create a cashflow transaction (EXPENSE type) only if total > 0
      if (totalSelectedPph > 0) {
        await addDocument('transactions', {
          type: 'EXPENSE',
          category: 'PAJAK PPH',
          amount: totalSelectedPph,
          description: catatan || getDefaultCatatan(),
          date: new Date().toISOString().slice(0, 10),
          paymentProofUrl: uploadedProofUrl,
          createdAt: new Date().toISOString(),
          manual: true
        });
      }

      setSelectedIds([]);
      setIsSelectMode(false);
      setShowConfirmModal(false);
      setCatatan('');
      setProofFile(null);
    } catch (err) {
      console.error('Error paying PPh:', err);
      alert('Gagal memproses pembayaran PPh. Silakan coba lagi.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Manajemen Pajak PPh</h1>
          <p className="admin-header__subtitle">Beranda {'>'} Keuangan {'>'} Pajak PPh</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="pph-filter-row">
          <div className="pph-filter-label">
            <Filter size={18} />
            <span style={{ fontWeight: 500 }}>Filter:</span>
          </div>
          <select
            className="form-input admin-search-input pph-filter-month"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(parseInt(e.target.value)); setSelectedIds([]); }}
          >
            <option value="-1">All Months</option>
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            className="form-input admin-search-input pph-filter-year"
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value)); setSelectedIds([]); }}
          >
            <option value="all">All Years</option>
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
          <button 
            className={`admin-btn pph-filter-btn ${isSelectMode ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            onClick={toggleSelectMode}
            style={{ padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={isSelectMode ? 'Batal Pilih' : 'Pilih Transaksi'}
          >
            <CheckCircle size={18} />
          </button>
        </div>
      </div>

      <div className="pph-stats-grid">
        <div className="pph-stat-card">
          <p className="pph-stat-card__label">Total PPh Bulan Ini</p>
          <p className="pph-stat-card__value">{formatRupiah(totalPph)}</p>
        </div>
        <div className="pph-stat-card">
          <p className="pph-stat-card__label">PPh Sudah Dibayar</p>
          <p className="pph-stat-card__value pph-stat-card__value--success">{formatRupiah(pphPaid)}</p>
        </div>
        <div className="pph-stat-card">
          <p className="pph-stat-card__label">PPh Belum Dibayar</p>
          <p className="pph-stat-card__value pph-stat-card__value--danger">{formatRupiah(pphUnpaid)}</p>
        </div>
      </div>

      <div className="admin-card hide-on-mobile">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                {isSelectMode && (
                  <th style={{ width: '80px' }}>
                    <input
                      type="checkbox"
                      checked={selectableBookings.length > 0 && selectedIds.length === selectableBookings.length}
                      onChange={toggleSelectAll}
                      disabled={selectableBookings.length === 0}
                      style={{ cursor: 'pointer', width: '12px', height: '12px', accentColor: 'var(--color-accent)' }}
                    />
                  </th>
                )}
                <th>TANGGAL EVENT</th>
                <th>KLIEN</th>
                <th>EMAIL</th>
                <th>TOTAL TRANSAKSI</th>
                <th>PPH</th>
                <th>STATUS PPH</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    Tidak ada data pajak PPh untuk periode ini.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(b => {
                  const isPaid = getIsPphPaid(b);
                  const isSelected = selectedIds.includes(b.id);

                  return (
                    <tr
                      key={b.id}
                      style={{
                        background: isSelected ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                        transition: 'background 0.2s',
                        cursor: isSelectMode && !isPaid ? 'pointer' : 'default'
                      }}
                      onClick={() => isSelectMode && !isPaid && toggleSelect(b.id)}
                    >
                      {isSelectMode && (
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected || isPaid}
                            onChange={() => !isPaid && toggleSelect(b.id)}
                            disabled={isPaid}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              cursor: isPaid ? 'not-allowed' : 'pointer',
                              width: '12px',
                              height: '12px',
                              accentColor: isPaid ? 'gray' : 'var(--color-accent)',
                              opacity: isPaid ? 0.4 : 1
                            }}
                          />
                        </td>
                      )}
                      <td>{b.eventDate}</td>
                      <td style={{ fontWeight: 500, color: 'var(--color-accent)' }}>{b.fullName}</td>
                      <td>{b.email}</td>
                      <td>{formatRupiah(b.packagePrice)}</td>
                      <td style={{ fontWeight: 'bold', color: '#EF4444' }}>
                        {formatRupiah(b.pphAmount || 0)}
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem', fontWeight: 'normal' }}>({b.pphPercentage || 0}%)</span>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge--${isPaid ? 'success' : 'warning'}`}>
                          {isPaid ? 'PAID' : 'UNPAID'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mobile-card-list">
        {filteredBookings.length === 0 ? (
          <div className="admin-card">
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              Tidak ada data pajak PPh untuk periode ini.
            </p>
          </div>
        ) : (
          filteredBookings.map(b => {
            const isPaid = getIsPphPaid(b);
            const isSelected = selectedIds.includes(b.id);
            return (
              <div key={b.id} className="mobile-card" style={{ padding: '1rem', background: isSelected ? 'rgba(212, 175, 55, 0.08)' : 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)', border: isSelected ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: isSelectMode && !isPaid ? 'pointer' : 'default' }} onClick={() => isSelectMode && !isPaid && toggleSelect(b.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    {isSelectMode && (
                      <div style={{ marginTop: '0.15rem', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={isSelected || isPaid}
                          onChange={() => !isPaid && toggleSelect(b.id)}
                          disabled={isPaid}
                          onClick={e => e.stopPropagation()}
                          style={{
                            cursor: isPaid ? 'not-allowed' : 'pointer',
                            width: '16px',
                            height: '16px',
                            accentColor: isPaid ? 'gray' : 'var(--color-accent)',
                            opacity: isPaid ? 0.4 : 1
                          }}
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, width: '100%' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.fullName}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.email}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{b.eventDate}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', flexShrink: 0, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)', fontSize: '0.95rem' }}>
                      {formatRupiah(b.packagePrice)}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 500 }}>
                      PPh {formatRupiah(b.pphAmount || 0)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span className={`admin-badge admin-badge--${isPaid ? 'success' : 'warning'}`} style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>
                    {isPaid ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Bar */}
      {selectedIds.length > 0 && (
        <div className="pph-floating-bar">
          <div className="pph-floating-bar__info">
            <div className="pph-floating-bar__label">
              PPh terpilih ({selectedIds.length} transaksi)
            </div>
            <div className="pph-floating-bar__amount">
              {formatRupiah(totalSelectedPph)}
            </div>
          </div>
          <button
            className="admin-btn admin-btn--primary"
            onClick={openConfirmModal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
          >
            <CheckCircle size={16} />
            <span className="hide-on-mobile">Bayar PPh Terpilih</span>
            <span className="hide-on-desktop">Bayar</span>
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="admin-modal-overlay" onClick={() => setShowConfirmModal(false)} style={{ zIndex: 11000 }}>
          <div className="admin-modal admin-modal--md" onClick={e => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Konfirmasi Pembayaran PPh</h3>
              <button className="admin-modal__close" onClick={() => setShowConfirmModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Total Pembayaran PPh</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                  {formatRupiah(totalSelectedPph)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Dari {selectedIds.length} transaksi terpilih
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Catatan Tambahan (Opsional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Tambahkan catatan jika diperlukan..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Lampiran Bukti Pembayaran</label>
                <div 
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: '8px',
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setProofFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setProofFile(e.target.files[0]);
                      }
                    }}
                  />
                  <div style={{ color: 'var(--color-accent)', marginBottom: '0.5rem' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    Klik atau seret file ke sini untuk mengunggah
                  </div>
                  {proofFile && (
                    <div style={{ display: 'inline-block', background: 'rgba(212, 175, 55, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--color-accent)', fontWeight: 500 }}>
                      {proofFile.name}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.5rem' }}>
                    Format: JPG, PNG, PDF (Opsional)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  className="admin-btn admin-btn--secondary"
                  onClick={() => { setShowConfirmModal(false); setProofFile(null); }}
                  disabled={paying || uploading}
                >
                  Batal
                </button>
                <button
                  className="admin-btn admin-btn--primary"
                  onClick={handleBayarPph}
                  disabled={paying || uploading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <CheckCircle size={16} />
                  {uploading ? `Mengunggah... ${progress}%` : paying ? 'Memproses...' : 'Konfirmasi Pembayaran'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
