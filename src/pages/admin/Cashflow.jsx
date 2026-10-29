import { useState, useMemo, useEffect } from 'react';
import { useFirestoreCollection, orderBy, addDocument, deleteDocument, updateDocument } from '../../hooks/useFirestore';
import { db } from '../../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { formatRupiah } from '../../lib/utils';
import { formatDate } from '../../utils/formatDate';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { X, Trash2 } from 'lucide-react';
import '../../styles/admin.css';
import { useSiteSettings } from '../../hooks/useSiteSettings';

export default function Cashflow() {
  const { settings } = useSiteSettings();
  const { data: transactions, loading } = useFirestoreCollection('transactions', [
    orderBy('createdAt', 'desc')
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);

  const { data: cashflowCategories } = useFirestoreCollection('cashflowCategories', [orderBy('createdAt', 'desc')]);

  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('INCOME');
  const [managingCategory, setManagingCategory] = useState(false);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      setManagingCategory(true);
      await addDocument('cashflowCategories', {
        name: newCategoryName.toUpperCase(),
        type: newCategoryType,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
    } catch (err) {
      console.error(err);
      alert('Failed to add category');
    } finally {
      setManagingCategory(false);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingTx, setIsEditingTx] = useState(false);
  const [addForm, setAddForm] = useState({
    type: 'INCOME',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const [adding, setAdding] = useState(false);

  const openAddModal = () => {
    const defaultType = 'INCOME';
    const defaultCat = cashflowCategories?.find(c => c.type === defaultType)?.name || '';
    setAddForm({
      type: defaultType,
      category: defaultCat,
      amount: '',
      description: '',
      date: new Date().toISOString().slice(0, 10)
    });
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.amount || !addForm.description || !addForm.date) return;
    try {
      setAdding(true);
      const amt = parseInt(addForm.amount.toString().replace(/\D/g, ''), 10) || 0;
      await addDocument('transactions', {
        type: addForm.type,
        category: addForm.category,
        amount: amt,
        description: addForm.description,
        date: addForm.date,
        createdAt: new Date().toISOString(),
        manual: true
      });
      setShowAddModal(false);
      setAddForm({ type: addForm.type, category: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      console.error(err);
      alert('Failed to add cashflow');
    } finally {
      setAdding(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.amount || !addForm.description || !addForm.date) return;
    try {
      setAdding(true);
      const amt = typeof addForm.amount === 'string' ? parseInt(addForm.amount.replace(/\D/g, ''), 10) : addForm.amount;
      await updateDocument('transactions', selectedTransaction.id, {
        type: addForm.type,
        category: addForm.category,
        amount: amt || 0,
        description: addForm.description,
        date: addForm.date,
      });
      setIsEditingTx(false);
      setSelectedTransaction({ ...selectedTransaction, ...addForm, amount: amt || 0 });
    } catch (err) {
      console.error(err);
      alert('Failed to update cashflow');
    } finally {
      setAdding(false);
    }
  };

  // G2: Auto-cleanup Legacy transactions
  useEffect(() => {
    document.title = `Cashflow — ${settings?.brandName || ''}`;
  }, [settings]);

  useEffect(() => {
    if (transactions) {
      const legacy = transactions.filter(t => t.description?.includes('(Legacy)'));
      legacy.forEach(async (t) => {
        try {
          await deleteDocument('transactions', t.id);
        } catch (e) {
          console.error('Failed to delete legacy transaction:', e);
        }
      });
    }
  }, [transactions]);

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDocument('transactions', id);
      setSelectedTransaction(null);
      setConfirmDeleteTx(null);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Failed to delete transaction.");
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    return transactions.filter(t => {
      // 1. Search filter
      const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Category filter
      const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;

      // 3. Date filter
      let matchesDate = true;
      if (startDate || endDate) {
        const tDate = new Date(t.date || t.createdAt); // use t.date if available, else createdAt
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          if (tDate < sDate) matchesDate = false;
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          if (tDate > eDate) matchesDate = false;
        }
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [transactions, searchTerm, filterCategory, startDate, endDate]);

  // Auto-migrate legacy hardcoded categories
  useEffect(() => {
    if (!transactions) return;
    const legacyCategories = ['FIXED_COST', 'VARIABLE_COST', 'PEMBAYARAN'];
    const legacyTransactions = transactions.filter(t => legacyCategories.includes(t.category));

    if (legacyTransactions.length > 0) {
      console.log(`Found ${legacyTransactions.length} legacy transactions. Migrating...`);
      legacyTransactions.forEach(async (t) => {
        let newCategory = t.category;
        if (newCategory === 'FIXED_COST') newCategory = 'FIXED COST';
        else if (newCategory === 'VARIABLE_COST') newCategory = 'VARIABLE COST';
        else if (newCategory === 'PEMBAYARAN') newCategory = 'PAYMENT';

        try {
          await updateDoc(doc(db, 'transactions', t.id), { category: newCategory });
        } catch (e) {
          console.error("Migration error:", e);
        }
      });
    }

    // Force update legacy PAYMENT transactions to use input date
    const legacyPaymentTransactions = transactions.filter(t => t.category === 'PAYMENT' && t.type === 'INCOME');
    if (legacyPaymentTransactions.length > 0) {
      legacyPaymentTransactions.forEach(async (t) => {
        if (!t.createdAt) return;
        const inputDate = t.createdAt?.toDate ? t.createdAt.toDate().toISOString().slice(0, 10) : t.createdAt.slice(0, 10);
        if (t.date !== inputDate) {
          try {
            await updateDoc(doc(db, 'transactions', t.id), { date: inputDate });
          } catch (e) {
            console.error("Migration error:", e);
          }
        }
      });
    }

    // Force restore eventDate for transactions that have a bookingId but no eventDate
    const missingEventDateTx = transactions.filter(t => t.bookingId && !t.eventDate);
    if (missingEventDateTx.length > 0) {
      missingEventDateTx.forEach(async (t) => {
        try {
          const bDoc = await getDoc(doc(db, 'bookings', t.bookingId));
          if (bDoc.exists() && bDoc.data().eventDate) {
            await updateDoc(doc(db, 'transactions', t.id), { eventDate: bDoc.data().eventDate });
          }
        } catch (e) {
          console.error("Migration error fetching booking:", e);
        }
      });
    }

  }, [transactions]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'INCOME') {
        income += t.amount;
      } else if (t.type === 'EXPENSE') {
        expense += t.amount;
      }
    });

    return {
      income,
      expense,
      net: income - expense
    };
  }, [filteredTransactions]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Cashflow</h1>
          <p className="admin-header__subtitle">Income and Expense Report</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="admin-btn admin-btn--secondary" onClick={() => setShowManageCategories(true)}>
            Manage Categories
          </button>
          <button className="admin-btn admin-btn--primary" onClick={openAddModal}>
            + Add Cashflow
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat__label">Total Income</div>
          <div className="admin-stat__value" style={{ color: 'var(--color-success)' }}>
            {formatRupiah(summary.income)}
          </div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__label">Total Expense</div>
          <div className="admin-stat__value" style={{ color: 'var(--color-danger)' }}>
            {formatRupiah(summary.expense)}
          </div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__label">Net Cashflow</div>
          <div className="admin-stat__value" style={{ color: summary.net >= 0 ? '#fff' : 'var(--color-danger)' }}>
            {formatRupiah(summary.net)}
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="form-input admin-search-input"
              placeholder="Cari deskripsi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Category</label>
            <select
              className="form-input admin-search-input"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">Semua Kategori</option>
              <option value="PAYMENT">Payment (Income)</option>
              <option value="FIXED COST">Fixed Cost (Expense)</option>
              <option value="VARIABLE COST">Variable Cost (Expense)</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input admin-search-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input admin-search-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="admin-card">
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Tidak ada transaksi yang sesuai.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-card hide-on-mobile">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTransaction(t)}
                      className="admin-table-row-clickable"
                    >
                      <td>{t.date ? t.date : formatDate(t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt)}</td>
                      <td style={{ fontWeight: '500' }}>{t.description?.replace(' (Legacy)', '')}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{t.category}</span>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge--${t.type === 'INCOME' ? 'success' : 'danger'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ color: t.type === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {t.type === 'INCOME' ? '+' : '-'}{formatRupiah(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-card-list">
            {filteredTransactions.map((t) => (
              <div key={t.id} className="mobile-card" onClick={() => setSelectedTransaction(t)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {t.date ? t.date : formatDate(t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: '#888' }}>
                    <span className={`admin-badge admin-badge--${t.type === 'INCOME' ? 'success' : 'danger'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                      {t.type}
                    </span>
                    <span>|</span>
                    <span>{t.category}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: t.type === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {t.type === 'INCOME' ? '+' : '-'}{formatRupiah(t.amount)}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#FFF' }}>
                      {t.description?.replace(' (Legacy)', '')}
                    </div>
                  </div>
                  <div>
                    {/* Action indicator (clickable) */}
                    <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={(e) => { e.stopPropagation(); setConfirmDeleteTx(t.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="admin-modal-overlay" onClick={() => { setSelectedTransaction(null); setIsEditingTx(false); }} style={{ zIndex: 11000 }}>
          <div className="admin-modal admin-modal--md" onClick={e => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Transaction Details</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isEditingTx && (
                  <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => {
                    setIsEditingTx(true);
                    setAddForm({
                      type: selectedTransaction.type,
                      category: selectedTransaction.category,
                      amount: selectedTransaction.amount.toString(),
                      description: selectedTransaction.description,
                      date: selectedTransaction.date || (selectedTransaction.createdAt?.toDate ? selectedTransaction.createdAt.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
                    });
                  }}>
                    EDIT
                  </button>
                )}
                <button className="admin-modal__close" onClick={() => { setSelectedTransaction(null); setIsEditingTx(false); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            {isEditingTx ? (
              <div className="admin-modal__body">
                <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-input" value={addForm.type} onChange={e => {
                      const newType = e.target.value;
                      const defaultCat = cashflowCategories?.find(c => c.type === newType)?.name || '';
                      setAddForm({ ...addForm, type: newType, category: defaultCat });
                    }}>
                      <option value="INCOME">Pemasukan (Income)</option>
                      <option value="EXPENSE">Pengeluaran (Expense)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select className="form-input" value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })} required>
                      <option value="" disabled>Pilih Kategori</option>
                      {cashflowCategories?.filter(c => c.type === addForm.type).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deskripsi</label>
                    <input type="text" className="form-input" value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} required placeholder="Contoh: Beli Hardisk" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nominal (Rp)</label>
                    <input type="text" className="form-input" value={addForm.amount} onChange={e => setAddForm({ ...addForm, amount: e.target.value })} required placeholder="Contoh: 1500000" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tanggal</label>
                    <input type="date" className="form-input" value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} required />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setIsEditingTx(false)}>Batal</button>
                    <button type="submit" className="admin-btn admin-btn--primary" disabled={adding}>{adding ? 'Menyimpan...' : 'Simpan'}</button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="admin-modal__body" style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Amount & Description Header */}
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Total Nominal</div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: '800',
                      lineHeight: 1,
                      color: selectedTransaction.type === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)',
                      textShadow: selectedTransaction.type === 'INCOME' ? '0 0 20px rgba(74, 222, 128, 0.2)' : '0 0 20px rgba(248, 113, 113, 0.2)',
                      marginBottom: '1rem'
                    }}>
                      {selectedTransaction.type === 'INCOME' ? '+' : '-'}{formatRupiah(selectedTransaction.amount)}
                    </div>
                    <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: '500', lineHeight: 1.4 }}>
                      {selectedTransaction.description}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1.5rem',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Category</div>
                      <div style={{ fontSize: '0.95rem', color: '#E0E0E0', fontWeight: '500' }}>{selectedTransaction.category}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Type</div>
                      <div>
                        <span className={`admin-badge admin-badge--${selectedTransaction.type === 'INCOME' ? 'success' : 'danger'}`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>
                          {selectedTransaction.type}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Input Date</div>
                      <div style={{ fontSize: '0.95rem', color: '#E0E0E0' }}>
                        {selectedTransaction.createdAt ? (selectedTransaction.createdAt?.toDate ? selectedTransaction.createdAt.toDate().toISOString().slice(0, 10).replace(/-/g, '/') : selectedTransaction.createdAt.slice(0, 10).replace(/-/g, '/')) : '-'}
                      </div>
                    </div>
                    {selectedTransaction.eventDate && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Event Date</div>
                        <div style={{ fontSize: '0.95rem', color: '#E0E0E0' }}>
                          {selectedTransaction.eventDate.replace(/-/g, '/')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Extra Info */}
                  {(selectedTransaction.bookingId || selectedTransaction.paymentProofUrl) && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      {selectedTransaction.bookingId && (
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Associated Booking ID</div>
                          <div style={{ fontSize: '0.85rem', color: '#888', fontFamily: 'monospace' }}>{selectedTransaction.bookingId}</div>
                        </div>
                      )}
                      {selectedTransaction.paymentProofUrl && (
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Payment Proof</div>
                          <a href={selectedTransaction.paymentProofUrl} target="_blank" rel="noreferrer" className="admin-glass-btn" style={{ textDecoration: 'none', width: '100%', marginTop: '0.5rem' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                            View Attachment
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="admin-modal__footer" style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.2)',
                  borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <button
                    className="admin-btn admin-btn--danger"
                    onClick={() => setConfirmDeleteTx(selectedTransaction.id)}
                    style={{ background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', boxShadow: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-danger)'; }}
                  >
                    <Trash2 size={16} style={{ marginRight: '0.4rem' }} /> Delete
                  </button>
                  <button className="admin-btn admin-btn--secondary" onClick={() => { setSelectedTransaction(null); setIsEditingTx(false); }}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal admin-modal--md" onClick={e => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Tambah Cashflow Manual</h3>
              <button className="admin-modal__close" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal__body">
              <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={addForm.type} onChange={e => {
                    const newType = e.target.value;
                    const defaultCat = cashflowCategories?.find(c => c.type === newType)?.name || '';
                    setAddForm({ ...addForm, type: newType, category: defaultCat });
                  }}>
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })} required>
                    <option value="" disabled>Select Category</option>
                    {cashflowCategories?.filter(c => c.type === addForm.type).map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} required placeholder="Example: Bought a Hardisk" />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (Rp)</label>
                  <input type="text" className="form-input" value={addForm.amount} onChange={e => setAddForm({ ...addForm, amount: e.target.value })} required placeholder="Example: 1500000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} required />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setShowAddModal(false)}>Batal</button>
                  <button type="submit" className="admin-btn admin-btn--primary" disabled={adding}>{adding ? 'Menyimpan...' : 'Simpan'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {showManageCategories && (
        <div className="admin-modal-overlay" onClick={() => setShowManageCategories(false)}>
          <div className="admin-modal admin-modal--md" onClick={e => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Manage Cashflow Categories</h3>
              <button className="admin-modal__close" onClick={() => setShowManageCategories(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                  <div style={{ marginBottom: 0 }} className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-input" value={newCategoryType} onChange={e => setNewCategoryType(e.target.value)}>
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 0 }} className="form-group">
                    <label className="form-label">Category Name</label>
                    <input type="text" className="form-input" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required placeholder="Ex: Photographer Fee" />
                  </div>
                </div>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={managingCategory} style={{ width: '100%', padding: '0.7rem 1rem' }}>
                  {managingCategory ? 'Adding...' : 'Add Category'}
                </button>
              </form>

              <div>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#888' }}>Existing Categories</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cashflowCategories?.length === 0 && <p style={{ fontSize: '0.8rem', color: '#555' }}>Belum ada kategori.</p>}
                  {cashflowCategories?.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', transition: 'background 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: cat.type === 'INCOME' ? '#4ade80' : '#f87171',
                          boxShadow: cat.type === 'INCOME' ? '0 0 8px rgba(74,222,128,0.4)' : '0 0 8px rgba(248,113,113,0.4)',
                          flexShrink: 0
                        }} />
                        <span style={{ fontSize: '0.85rem', color: '#eee', fontWeight: 500 }}>{cat.name}</span>
                        <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.type}</span>
                      </div>
                      <button
                        className="admin-btn admin-btn--sm"
                        onClick={() => setConfirmDeleteCat(cat.id)}
                        style={{ background: 'transparent', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.35rem 0.75rem', fontSize: '0.65rem', borderRadius: '20px' }}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modals */}
      <ConfirmModal
        isOpen={!!confirmDeleteTx}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={() => handleDeleteTransaction(confirmDeleteTx)}
        onCancel={() => setConfirmDeleteTx(null)}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteCat}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
        onConfirm={async () => {
          try {
            await deleteDocument('cashflowCategories', confirmDeleteCat);
            setConfirmDeleteCat(null);
          } catch (e) {
            alert('Failed to delete');
          }
        }}
        onCancel={() => setConfirmDeleteCat(null)}
      />

    </div>
  );
}
