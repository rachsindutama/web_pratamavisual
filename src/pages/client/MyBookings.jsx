import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFirestoreCollection, orderBy, updateDocument } from '../../hooks/useFirestore';
import { useStorage } from '../../hooks/useStorage';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { formatRupiah } from '../../lib/utils';
import { formatDate as formatPrettyDate } from '../../utils/formatDate';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import InvoicePreview from '../../components/ui/InvoicePreview';
import { Eye, X, Printer, ChevronDown } from 'lucide-react';
import '../../styles/admin.css';

// Removed MapContainer, TileLayer, Marker
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { User, Mail, Phone, Calendar, MapPin } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});


export default function MyBookings() {
  const { user } = useAuth();
  const { uploadFile, uploading } = useStorage();
  const { settings } = useSiteSettings();
  const [selectedBooking, setSelectedBooking] = useState(null); // For pelunasan
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState(null);
  const [selectedDetailsBooking, setSelectedDetailsBooking] = useState(null);
  const [finalPaymentFile, setFinalPaymentFile] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentNote, setPaymentNote] = useState('Pelunasan');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [expandedPkgId, setExpandedPkgId] = useState(null);

  useEffect(() => {
    document.title = `My Bookings — ${settings?.brandName || ''}`;
  }, [settings]);

  const handleOpenDetails = async (booking) => {
    setSelectedDetailsBooking(booking);
    if (booking.hasClientUnreadUpdates) {
      try {
        await updateDocument('bookings', booking.id, { hasClientUnreadUpdates: false });
      } catch (err) {
        console.error('Failed to clear client unread badge:', err);
      }
    }
  };

  const getDisplayEstimatedDate = (booking) => {
    try {
      if (booking.estimatedCompletionDate) return booking.estimatedCompletionDate;
      const days = settings?.defaultEstimatedDays ? parseInt(settings.defaultEstimatedDays) : 30;
      if (booking.eventDate && !isNaN(days)) {
        let eventDateStr = booking.eventDate;
        if (typeof eventDateStr === 'string' && eventDateStr.includes(' ') && !eventDateStr.includes('T')) {
          eventDateStr = eventDateStr.replace(' ', 'T');
        }
        let eventDateObj = new Date(eventDateStr);
        if (booking.eventDate && typeof booking.eventDate.toDate === 'function') {
          eventDateObj = booking.eventDate.toDate();
        }
        if (isNaN(eventDateObj.getTime())) return null;
        eventDateObj.setDate(eventDateObj.getDate() + days);
        return eventDateObj.toISOString().split('T')[0];
      }
    } catch (err) {
      console.error("Error calculating estimated date:", err);
    }
    return null;
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch only bookings for the current user
  const { data: bookings, loading } = useFirestoreCollection('bookings', [
    orderBy('createdAt', 'desc')
  ]);

  const userBookings = bookings
    .filter(b => b.userId === user?.uid)
    .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFinalPaymentFile(e.target.files[0]);
    }
  };

  const handleUploadFinalPayment = async (e) => {
    e.preventDefault();
    if (!finalPaymentFile || !selectedBooking) return;

    try {
      setError('');
      const amountToPay = parseInt(String(paymentAmountInput).replace(/\D/g, ''), 10) || 0;
      if (amountToPay <= 0) {
        setError('Please enter a valid amount.');
        return;
      }

      const totalPaid = selectedBooking.payments
        ? selectedBooking.payments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0)
        : (selectedBooking.status === 'approved' ? (selectedBooking.paymentAmount || 0) : 0);
      const piutang = selectedBooking.packagePrice ? Math.max(0, selectedBooking.packagePrice - totalPaid) : 0;

      if (amountToPay > piutang) {
        setError(`Nominal tidak boleh melebihi kekurangan bayar (Maks. ${formatRupiah(piutang)}).`);
        return;
      }

      const timestamp = Date.now();
      const filePath = `bookings/payment_proofs/${user.uid}_${timestamp}_payment_${finalPaymentFile.name}`;
      const proofUrl = await uploadFile(finalPaymentFile, filePath);

      const newPayment = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        amount: amountToPay,
        proofUrl,
        status: 'pending',
        createdAt: new Date().toISOString(),
        note: paymentNote
      };

      const updatedPayments = selectedBooking.payments ? [...selectedBooking.payments, newPayment] : [
        {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2),
          amount: selectedBooking.paymentAmount || 0,
          proofUrl: selectedBooking.paymentProofUrl || '',
          status: 'approved',
          createdAt: selectedBooking.createdAt?.toDate ? selectedBooking.createdAt.toDate().toISOString() : new Date().toISOString(),
          note: 'DP Awal (Migrated)'
        },
        newPayment
      ];

      await updateDocument('bookings', selectedBooking.id, {
        payments: updatedPayments,
        hasUnreadUpdates: true
      });

      setSelectedBooking(null);
      setFinalPaymentFile(null);
      setPaymentAmountInput('');
      setPaymentNote('Pelunasan');
      showToast('Payment proof uploaded successfully! Waiting for admin approval.');
    } catch (err) {
      console.error(err);
      setError('Failed to upload payment proof.');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div style={{ paddingBottom: '4rem', minHeight: '80vh' }}>
      <h1 className="admin-page-title">My Bookings</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        Track your booking status and manage payments.
      </p>

      {userBookings.length === 0 ? (
        <div className="admin-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p>You have no bookings yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-table-container hide-on-mobile">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Event Date</th>
                  <th>Booking Status</th>
                  <th>Payment Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {userBookings.map((booking) => {
                  const totalPaid = booking.payments
                    ? booking.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
                    : (booking.status === 'approved' ? (booking.paymentAmount || 0) : 0);

                  let paymentStatusStr = 'UNPAID';
                  let paymentStatusColor = 'danger';

                  if (booking.payments && booking.payments.length > 0) {
                    const lastPayment = booking.payments[booking.payments.length - 1];
                    paymentStatusStr = lastPayment.status.toUpperCase();
                    paymentStatusColor = lastPayment.status === 'approved' ? 'success' : lastPayment.status === 'pending' ? 'warning' : 'danger';
                  } else {
                    if (totalPaid > 0) {
                      paymentStatusStr = 'APPROVED';
                      paymentStatusColor = 'success';
                    }
                  }

                  return (
                    <tr key={booking.id}
                      onClick={() => handleOpenDetails(booking)}
                      style={{ cursor: 'pointer' }}
                      className="admin-table-row-clickable">
                      <td data-label="Client Name">
                        <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {booking.fullName}
                          {booking.hasClientUnreadUpdates && (
                            <span style={{ width: '8px', height: '8px', background: 'var(--color-accent)', borderRadius: '50%', display: 'inline-block' }} title="New Update"></span>
                          )}
                        </div>
                      </td>
                      <td data-label="Event Date">{booking.eventDate}</td>
                      <td data-label="Booking Status">
                        <span className={`admin-badge admin-badge--${booking.status === 'approved' ? 'success' : booking.status === 'finished' ? 'success' : booking.status === 'in process' ? 'primary' : booking.status === 'done' ? 'success' : booking.status === 'rejected' ? 'danger' : booking.status === 'cancelled' ? 'secondary' : 'warning'}`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </td>
                      <td data-label="Payment Status">
                        <span className={`admin-badge admin-badge--${paymentStatusColor}`}>
                          {paymentStatusStr}
                        </span>
                      </td>
                      <td data-label="Action" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon"
                            title="View Details"
                            onClick={() => handleOpenDetails(booking)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon"
                            title="Invoice"
                            onClick={() => setSelectedInvoiceBooking(booking)}
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-card-list">
            {userBookings.map((booking) => {
              return (
                <div key={booking.id} className="mobile-card" onClick={() => handleOpenDetails(booking)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {booking.fullName}
                        {booking.hasClientUnreadUpdates && (
                          <span style={{ width: '8px', height: '8px', background: 'var(--color-accent)', borderRadius: '50%', display: 'inline-block' }} />
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>{booking.email}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <span className={`admin-badge admin-badge--${booking.status === 'approved' ? 'success' : booking.status === 'finished' ? 'success' : booking.status === 'in process' ? 'primary' : booking.status === 'done' ? 'success' : booking.status === 'rejected' ? 'danger' : booking.status === 'cancelled' ? 'secondary' : booking.status === 'inquiry' ? 'info' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                        {booking.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                      <span style={{ color: '#555', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Event Date</span>
                      {booking.eventDate}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                      <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => handleOpenDetails(booking)}>
                        <Eye size={14} />
                      </button>
                      <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => setSelectedInvoiceBooking(booking)}>
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Pelunasan Modal */}
      {selectedBooking && (
        <div className="admin-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Upload Bukti Pembayaran Lanjutan</h3>
              <button className="admin-modal__close" onClick={() => setSelectedBooking(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body">
              {error && <div className="auth-card__error">{error}</div>}
              <form onSubmit={handleUploadFinalPayment}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Nominal Transfer</label>
                  <input
                    type="text"
                    required
                    value={formatRupiah(paymentAmountInput)}
                    onChange={(e) => setPaymentAmountInput(e.target.value.replace(/\D/g, ''))}
                    className="form-input"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Keterangan</label>
                  <select
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                    className="form-input"
                  >
                    <option value="Pelunasan">Pelunasan</option>
                    <option value="Cicilan">Cicilan</option>
                    <option value="DP (Down Payment)">DP (Down Payment)</option>
                    <option value="Pembayaran Lainnya">Pembayaran Lainnya</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bukti Transfer (Image)</label>
                  <input type="file" accept="image/*" required onChange={handleFileChange} className="form-input" style={{ padding: '0.5rem' }} />
                </div>
                <div className="admin-modal__footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setSelectedBooking(null)}>Cancel</button>
                  <button type="submit" className="admin-btn admin-btn--primary" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedInvoiceBooking && (
        <div className="admin-modal-overlay" onClick={() => setSelectedInvoiceBooking(null)} style={{ padding: '0.5rem' }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'rgba(15, 15, 15, 0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)', overflow: 'hidden' }}>
            <div className="admin-modal__header" style={{ flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Invoice Preview</h3>
              <button className="admin-modal__close" onClick={() => setSelectedInvoiceBooking(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="admin-modal__body" style={{ overflowY: 'auto', flex: 1, padding: '1rem', WebkitOverflowScrolling: 'touch' }}>
              <InvoicePreview booking={selectedInvoiceBooking} settings={settings} />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedDetailsBooking && (
        <div className="admin-modal-overlay" onClick={() => setSelectedDetailsBooking(null)} style={{ padding: '0.5rem' }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'rgba(15, 15, 15, 0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)', overflow: 'hidden' }}>
            <div className="admin-modal__header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  Booking #{selectedDetailsBooking.id.substring(0, 6).toUpperCase()}
                  <span className={`admin-badge admin-badge--${selectedDetailsBooking.status === 'approved' ? 'success' : selectedDetailsBooking.status === 'finished' ? 'success' : selectedDetailsBooking.status === 'in process' ? 'primary' : selectedDetailsBooking.status === 'done' ? 'success' : selectedDetailsBooking.status === 'rejected' ? 'danger' : selectedDetailsBooking.status === 'cancelled' ? 'secondary' : selectedDetailsBooking.status === 'inquiry' ? 'info' : 'warning'}`}>
                    {selectedDetailsBooking.status.toUpperCase()}
                  </span>
                </h3>
              </div>
              <button className="admin-modal__close" onClick={() => setSelectedDetailsBooking(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body" style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div className="admin-glass-box" style={{ padding: '1.25rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 600 }}>Client Information</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <User size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Client Name</div>
                          <div style={{ fontSize: '0.9rem', color: '#E0E0E0' }}>{selectedDetailsBooking.fullName}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <Mail size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Email Address</div>
                          <div style={{ fontSize: '0.9rem', color: '#E0E0E0' }}>{selectedDetailsBooking.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <Phone size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Phone / WA</div>
                          <div style={{ fontSize: '0.9rem' }}>
                            {selectedDetailsBooking.phone ? (
                              <a href={`https://wa.me/${selectedDetailsBooking.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer" style={{ color: '#E0E0E0', textDecoration: 'none' }}>
                                {selectedDetailsBooking.phone}
                              </a>
                            ) : '-'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <Calendar size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Event Date</div>
                          <div style={{ fontSize: '0.9rem', color: '#E0E0E0' }}>{selectedDetailsBooking.eventDate} {selectedDetailsBooking.eventTime || ''}</div>
                        </div>
                      </div>
                    </div>
                    <hr style={{ margin: '0.5rem 0', border: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                    <div className="admin-glass-box" style={{ marginTop: '0.5rem', borderRadius: '8px', overflow: 'hidden', padding: 0 }}>
                      {selectedDetailsBooking.shareloc?.lat && (
                        <div style={{ height: '200px', width: '100%', position: 'relative', background: '#1E1E1E', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            style={{ border: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                            src={`https://maps.google.com/maps?q=${selectedDetailsBooking.shareloc.lat},${selectedDetailsBooking.shareloc.lng}&hl=en&z=15&output=embed`}
                            allowFullScreen
                            title="Map"
                          ></iframe>
                        </div>
                      )}
                      <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '50%', color: 'var(--color-accent)', display: 'flex', flexShrink: 0 }}>
                            <MapPin size={18} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#E0E0E0', marginBottom: '0.15rem' }}>Alamat Event</div>
                            <div style={{ fontSize: '0.85rem', color: '#AAA', lineHeight: 1.4 }}>
                              {selectedDetailsBooking.eventAddress || 'Alamat belum diatur'}
                            </div>
                          </div>
                        </div>
                        {selectedDetailsBooking.shareloc?.lat && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${selectedDetailsBooking.shareloc.lat},${selectedDetailsBooking.shareloc.lng}`} target="_blank" rel="noreferrer" className="admin-glass-btn" style={{ flexShrink: 0, textDecoration: 'none' }}>
                            Buka Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Project Progress:</h4>
                  </div>
                  <div className="admin-glass-box" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>Estimated Completion Date</div>
                      <div style={{ fontSize: '1rem', color: getDisplayEstimatedDate(selectedDetailsBooking) ? '#E0E0E0' : '#666', fontWeight: 500 }}>
                        {getDisplayEstimatedDate(selectedDetailsBooking) ? formatPrettyDate(getDisplayEstimatedDate(selectedDetailsBooking)) : 'Menunggu Konfirmasi...'}
                      </div>
                    </div>
                    <div>
                      {selectedDetailsBooking.googleDriveLink ? (
                        <a href={selectedDetailsBooking.googleDriveLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--color-accent)', color: '#111', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                          View Project Files &rarr;
                        </a>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: '#222', color: '#555', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', cursor: 'not-allowed' }}>
                          Files Not Available
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Packages:</h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedDetailsBooking.packagesData && selectedDetailsBooking.packagesData.length > 0 ? (
                      selectedDetailsBooking.packagesData.map((pkg) => (
                        <div key={pkg.id} className="admin-glass-box" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                          <div
                            onClick={() => setExpandedPkgId(expandedPkgId === pkg.id ? null : pkg.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.85rem 1rem', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#E0E0E0' }}>{pkg.title}</span>
                                  <ChevronDown size={18} style={{ transform: expandedPkgId === pkg.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                </div>
                                {pkg.description && (
                                  <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: '300', lineHeight: '1.4', textAlign: 'left' }}>
                                    {pkg.description}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                              {(() => {
                                const originalPrice = pkg.price;
                                const hasCustomPrice = pkg.customPrice !== undefined && pkg.customPrice !== null && pkg.customPrice !== pkg.price;
                                const basePrice = hasCustomPrice ? pkg.customPrice : originalPrice;
                                const discountVal = pkg.discountAmount || pkg.discount || (pkg.discountPercent ? basePrice * (pkg.discountPercent / 100) : 0);
                                const hasDiscount = discountVal > 0;
                                const finalPrice = pkg.finalPrice !== undefined ? pkg.finalPrice : (basePrice - discountVal);

                                if (hasDiscount) {
                                  return (
                                    <>
                                      <span style={{ textDecoration: 'line-through', color: '#666', fontSize: '0.8rem' }}>
                                        {formatRupiah(basePrice)}
                                      </span>
                                      <span style={{ color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 600 }}>{pkg.discountPercent ? `-${pkg.discountPercent}%` : `Diskon: -${formatRupiah(discountVal)}`}</span>
                                      <span style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '0.95rem' }}>
                                        {formatRupiah(finalPrice)}
                                      </span>
                                    </>
                                  );
                                } else {
                                  return (
                                    <span style={{ fontWeight: 600, color: '#E0E0E0', fontSize: '0.95rem' }}>{formatRupiah(basePrice)}</span>
                                  );
                                }
                              })()}
                            </div>
                          </div>

                          {expandedPkgId === pkg.id && (pkg.features && pkg.features.length > 0) && (
                            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px dashed #333', marginTop: '0.25rem', paddingTop: '0.75rem' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#CCC', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detail Paket</div>
                              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#AAA', fontSize: '0.85rem' }}>
                                {(pkg.features || []).map((item, idx) => (
                                  <li key={idx} style={{ marginBottom: '0.25rem' }}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="admin-glass-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#E0E0E0' }}>{selectedDetailsBooking.packageTitle}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#E0E0E0' }}>{formatRupiah(selectedDetailsBooking.packagePrice)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #222', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Payment History:</h4>
                  </div>

                  {selectedDetailsBooking.payments ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedDetailsBooking.payments.map((payment) => (
                        <div key={payment.id} className="admin-glass-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: payment.status === 'cancelled' ? '#666' : 'var(--color-success)', fontSize: '0.95rem', textDecoration: payment.status === 'cancelled' ? 'line-through' : 'none', fontWeight: 600 }}>
                              {formatRupiah(payment.amount)}
                            </strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: 400, color: payment.status === 'approved' ? '#888' : payment.status === 'pending' ? '#eab308' : payment.status === 'cancelled' ? '#666' : '#888', textTransform: 'uppercase' }}>
                                {payment.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#888', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem', flex: '1 1 auto', minWidth: 0 }}>
                              {formatPrettyDate(payment.createdAt?.toDate ? payment.createdAt.toDate().toISOString() : payment.createdAt)} &bull; {payment.note}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                              {payment.proofUrl && (
                                <a href={payment.proofUrl} target="_blank" rel="noreferrer" title="View Proof" style={{ color: '#888', padding: 0, display: 'flex' }}><Eye size={16} /></a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-glass-box" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--color-success)', fontSize: '0.95rem', fontWeight: 600 }}>{formatRupiah(selectedDetailsBooking.paymentAmount || 0)}</strong>
                        <a href={selectedDetailsBooking.paymentProofUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}>View Proof &rarr;</a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ringkasan Pembayaran */}
                {(() => {
                  const totalPaid = selectedDetailsBooking.payments ? selectedDetailsBooking.payments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0) : (selectedDetailsBooking.status === 'approved' ? (selectedDetailsBooking.paymentAmount || 0) : 0);
                  const sisa = (selectedDetailsBooking.packagePrice || 0) - totalPaid;
                  return (
                    <div className="admin-glass-box" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#888', fontSize: '0.9rem' }}>Harga Paket</span>
                        <strong style={{ color: '#E0E0E0', fontSize: '0.9rem' }}>{formatRupiah(selectedDetailsBooking.packagePrice || 0)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ color: '#888', fontSize: '0.9rem' }}>Total Dibayar (Approved)</span>
                        <strong style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{formatRupiah(totalPaid)}</strong>
                      </div>
                      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '0 -1.25rem 1rem -1.25rem' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#E0E0E0', fontWeight: 600, fontSize: '0.95rem' }}>{sisa < 0 ? 'Kelebihan Bayar' : 'Kekurangan Bayar'}</span>
                        <strong style={{ color: sisa > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontSize: '1.25rem', fontWeight: 700 }}>
                          {sisa === 0 ? 'LUNAS' : sisa < 0 ? `+ ${formatRupiah(Math.abs(sisa))}` : formatRupiah(sisa)}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSelectedDetailsBooking(null)} className="admin-glass-btn" style={{ flex: 1 }}>Tutup</button>

              {(() => {
                const totalPaid = selectedDetailsBooking.payments
                  ? selectedDetailsBooking.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
                  : (selectedDetailsBooking.status === 'approved' ? (selectedDetailsBooking.paymentAmount || 0) : 0);
                const piutang = selectedDetailsBooking.packagePrice ? Math.max(0, selectedDetailsBooking.packagePrice - totalPaid) : 0;
                const hasPendingPayment = selectedDetailsBooking.payments?.some(p => p.status === 'pending');
                const isApprovedOrHasPayments = selectedDetailsBooking.status === 'approved' ||
                  (selectedDetailsBooking.payments && selectedDetailsBooking.payments.length > 0) ||
                  selectedDetailsBooking.paymentAmount > 0;

                if (piutang > 0 && isApprovedOrHasPayments && !hasPendingPayment) {
                  return (
                    <button
                      onClick={() => {
                        setSelectedBooking(selectedDetailsBooking);
                        setPaymentAmountInput(piutang.toString());
                        setSelectedDetailsBooking(null);
                      }}
                      className="admin-glass-btn-accent"
                    >
                      Upload Pembayaran
                    </button>
                  );
                }
                return null;
              })()}

              <button onClick={() => { setSelectedInvoiceBooking(selectedDetailsBooking); setSelectedDetailsBooking(null); }} className="admin-glass-btn" title="Print Invoice">
                <Printer size={18} />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
