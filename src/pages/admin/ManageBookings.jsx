import { useState, useEffect } from 'react';
import { ChevronDown as ChevronDownIcon } from 'lucide-react';
import { useFirestoreCollection, orderBy, updateDocument, addDocument, deleteDocument } from '../../hooks/useFirestore';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStorage } from '../../hooks/useStorage';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { formatRupiah } from '../../lib/utils';
import { formatDate } from '../../utils/formatDate';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import InvoicePreview from '../../components/ui/InvoicePreview';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Eye, Check, X, FileText, Search, Trash2, Edit2, AlertTriangle, Printer, MapPin, User, Mail, Phone, Calendar, ChevronUp } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import '../../styles/admin.css';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }) {
  const map = useMap();
  useEffect(() => {
    if (position && position.lat && position.lng) {
      map.flyTo([position.lat, position.lng], 15);
    }
  }, [position, map]);

  useMapEvents({ click(e) { setPosition(e.latlng); } });
  return position === null ? null : <Marker position={position}></Marker>;
}

export default function ManageBookings() {
  const { data: bookings, loading: bookingsLoading } = useFirestoreCollection('bookings', [
    orderBy('createdAt', 'desc')
  ]);
  const { data: transactions } = useFirestoreCollection('transactions');
  const { data: packages } = useFirestoreCollection('pricingPackages', [orderBy('order', 'asc')]);
  const loading = bookingsLoading;
  const { settings } = useSiteSettings();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { id, status }
  const [confirmPaymentAction, setConfirmPaymentAction] = useState(null); // { bookingId, paymentId, status }
  const [confirmDeleteBooking, setConfirmDeleteBooking] = useState(null); // booking
  const [showFixedCostModal, setShowFixedCostModal] = useState(null); // booking
  const [fixedCostInput, setFixedCostInput] = useState({ description: '', amount: '' });
  const [editFixedCost, setEditFixedCost] = useState(null); // cost object
  const [confirmDeleteFixedCost, setConfirmDeleteFixedCost] = useState(null); // cost object
  const [showEditPackageModal, setShowEditPackageModal] = useState(null); // booking
  const [editPackageData, setEditPackageData] = useState([]); // array of package ids
  const [editPackageCustomizations, setEditPackageCustomizations] = useState({}); // { [pkgId]: { customPrice: string|number, discount: string|number } }
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRejectWarning, setShowRejectWarning] = useState(false);
  const [expandedPkgId, setExpandedPkgId] = useState(null);
  const [expandedEditPkgId, setExpandedEditPkgId] = useState(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    document.title = `Bookings — ${settings?.brandName || ''}`;
  }, [settings]);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [editBookingData, setEditBookingData] = useState(null);

  useEffect(() => {
    if (isEditingBooking && editBookingData) {
      if (!editBookingData.estimatedCompletionDate && editBookingData.eventDate && settings?.defaultEstimatedDays) {
        const eventDateObj = new Date(editBookingData.eventDate);
        eventDateObj.setDate(eventDateObj.getDate() + (parseInt(settings.defaultEstimatedDays) || 30));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEditBookingData(prev => ({
          ...prev,
          estimatedCompletionDate: eventDateObj.toISOString().split('T')[0]
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingBooking, editBookingData?.eventDate, settings?.defaultEstimatedDays]);

  const [mapPosition, setMapPosition] = useState(null);

  // Sync selectedBooking with Firestore updates (G5)
  useEffect(() => {
    if (selectedBooking) {
      const updated = bookings.find(b => b.id === selectedBooking.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedBooking)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedBooking(updated);
      }

      // Clear unread badge when admin opens the booking details
      if (updated && updated.hasUnreadUpdates) {
        updateDocument('bookings', updated.id, { hasUnreadUpdates: false }).catch(console.error);
      }
    }
  }, [bookings, selectedBooking]);
  const [searchQuery, setSearchQuery] = useState(''); // for map
  const [filterQuery, setFilterQuery] = useState(''); // for table
  const [filterBookingStatus, setFilterBookingStatus] = useState('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all');

  const [showAddPaymentModal, setShowAddPaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', note: '', date: new Date().toISOString().split('T')[0] });
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const { uploadFile, uploading: fileUploading } = useStorage();

  const handleMapSearch = async () => {
    if (!searchQuery) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newPos = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setMapPosition(newPos);
        setEditBookingData({ ...editBookingData, shareloc: newPos });
      } else {
        showToast('Location not found. Try a broader search term.', 'error');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      showToast('Error searching location.', 'error');
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

  const handleUpdateStatus = async () => {
    if (!confirmAction) return;
    const { id, status } = confirmAction;
    try {
      setUpdating(true);
      const booking = bookings.find(b => b.id === id);
      await updateDocument('bookings', id, { status, hasClientUnreadUpdates: true });

      // Auto cashflow for legacy bookings (if approved and has paymentAmount but no payments array)
      if (status === 'approved' && booking && !booking.payments && booking.paymentAmount > 0) {
        await addDocument('transactions', {
          type: 'INCOME',
          category: 'PAYMENT',
          description: `${booking.paymentType === 'dp' ? 'Down Payment (DP)' : 'Full Payment (Lunas)'} - ${booking.fullName}`,
          amount: booking.paymentAmount,
          date: new Date().toISOString().slice(0, 10),
          eventDate: booking.eventDate,
          bookingId: id,
          createdAt: new Date().toISOString()
        });
      }

      setSelectedBooking(null);
      setConfirmAction(null);
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update booking status.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const proceedSaveEditBooking = async (statusType) => {
    try {
      setUpdating(true);
      const packagePrice = typeof editBookingData.packagePrice === 'string' ? parseInt(editBookingData.packagePrice.toString().replace(/\D/g, ''), 10) : editBookingData.packagePrice;
      const dataToSave = { ...editBookingData };

      // Calculate estimated completion date if empty and settings exist
      if (!dataToSave.estimatedCompletionDate && dataToSave.eventDate && settings?.defaultEstimatedDays) {
        const eventDateObj = new Date(dataToSave.eventDate);
        eventDateObj.setDate(eventDateObj.getDate() + (parseInt(settings.defaultEstimatedDays) || 30));
        dataToSave.estimatedCompletionDate = eventDateObj.toISOString().split('T')[0];
      }

      // Track revisions for the estimated completion date
      if (dataToSave.estimatedCompletionDate !== selectedBooking.estimatedCompletionDate) {
        dataToSave.estimatedCompletionRevisions = (selectedBooking.estimatedCompletionRevisions || 0) + 1;
      }

      // Auto transfer payments to OTHER if cancelled
      if (statusType === 'cancel') {
        const relatedTransactions = transactions.filter(t => t.bookingId === dataToSave.id && t.category === 'PAYMENT');
        for (const t of relatedTransactions) {
          const createdStr = t.createdAt?.toDate ? t.createdAt.toDate().toISOString().slice(0, 10) : (t.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
          // eslint-disable-next-line no-unused-vars
          const _createdStr = createdStr;
          await updateDocument('transactions', t.id, {
            category: 'OTHER',
            description: `(Cancelled) ${t.description}`,
            date: new Date().toISOString().slice(0, 10),
            eventDate: dataToSave.eventDate
          });
        }

        if (dataToSave.payments && dataToSave.payments.length > 0) {
          dataToSave.payments = dataToSave.payments.map(p =>
            p.status !== 'rejected' ? { ...p, status: 'cancelled' } : p
          );
        }
      }

      // Revert from Cancelled
      if (statusType === 'revert') {
        const relatedTransactions = transactions.filter(t => t.bookingId === dataToSave.id && t.category === 'OTHER' && t.description?.toLowerCase().includes('cancelled'));
        for (const t of relatedTransactions) {
          const createdStr = t.createdAt?.toDate ? t.createdAt.toDate().toISOString().slice(0, 10) : (t.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
          // eslint-disable-next-line no-unused-vars
          const _createdStr = createdStr;
          await updateDocument('transactions', t.id, {
            category: 'PAYMENT',
            description: t.description.replace(/(\[|\()Cancelled(\]|\))\s*/i, ''),
            date: createdStr,
            eventDate: dataToSave.eventDate
          });
        }

        if (dataToSave.payments && dataToSave.payments.length > 0) {
          dataToSave.payments = dataToSave.payments.map(p =>
            p.status === 'cancelled' ? { ...p, status: 'approved' } : p
          );
        }
      }

      await updateDocument('bookings', dataToSave.id, {
        ...dataToSave,
        packagePrice: packagePrice || 0,
        hasClientUnreadUpdates: true
      });
      setSelectedBooking({ ...dataToSave, packagePrice: packagePrice || 0 });
      setIsEditingBooking(false);
      showToast('Booking updated successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to update booking.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveEditBooking = async (e) => {
    e.preventDefault();
    if (!editBookingData || !editBookingData.id) return;

    if (editBookingData.status === 'rejected') {
      const hasApprovedPayment = selectedBooking.payments?.some(p => p.status === 'approved' || p.status === 'cancelled');
      const hasLegacyPayment = !selectedBooking.payments && selectedBooking.paymentAmount > 0 && selectedBooking.status !== 'pending' && selectedBooking.status !== 'rejected';

      if (hasApprovedPayment || hasLegacyPayment) {
        setShowRejectWarning(true);
        return;
      }
    }

    if (editBookingData.status === 'cancelled' && selectedBooking.status !== 'cancelled') {
      setConfirmStatusChange({ type: 'cancel' });
      return;
    }

    if (editBookingData.status !== 'cancelled' && selectedBooking.status === 'cancelled') {
      setConfirmStatusChange({ type: 'revert' });
      return;
    }

    proceedSaveEditBooking(null);
  };

  const handleSaveEditPackage = async (e) => {
    e.preventDefault();
    if (!showEditPackageModal) return;
    try {
      setUpdating(true);
      const selectedPackagesData = packages.filter(p => editPackageData.includes(p.id));

      let estimatedTotal = 0;
      const packagesDataToSave = selectedPackagesData.map(p => {
        const originalPrice = typeof p.price === 'string' ? parseInt(p.price.replace(/\D/g, ''), 10) : (p.price || 0);

        let finalPrice = originalPrice;
        let customPriceObj = editPackageCustomizations[p.id];

        let customPriceVal = null;
        let discountVal = 0;

        if (customPriceObj) {
          if (customPriceObj.customPrice !== undefined && customPriceObj.customPrice !== '') {
            customPriceVal = typeof customPriceObj.customPrice === 'string' ? parseInt(customPriceObj.customPrice.toString().replace(/\D/g, ''), 10) : customPriceObj.customPrice;
            finalPrice = customPriceVal;
          }
          if (customPriceObj.discountPercent !== undefined && customPriceObj.discountPercent !== '') {
            const pct = parseInt(customPriceObj.discountPercent, 10);
            if (!isNaN(pct)) {
              discountVal = finalPrice * (pct / 100);
              finalPrice = Math.max(0, finalPrice - discountVal);
            }
          } else if (customPriceObj.discount !== undefined && customPriceObj.discount !== '') {
            discountVal = typeof customPriceObj.discount === 'string' ? parseInt(customPriceObj.discount.toString().replace(/\D/g, ''), 10) : customPriceObj.discount;
            finalPrice = Math.max(0, finalPrice - discountVal);
          }
        }

        estimatedTotal += finalPrice;

        return {
          id: p.id,
          title: p.title,
          price: originalPrice,
          customPrice: customPriceVal,
          discount: discountVal,
          discountPercent: (customPriceObj && customPriceObj.discountPercent) ? parseInt(customPriceObj.discountPercent, 10) : null,
          finalPrice: finalPrice,
          description: p.description || '',
          features: (editPackageCustomizations[p.id] && editPackageCustomizations[p.id].features !== undefined) ? editPackageCustomizations[p.id].features : (p.features || [])
        };
      });

      const packageTitles = selectedPackagesData.map(p => p.title).join(', ');

      const updatedData = {
        packageIds: editPackageData,
        packagesData: packagesDataToSave,
        packageTitle: packageTitles,
        packagePrice: estimatedTotal
      };

      await updateDocument('bookings', showEditPackageModal.id, { ...updatedData, hasClientUnreadUpdates: true });
      setSelectedBooking({ ...showEditPackageModal, ...updatedData });
      setShowEditPackageModal(null);
      showToast('Packages updated successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to update packages.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const [confirmDeletePayment, setConfirmDeletePayment] = useState(null);

  const handleUpdatePaymentStatus = async () => {
    if (!confirmPaymentAction) return;
    const { bookingId, paymentId, status } = confirmPaymentAction;
    try {
      setUpdating(true);
      const booking = bookings.find(b => b.id === bookingId);
      if (booking && booking.payments) {
        const oldPayment = booking.payments.find(p => p.id === paymentId);
        const updatedPayments = booking.payments.map(p =>
          p.id === paymentId ? { ...p, status } : p
        );
        await updateDocument('bookings', bookingId, { payments: updatedPayments, hasClientUnreadUpdates: true });
        setSelectedBooking({ ...booking, payments: updatedPayments });

        // Handle Cashflow Sync
        if (oldPayment.status !== 'approved' && status === 'approved') {
          await addDocument('transactions', {
            type: 'INCOME',
            category: 'PAYMENT',
            description: `${oldPayment.note || 'Pembayaran'} - ${booking.fullName}`,
            amount: oldPayment.amount,
            date: new Date().toISOString().slice(0, 10),
            eventDate: booking.eventDate,
            bookingId: bookingId,
            createdAt: new Date().toISOString()
          });
        } else if (oldPayment.status === 'approved' && status !== 'approved') {
          const relatedTransaction = transactions.find(t =>
            t.bookingId === bookingId &&
            (t.category === 'PAYMENT' || t.category === 'OTHER') &&
            t.amount === oldPayment.amount
          );
          if (relatedTransaction) {
            await deleteDocument('transactions', relatedTransaction.id);
          }
        }
      }
      setConfirmPaymentAction(null);
    } catch (error) {
      console.error('Error updating payment status:', error);
      showToast('Failed to update payment status.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!confirmDeletePayment) return;
    const { bookingId, paymentId } = confirmDeletePayment;
    try {
      setUpdating(true);
      const booking = bookings.find(b => b.id === bookingId);
      if (booking && booking.payments) {
        const paymentToDelete = booking.payments.find(p => p.id === paymentId);
        const updatedPayments = booking.payments.filter(p => p.id !== paymentId);

        await updateDocument('bookings', bookingId, { payments: updatedPayments, hasClientUnreadUpdates: true });
        setSelectedBooking({ ...booking, payments: updatedPayments });

        if (paymentToDelete && paymentToDelete.status === 'approved') {
          const relatedTransaction = transactions.find(t =>
            t.bookingId === bookingId &&
            (t.category === 'PAYMENT' || t.category === 'OTHER') &&
            t.amount === paymentToDelete.amount
          );
          if (relatedTransaction) {
            await deleteDocument('transactions', relatedTransaction.id);
          }
        }
      }
      setConfirmDeletePayment(null);
      showToast('Payment deleted successfully.');
    } catch (error) {
      console.error('Error deleting payment:', error);
      showToast('Failed to delete payment.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!showAddPaymentModal || !paymentInput.amount || !paymentInput.note) return;
    try {
      setUpdating(true);

      let proofUrl = '';
      if (paymentProofFile) {
        const timestamp = Date.now();
        const filePath = `bookings/payment_proofs/${showAddPaymentModal.id}_${timestamp}_${paymentProofFile.name}`;
        proofUrl = await uploadFile(paymentProofFile, filePath);
      }

      const amountNum = parseInt(paymentInput.amount.toString().replace(/\D/g, ''), 10) || 0;
      const now = new Date();
      let isoDate = now.toISOString();
      if (paymentInput.date) {
        const [y, m, d] = paymentInput.date.split('-');
        now.setFullYear(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        isoDate = now.toISOString();
      }

      const newPayment = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        amount: amountNum,
        proofUrl: proofUrl,
        status: 'approved',
        createdAt: isoDate,
        note: paymentInput.note,
        addedBy: 'admin'
      };

      const updatedPayments = showAddPaymentModal.payments ? [...showAddPaymentModal.payments, newPayment] : [newPayment];
      await updateDocument('bookings', showAddPaymentModal.id, { payments: updatedPayments, hasClientUnreadUpdates: true });

      await addDocument('transactions', {
        type: 'INCOME',
        category: 'PAYMENT',
        description: `${newPayment.note} (Admin) - ${showAddPaymentModal.fullName}`,
        amount: amountNum,
        date: paymentInput.date || new Date().toISOString().split('T')[0],
        eventDate: showAddPaymentModal.eventDate,
        bookingId: showAddPaymentModal.id,
        createdAt: isoDate
      });

      setSelectedBooking({ ...showAddPaymentModal, payments: updatedPayments });
      setShowAddPaymentModal(null);
      setPaymentInput({ amount: '', note: '', date: new Date().toISOString().split('T')[0] });
      setPaymentProofFile(null);
      showToast('Payment added successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to add payment.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddFixedCost = async (e) => {
    e.preventDefault();
    if (!showFixedCostModal || !fixedCostInput.description || !fixedCostInput.amount) return;
    try {
      setUpdating(true);
      const amountNum = parseInt(fixedCostInput.amount.toString().replace(/\D/g, ''), 10) || 0;
      await addDocument('transactions', {
        type: 'EXPENSE',
        category: 'FIXED COST',
        description: fixedCostInput.description,
        amount: amountNum,
        date: new Date().toISOString().slice(0, 10),
        eventDate: showFixedCostModal.eventDate,
        bookingId: showFixedCostModal.id,
        createdAt: new Date().toISOString()
      });
      setShowFixedCostModal(null);
      setFixedCostInput({ description: '', amount: '' });
      showToast('Fixed Cost added successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to add Fixed Cost.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditFixedCost = async (e) => {
    e.preventDefault();
    if (!editFixedCost || !fixedCostInput.description || !fixedCostInput.amount) return;
    try {
      setUpdating(true);
      const amountNum = parseInt(fixedCostInput.amount.toString().replace(/\D/g, ''), 10) || 0;
      await updateDocument('transactions', editFixedCost.id, {
        description: fixedCostInput.description,
        amount: amountNum
      });
      setEditFixedCost(null);
      setFixedCostInput({ description: '', amount: '' });
      showToast('Fixed Cost updated successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to update Fixed Cost.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteFixedCost = async () => {
    if (!confirmDeleteFixedCost) return;
    try {
      setUpdating(true);
      await deleteDocument('transactions', confirmDeleteFixedCost.id);
      setConfirmDeleteFixedCost(null);
      showToast('Fixed Cost deleted successfully!');
    } catch (error) {
      console.error(error);
      showToast('Failed to delete Fixed Cost.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const filteredBookings = bookings.filter(b => {
    let matchesSearch = true;
    if (filterQuery) {
      const search = filterQuery.toLowerCase();
      matchesSearch = (
        b.fullName?.toLowerCase().includes(search) ||
        b.id?.toLowerCase().includes(search) ||
        b.eventDate?.includes(search) ||
        b.email?.toLowerCase().includes(search)
      );
    }

    let matchesBookingStatus = true;
    if (filterBookingStatus !== 'all') {
      matchesBookingStatus = b.status === filterBookingStatus;
    }

    let matchesPaymentStatus = true;
    if (filterPaymentStatus !== 'all') {
      const totalPaid = b.payments
        ? b.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
        : (b.status === 'approved' ? (b.paymentAmount || 0) : 0);

      let paymentStatusStr = 'unpaid';
      if (b.payments && b.payments.length > 0) {
        const lastPayment = b.payments[b.payments.length - 1];
        paymentStatusStr = lastPayment.status;
      } else {
        if (totalPaid > 0) {
          paymentStatusStr = 'approved';
        }
      }
      matchesPaymentStatus = paymentStatusStr === filterPaymentStatus;
    }

    return matchesSearch && matchesBookingStatus && matchesPaymentStatus;
  }).sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));

  return (
    <div className="admin-page">
      <div className="admin-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: '1 1 auto', minWidth: '200px' }}>
          <h1 className="admin-header__title" style={{ margin: 0 }}>Manage Bookings</h1>
          <p className="admin-header__subtitle" style={{ margin: '0.25rem 0 0 0' }}>View and manage client bookings, invoices, and payments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: '1 1 100%' }}>
          <select
            className="form-input admin-search-input"
            style={{ flex: '1 1 140px', minWidth: '140px', padding: '0.65rem', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#E0E0E0' }}
            value={filterBookingStatus}
            onChange={(e) => setFilterBookingStatus(e.target.value)}
          >
            <option value="all">All Booking Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="in process">In Process</option>
            <option value="done">Done</option>
            <option value="finished">Finished</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            className="form-input admin-search-input"
            style={{ flex: '1 1 140px', minWidth: '140px', padding: '0.65rem', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#E0E0E0' }}
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
          >
            <option value="all">All Payment Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            type="text"
            placeholder="Search by name, date, ID, email..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="form-input admin-search-input"
            style={{ flex: '2 1 200px', minWidth: '200px', padding: '0.65rem 1rem', background: '#111', border: '1px solid #333', borderRadius: '8px', color: '#E0E0E0' }}
          />
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="admin-card">
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            No bookings found.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="admin-card hide-on-mobile">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Event Date</th>
                    <th>Booking Status</th>
                    <th>Payment Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const totalPaid = booking.payments
                      ? booking.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
                      : (booking.status === 'approved' ? (booking.paymentAmount || 0) : 0);
                    // eslint-disable-next-line no-unused-vars
                    const piutang = booking.packagePrice ? Math.max(0, booking.packagePrice - totalPaid) : 0;
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
                        onClick={() => { setSelectedBooking(booking); setIsEditingBooking(false); setEditBookingData(booking); setMapPosition(booking.shareloc || null); }}
                        style={{ cursor: 'pointer' }}
                        className="admin-table-row-clickable">
                        <td>
                          <div className="td-content-client">
                            <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {booking.fullName}
                              {booking.hasUnreadUpdates && (
                                <span style={{ width: '8px', height: '8px', background: 'var(--color-accent)', borderRadius: '50%', display: 'inline-block' }} title="New Update"></span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{booking.email}</div>
                          </div>
                        </td>
                        <td>{booking.eventDate}</td>
                        <td>
                          <span className={`admin-badge admin-badge--${booking.status === 'approved' ? 'success' : booking.status === 'finished' ? 'success' : booking.status === 'in process' ? 'primary' : booking.status === 'done' ? 'success' : booking.status === 'rejected' ? 'danger' : booking.status === 'cancelled' ? 'secondary' : 'warning'}`}>
                            {booking.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge--${paymentStatusColor}`}>
                            {paymentStatusStr}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              title="View Details"
                              style={{ padding: '0.25rem', color: 'var(--color-text-light)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                              onClick={() => { setSelectedBooking(booking); setIsEditingBooking(false); setEditBookingData(booking); setMapPosition(booking.shareloc || null); }}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              title="View Invoice"
                              style={{ padding: '0.25rem', color: 'var(--color-text-light)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                              onClick={() => setSelectedInvoiceBooking(booking)}
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              title="Delete Booking"
                              style={{ padding: '0.25rem', color: 'var(--color-danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteBooking(booking);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-card-list">
            {filteredBookings.map((booking) => {
              const totalPaid = booking.payments
                ? booking.payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
                : (booking.status === 'approved' ? (booking.paymentAmount || 0) : 0);
              // eslint-disable-next-line no-unused-vars
              const piutang = booking.packagePrice ? Math.max(0, booking.packagePrice - totalPaid) : 0;
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
                <div key={booking.id} className="mobile-card" onClick={() => { setSelectedBooking(booking); setIsEditingBooking(false); setEditBookingData(booking); setMapPosition(booking.shareloc || null); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#E0E0E0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {booking.fullName}
                        {booking.hasUnreadUpdates && (
                          <span style={{ width: '8px', height: '8px', background: 'var(--color-accent)', borderRadius: '50%', display: 'inline-block' }} />
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>{booking.email}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <span className={`admin-badge admin-badge--${booking.status === 'approved' ? 'success' : booking.status === 'finished' ? 'success' : booking.status === 'in process' ? 'primary' : booking.status === 'done' ? 'success' : booking.status === 'rejected' ? 'danger' : booking.status === 'cancelled' ? 'secondary' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                        {booking.status.toUpperCase()}
                      </span>
                      <span className={`admin-badge admin-badge--${paymentStatusColor}`} style={{ fontSize: '0.65rem' }}>
                        {paymentStatusStr}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                      <span style={{ color: '#555', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Event Date</span>
                      {booking.eventDate}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                      <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => { setSelectedBooking(booking); setIsEditingBooking(false); setEditBookingData(booking); setMapPosition(booking.shareloc || null); }}>
                        <Eye size={14} />
                      </button>
                      <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => setSelectedInvoiceBooking(booking)}>
                        <FileText size={14} />
                      </button>
                      <button className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon" onClick={() => setConfirmDeleteBooking(booking)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selectedBooking && (
        <div className="admin-modal-overlay" onClick={() => setSelectedBooking(null)} style={{ backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.4)' }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'rgba(15,15,15,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)', overflow: 'hidden' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#E0E0E0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isEditingBooking ? 'Edit Booking' : `Booking #${selectedBooking.id.substring(0, 6).toUpperCase()}`}
                {!isEditingBooking && (
                  <span className={`admin-badge admin-badge--${selectedBooking.status === 'approved' ? 'success' : selectedBooking.status === 'finished' ? 'success' : selectedBooking.status === 'in process' ? 'primary' : selectedBooking.status === 'done' ? 'success' : selectedBooking.status === 'rejected' ? 'danger' : selectedBooking.status === 'cancelled' ? 'secondary' : 'warning'}`} style={{ fontSize: '0.65rem' }}>
                    {selectedBooking.status.toUpperCase()}
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!isEditingBooking && (
                  <button onClick={() => { setEditBookingData(selectedBooking); setIsEditingBooking(true); }} className="admin-glass-btn">
                    <Edit2 size={14} /> Edit
                  </button>
                )}
              </div>
            </div>

            <div className="admin-modal__body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', WebkitOverflowScrolling: 'touch' }}>
              {isEditingBooking ? (
                <form onSubmit={handleSaveEditBooking} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group"><label className="form-label">Client Name</label><input type="text" value={editBookingData.fullName || ''} onChange={e => setEditBookingData({ ...editBookingData, fullName: e.target.value })} className="form-input" required /></div>
                    <div className="form-group"><label className="form-label">Email</label><input type="email" value={editBookingData.email || ''} onChange={e => setEditBookingData({ ...editBookingData, email: e.target.value })} className="form-input" /></div>
                    <div className="form-group"><label className="form-label">Phone/WA</label><input type="text" value={editBookingData.phone || ''} onChange={e => setEditBookingData({ ...editBookingData, phone: e.target.value })} className="form-input" /></div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select value={editBookingData.status || 'pending'} onChange={e => setEditBookingData({ ...editBookingData, status: e.target.value })} className="form-input">
                        <option value="pending">PENDING</option>
                        <option value="approved">APPROVED</option>
                        <option value="in process">IN PROCESS</option>
                        <option value="finished">FINISHED</option>
                        <option value="rejected">REJECTED</option>
                        <option value="cancelled">CANCELLED</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group"><label className="form-label">Event Date</label><input type="date" value={editBookingData.eventDate || ''} onChange={e => setEditBookingData({ ...editBookingData, eventDate: e.target.value })} className="form-input" required /></div>
                    <div className="form-group"><label className="form-label">Event Time</label><input type="time" value={editBookingData.eventTime || ''} onChange={e => setEditBookingData({ ...editBookingData, eventTime: e.target.value })} className="form-input" /></div>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Event Address</label>
                    <textarea value={editBookingData.eventAddress || ''} onChange={e => setEditBookingData({ ...editBookingData, eventAddress: e.target.value })} className="form-input" rows="2"></textarea>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', gridColumn: '1 / -1' }}>
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label className="form-label">Estimated Project Completion</label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Revisions: {selectedBooking.estimatedCompletionRevisions || 0}/{settings?.maxRevisions || 3}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={editBookingData.estimatedCompletionDate || ''}
                        onChange={e => setEditBookingData({ ...editBookingData, estimatedCompletionDate: e.target.value })}
                        className="form-input"
                        disabled={(selectedBooking.estimatedCompletionRevisions || 0) >= (settings?.maxRevisions || 3)}
                      />
                      {(selectedBooking.estimatedCompletionRevisions || 0) >= (settings?.maxRevisions || 3) && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.25rem' }}>Revision limit reached. Field is locked.</p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Google Drive Link (Project Files)</label>
                      <input
                        type="url"
                        value={editBookingData.googleDriveLink || ''}
                        onChange={e => setEditBookingData({ ...editBookingData, googleDriveLink: e.target.value })}
                        className="form-input"
                        placeholder="https://drive.google.com/..."
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Shareloc (Pin Location)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }}
                      />
                      <button type="button" className="btn btn-outline" onClick={handleMapSearch}>
                        <Search size={18} />
                      </button>
                    </div>
                    <div style={{ height: '250px', width: '100%', borderRadius: '8px', overflow: 'hidden', zIndex: 1, border: '1px solid #333' }}>
                      <MapContainer center={mapPosition && mapPosition.lat ? [mapPosition.lat, mapPosition.lng] : [-6.2088, 106.8456]} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationMarker position={mapPosition} setPosition={(pos) => { setMapPosition(pos); setEditBookingData({ ...editBookingData, shareloc: { lat: pos.lat, lng: pos.lng } }); }} />
                      </MapContainer>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setIsEditingBooking(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={updating}>{updating ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                  {/* Client Info Card */}
                  <div className="admin-glass-box" style={{ borderRadius: '8px', padding: '1.25rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 600 }}>Client Information</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <User size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Client Name</div>
                            <div style={{ fontSize: '0.9rem', color: '#E0E0E0' }}>{selectedBooking.fullName}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <Mail size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Email Address</div>
                            <div style={{ fontSize: '0.9rem', color: '#E0E0E0' }}>{selectedBooking.email}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <Phone size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Phone / WA</div>
                            <div style={{ fontSize: '0.9rem' }}>
                              {selectedBooking.phone ? (
                                <a href={`https://wa.me/${selectedBooking.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer" style={{ color: '#E0E0E0', textDecoration: 'none' }}>
                                  {selectedBooking.phone}
                                </a>
                              ) : '-'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <Calendar size={16} style={{ color: '#888', marginTop: '0.1rem', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.15rem' }}>Event Date</div>
                            <div style={{ fontSize: '0.9rem', color: '#E0E0E0' }}>{selectedBooking.eventDate} {selectedBooking.eventTime || ''}</div>
                          </div>
                        </div>
                      </div>
                      <hr style={{ margin: '0.5rem 0', border: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                      <div className="admin-glass-box" style={{ marginTop: '0.5rem', borderRadius: '8px', overflow: 'hidden' }}>
                        {selectedBooking.shareloc?.lat && (
                          <div style={{ height: '200px', width: '100%', position: 'relative', background: '#1E1E1E', borderBottom: '1px solid #333' }}>
                            <iframe
                              width="100%"
                              height="100%"
                              frameBorder="0"
                              style={{ border: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                              src={`https://maps.google.com/maps?q=${selectedBooking.shareloc.lat},${selectedBooking.shareloc.lng}&hl=en&z=15&output=embed`}
                              allowFullScreen
                            ></iframe>
                          </div>
                        )}
                        <div style={{ padding: '1rem', background: selectedBooking.shareloc?.lat ? 'rgba(0,0,0,0.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '50%', color: 'var(--color-accent)', display: 'flex', flexShrink: 0 }}>
                              <MapPin size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#E0E0E0', marginBottom: '0.15rem' }}>Alamat Event</div>
                              <div style={{ fontSize: '0.85rem', color: '#AAA', lineHeight: 1.4 }}>
                                {selectedBooking.eventAddress || 'Alamat belum diatur'}
                              </div>
                            </div>
                          </div>
                          {selectedBooking.shareloc?.lat && (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${selectedBooking.shareloc.lat},${selectedBooking.shareloc.lng}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.4rem 0.85rem', background: '#222', color: '#E0E0E0', border: '1px solid #444', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                              Buka Maps
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Project Progress Section */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Project Progress:</h4>
                    </div>
                    <div className="admin-glass-box" style={{ borderRadius: '8px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>Estimated Completion Date</div>
                        <div style={{ fontSize: '1rem', color: getDisplayEstimatedDate(selectedBooking) ? '#E0E0E0' : '#666', fontWeight: 500 }}>
                          {getDisplayEstimatedDate(selectedBooking) ? formatDate(getDisplayEstimatedDate(selectedBooking)) : 'Menunggu Konfirmasi...'}
                        </div>
                      </div>
                      <div>
                        {selectedBooking.googleDriveLink ? (
                          <a href={selectedBooking.googleDriveLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--color-accent)', color: '#111', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
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

                  {/* Packages Section */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Packages:</h4>
                      <button onClick={() => {
                        setShowEditPackageModal(selectedBooking);
                        setEditPackageData(selectedBooking.packageIds || []);
                        const customizations = {};
                        if (selectedBooking.packagesData) {
                          selectedBooking.packagesData.forEach(p => {
                            const basePrice = (p.customPrice !== undefined && p.customPrice !== null) ? p.customPrice : (p.price || 0);
                            const existingDiscount = p.discountAmount || p.discount || (p.discountPercent ? basePrice * (p.discountPercent / 100) : 0);
                            customizations[p.id] = {
                              customPrice: (p.customPrice !== undefined && p.customPrice !== null) ? p.customPrice : '',
                              discount: existingDiscount > 0 ? existingDiscount : '',
                              discountPercent: p.discountPercent || '',
                              features: p.features || packages?.find(pkg => pkg.id === p.id)?.features || []
                            };
                          });
                        }
                        setEditPackageCustomizations(customizations);
                      }} className="admin-glass-btn-accent">
                        + PACKAGES
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedBooking.packagesData && selectedBooking.packagesData.length > 0 ? (
                        selectedBooking.packagesData.map((pkg) => (
                          <div key={pkg.id} className="admin-glass-box" style={{ display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden' }}>
                            <div
                              onClick={() => setExpandedPkgId(expandedPkgId === pkg.id ? null : pkg.id)}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.85rem 1rem', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#E0E0E0' }}>{pkg.title}</span>
                                    <ChevronDownIcon size={16} style={{ color: '#888', transform: expandedPkgId === pkg.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
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

                            {expandedPkgId === pkg.id && (pkg.features || packages?.find(p => p.id === pkg.id)?.features) && (
                              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px dashed #333', marginTop: '0.25rem', paddingTop: '0.75rem' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#CCC', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detail Paket</div>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#AAA', fontSize: '0.85rem' }}>
                                  {(pkg.features || packages?.find(p => p.id === pkg.id)?.features || []).map((item, idx) => (
                                    <li key={idx} style={{ marginBottom: '0.25rem' }}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="admin-glass-box" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#E0E0E0' }}>{selectedBooking.packageTitle}</span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#E0E0E0' }}>{formatRupiah(selectedBooking.packagePrice)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fixed Costs Section */}
                  <div style={{ borderTop: '1px solid #222', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Operational:</h4>
                      <button onClick={() => setShowFixedCostModal(selectedBooking)} className="admin-glass-btn-accent">
                        + FIXED COST
                      </button>
                    </div>
                    {transactions && transactions.filter(t => t.bookingId === selectedBooking.id && t.category === 'FIXED COST').length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {transactions.filter(t => t.bookingId === selectedBooking.id && t.category === 'FIXED COST').map((cost) => (
                          <div key={cost.id} className="admin-glass-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderRadius: '8px' }}>
                            <div>
                              <strong style={{ color: 'var(--color-danger)', fontSize: '0.95rem', display: 'block', fontWeight: 600 }}>{formatRupiah(cost.amount)}</strong>
                              <span style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.1rem', display: 'block' }}>{cost.description}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <button onClick={() => { setEditFixedCost(cost); setFixedCostInput({ description: cost.description, amount: cost.amount }); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => setConfirmDeleteFixedCost(cost)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-glass-box" style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.9rem', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
                        Belum ada pengeluaran operasional.
                      </div>
                    )}
                  </div>

                  {/* Payment History Section */}
                  <div style={{ borderTop: '1px solid #222', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#E0E0E0', fontWeight: 400 }}>Payment History:</h4>
                      <button onClick={() => setShowAddPaymentModal(selectedBooking)} className="admin-glass-btn-accent">
                        + PAYMENT
                      </button>
                    </div>

                    {selectedBooking.payments ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedBooking.payments.map((payment) => (
                          <div key={payment.id} className="admin-glass-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: payment.status === 'cancelled' ? '#666' : 'var(--color-success)', fontSize: '0.95rem', textDecoration: payment.status === 'cancelled' ? 'line-through' : 'none', fontWeight: 600 }}>
                                {formatRupiah(payment.amount)}
                              </strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                {payment.status === 'pending' && editingPaymentId !== payment.id && selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'rejected' && (
                                  <>
                                    <button style={{ color: 'var(--color-success)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }} onClick={(e) => { e.stopPropagation(); setConfirmPaymentAction({ bookingId: selectedBooking.id, paymentId: payment.id, status: 'approved' }); }} title="Approve"><Check size={18} strokeWidth={2.5} /></button>
                                    <button style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }} onClick={(e) => { e.stopPropagation(); setConfirmPaymentAction({ bookingId: selectedBooking.id, paymentId: payment.id, status: 'rejected' }); }} title="Reject"><X size={18} strokeWidth={2.5} /></button>
                                  </>
                                )}
                                {editingPaymentId === payment.id ? (
                                  <select className="form-input" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: 'auto', borderRadius: '4px' }} defaultValue={payment.status} onChange={(e) => { if (e.target.value !== payment.status) { setConfirmPaymentAction({ bookingId: selectedBooking.id, paymentId: payment.id, status: e.target.value }); } setEditingPaymentId(null); }} onBlur={() => setEditingPaymentId(null)} autoFocus>
                                    <option value="pending">PENDING</option>
                                    <option value="approved">APPROVED</option>
                                    <option value="rejected">REJECTED</option>
                                    <option value="cancelled">CANCELLED</option>
                                  </select>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: 400, color: payment.status === 'approved' ? '#888' : payment.status === 'pending' ? '#eab308' : payment.status === 'cancelled' ? '#666' : '#888', cursor: selectedBooking.status === 'cancelled' || selectedBooking.status === 'rejected' ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }} onClick={(e) => { e.stopPropagation(); if (selectedBooking.status === 'cancelled' || selectedBooking.status === 'rejected') { showToast('Tidak dapat mengubah status payment jika booking cancelled/rejected.', 'error'); } else { setEditingPaymentId(payment.id); } }} title="Click to Edit Status">
                                    {payment.status.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#888', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem', flex: '1 1 auto', minWidth: 0 }}>
                                {formatDate(payment.createdAt?.toDate ? payment.createdAt.toDate().toISOString() : payment.createdAt)} &bull; {payment.note}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                {payment.proofUrl && (
                                  <a href={payment.proofUrl} target="_blank" rel="noreferrer" title="View Proof" style={{ color: '#888', padding: 0, display: 'flex' }}><Eye size={16} /></a>
                                )}
                                {editingPaymentId !== payment.id && (
                                  <button style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }} onClick={(e) => { e.stopPropagation(); setConfirmDeletePayment({ bookingId: selectedBooking.id, paymentId: payment.id }); }} title="Delete Payment"><Trash2 size={16} /></button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-glass-box" style={{ padding: '0.85rem 1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: 'var(--color-success)', fontSize: '0.95rem', fontWeight: 600 }}>{formatRupiah(selectedBooking.paymentAmount || 0)}</strong>
                          <a href={selectedBooking.paymentProofUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500 }}>View Proof &rarr;</a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ringkasan Pembayaran */}
                  {(() => {
                    const totalPaid = selectedBooking.payments ? selectedBooking.payments.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0) : (selectedBooking.status === 'approved' ? (selectedBooking.paymentAmount || 0) : 0);
                    const sisa = (selectedBooking.packagePrice || 0) - totalPaid;
                    return (
                      <div className="admin-glass-box" style={{ borderRadius: '8px', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: '#888', fontSize: '0.9rem' }}>Harga Paket + PPh</span>
                          <strong style={{ color: '#E0E0E0', fontSize: '0.9rem' }}>{formatRupiah(selectedBooking.packagePrice || 0)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <span style={{ color: '#888', fontSize: '0.9rem' }}>Total Dibayar (Approved)</span>
                          <strong style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{formatRupiah(totalPaid)}</strong>
                        </div>
                        <div style={{ borderTop: '1px dashed #333', margin: '0 -1.25rem 1rem -1.25rem' }} />
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
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSelectedBooking(null)} className="admin-glass-btn" style={{ flex: 1 }}>Tutup</button>
              <button onClick={() => { setSelectedInvoiceBooking(selectedBooking); setSelectedBooking(null); }} className="admin-glass-btn" title="Print Invoice">
                <Printer size={18} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedInvoiceBooking && (
        <div className="admin-modal-overlay" onClick={() => setSelectedInvoiceBooking(null)} style={{ padding: '0.5rem' }}>
          <div className="admin-modal admin-modal--lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
            <div className="admin-modal__header" style={{ flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '1rem' }}>Invoice Preview</h3>
              <button className="admin-modal__close" onClick={() => setSelectedInvoiceBooking(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body" style={{ overflowY: 'auto', flex: 1, padding: '1rem', WebkitOverflowScrolling: 'touch' }}>
              <InvoicePreview booking={selectedInvoiceBooking} settings={settings} />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="admin-modal-overlay" onClick={() => !updating && setConfirmAction(null)} style={{ zIndex: 11000 }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="admin-modal__body" style={{ padding: '2rem 1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#E0E0E0' }}>Confirm Action</h3>
              <p style={{ margin: '0 0 2rem 0', color: 'var(--color-text-muted)' }}>
                Are you sure you want to mark this booking as <strong style={{ color: confirmAction.status === 'approved' || confirmAction.status === 'finished' ? 'var(--color-success)' : confirmAction.status === 'in process' ? 'var(--color-accent)' : confirmAction.status === 'rejected' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{confirmAction.status.toUpperCase()}</strong>?
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setConfirmAction(null)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpdateStatus}
                  disabled={updating}
                >
                  {updating ? 'Processing...' : 'Yes, Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {confirmPaymentAction && (
        <div className="admin-modal-overlay" onClick={() => !updating && setConfirmPaymentAction(null)} style={{ zIndex: 12000, background: 'rgba(0,0,0,0.85)' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%', background: '#151515', border: '1px solid #333', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#E0E0E0', fontSize: '1.15rem' }}>Confirm Payment Status</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#ccc', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Are you sure you want to mark this payment as <strong style={{ color: confirmPaymentAction.status === 'approved' ? '#22c55e' : confirmPaymentAction.status === 'pending' ? '#eab308' : 'var(--color-danger)' }}>{confirmPaymentAction.status.toUpperCase()}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmPaymentAction(null)}
                disabled={updating}
                style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: '#E0E0E0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePaymentStatus}
                disabled={updating}
                style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid var(--color-accent)', borderRadius: '8px', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {updating ? 'Processing...' : 'Yes, Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payment Modal */}
      {confirmDeletePayment && (
        <div className="admin-modal-overlay" onClick={() => !updating && setConfirmDeletePayment(null)} style={{ zIndex: 12000, background: 'rgba(0,0,0,0.85)' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%', background: '#151515', border: '1px solid #333', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Trash2 size={24} style={{ color: 'var(--color-danger)' }} />
            </div>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#E0E0E0', fontSize: '1.15rem' }}>Delete Payment</h3>
            <p style={{ margin: '0 0 0.5rem 0', color: '#ccc', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Are you sure you want to delete this payment record?
            </p>
            <p style={{ margin: '0 0 1.5rem 0', color: '#999', fontSize: '0.85rem', lineHeight: 1.5 }}>
              This action is permanent and will also remove related cashflow records if this payment was approved.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmDeletePayment(null)}
                disabled={updating}
                style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: '#E0E0E0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePayment}
                disabled={updating}
                style={{ padding: '0.6rem 1.5rem', background: 'var(--color-danger)', border: '1px solid #dc2626', borderRadius: '8px', color: '#E0E0E0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {updating ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <div className="admin-modal-overlay" onClick={() => !updating && setShowAddPaymentModal(null)} style={{ zIndex: 13500 }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '1rem' }}>Add Manual Payment</h3>
              <button className="admin-modal__close" onClick={() => setShowAddPaymentModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body">
              <form onSubmit={handleAddPayment}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Payment Note / Title</label>
                  <input
                    type="text"
                    required
                    value={paymentInput.note}
                    onChange={(e) => setPaymentInput({ ...paymentInput, note: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Pembayaran Cash / Transfer Susulan"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Amount Paid</label>
                  <input
                    type="text"
                    required
                    value={formatRupiah(paymentInput.amount)}
                    onChange={(e) => setPaymentInput({ ...paymentInput, amount: e.target.value })}
                    className="form-input"
                    placeholder="Rp 0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentInput.date}
                    onChange={(e) => setPaymentInput({ ...paymentInput, date: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '2rem' }}>
                  <label className="form-label">Bukti Pembayaran (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPaymentProofFile(e.target.files[0])}
                    className="form-input"
                    style={{ padding: '0.5rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => { setShowAddPaymentModal(null); setPaymentProofFile(null); }} disabled={updating || fileUploading}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={updating || fileUploading}>
                    {updating || fileUploading ? 'Saving...' : 'Add Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Fixed Cost Modal */}
      {showFixedCostModal && (
        <div className="admin-modal-overlay" onClick={() => !updating && setShowFixedCostModal(null)} style={{ zIndex: 13000 }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '1rem' }}>Add Operational Fixed Cost</h3>
              <button className="admin-modal__close" onClick={() => setShowFixedCostModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body">
              <form onSubmit={handleAddFixedCost}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Cost Description</label>
                  <input
                    type="text"
                    required
                    value={fixedCostInput.description}
                    onChange={(e) => setFixedCostInput({ ...fixedCostInput, description: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Bensin, Makan Tim, Sewa Lensa"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Amount</label>
                  <input
                    type="text"
                    required
                    value={formatRupiah(fixedCostInput.amount)}
                    onChange={(e) => setFixedCostInput({ ...fixedCostInput, amount: e.target.value })}
                    className="form-input"
                    placeholder="Rp 0"
                  />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                  Date: {showFixedCostModal.eventDate} (Linked to Event)
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowFixedCostModal(null)} disabled={updating}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Add Cost'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fixed Cost Modal */}
      {editFixedCost && (
        <div className="admin-modal-overlay" onClick={() => !updating && setEditFixedCost(null)} style={{ zIndex: 13000 }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '1rem' }}>Edit Operational Fixed Cost</h3>
              <button className="admin-modal__close" onClick={() => setEditFixedCost(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body">
              <form onSubmit={handleEditFixedCost}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Cost Description</label>
                  <input
                    type="text"
                    required
                    value={fixedCostInput.description}
                    onChange={(e) => setFixedCostInput({ ...fixedCostInput, description: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Bensin, Makan Tim, Sewa Lensa"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Amount</label>
                  <input
                    type="text"
                    required
                    value={formatRupiah(fixedCostInput.amount)}
                    onChange={(e) => setFixedCostInput({ ...fixedCostInput, amount: e.target.value })}
                    className="form-input"
                    placeholder="Rp 0"
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setEditFixedCost(null)} disabled={updating}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Fixed Cost Modal */}
      {confirmDeleteFixedCost && (
        <div className="admin-modal-overlay" onClick={() => !updating && setConfirmDeleteFixedCost(null)} style={{ zIndex: 13500, background: 'rgba(0,0,0,0.85)' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%', background: '#151515', border: '1px solid #333', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Trash2 size={24} style={{ color: 'var(--color-danger)' }} />
            </div>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#E0E0E0', fontSize: '1.15rem' }}>Delete Fixed Cost</h3>
            <p style={{ margin: '0 0 0.5rem 0', color: '#ccc', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#E0E0E0' }}>{confirmDeleteFixedCost.description}</strong>?
            </p>
            <p style={{ margin: '0 0 1.5rem 0', color: '#999', fontSize: '0.85rem', lineHeight: 1.5 }}>
              This will permanently remove it from your cashflow records.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmDeleteFixedCost(null)}
                disabled={updating}
                style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: '#E0E0E0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFixedCost}
                disabled={updating}
                className="btn btn-danger"
              >
                {updating ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {showEditPackageModal && (
        <div className="admin-modal-overlay" onClick={() => !updating && setShowEditPackageModal(null)} style={{ zIndex: 13000 }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="admin-modal__header">
              <h3 style={{ margin: 0, color: '#E0E0E0', fontSize: '1rem', fontWeight: 600 }}>+ Packages</h3>
              <button className="admin-modal__close" onClick={() => setShowEditPackageModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-modal__body">
              <form onSubmit={handleSaveEditPackage}>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {packages && packages.map(pkg => {
                    const isSelected = editPackageData.includes(pkg.id);
                    return (
                      <div key={pkg.id} className="admin-glass-box" style={{ borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: isSelected ? '1px solid rgba(201, 169, 110, 0.3)' : undefined }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.85rem 1rem' }}>
                          <input
                            type="checkbox"
                            className="admin-glass-checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditPackageData([...editPackageData, pkg.id]);
                              } else {
                                setEditPackageData(editPackageData.filter(id => id !== pkg.id));
                                const newCustomizations = { ...editPackageCustomizations };
                                delete newCustomizations[pkg.id];
                                setEditPackageCustomizations(newCustomizations);
                              }
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontWeight: isSelected ? '600' : '500', color: '#E0E0E0' }}>{pkg.title}</span>
                                {pkg.description && (
                                  <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: '300', lineHeight: '1.4' }}>
                                    {pkg.description}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, marginTop: '2px' }}>
                                <span style={{ color: '#AAA', fontWeight: 500, fontSize: '0.95rem' }}>{formatRupiah(pkg.price)}</span>
                                {pkg.features && pkg.features.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setExpandedEditPkgId(expandedEditPkgId === pkg.id ? null : pkg.id);
                                    }}
                                    style={{ background: 'none', border: 'none', padding: '0.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#888' }}
                                  >
                                    {expandedEditPkgId === pkg.id ? <ChevronUp size={16} /> : <ChevronDownIcon size={16} />}
                                  </button>
                                )}
                              </div>
                            </div>
                            {pkg.features && pkg.features.length > 0 && expandedEditPkgId === pkg.id && (
                              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#888' }}>
                                {pkg.features.map((feature, idx) => (
                                  <li key={idx} style={{ marginBottom: '0.15rem' }}>{feature}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </label>
                        {isSelected && (
                          <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid #222', background: 'transparent', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#888', marginBottom: '0.35rem' }}>Custom Price (Optional)</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder={formatRupiah(pkg.price)}
                                  value={editPackageCustomizations[pkg.id]?.customPrice !== undefined ? (editPackageCustomizations[pkg.id].customPrice === '' ? '' : formatRupiah(editPackageCustomizations[pkg.id].customPrice)) : ''}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setEditPackageCustomizations({
                                      ...editPackageCustomizations,
                                      [pkg.id]: { ...(editPackageCustomizations[pkg.id] || {}), customPrice: val }
                                    });
                                  }}
                                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: '100%', border: '1px solid #333', borderRadius: '4px' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#888', marginBottom: '0.35rem' }}>Discount % (Optional)</label>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder="0"
                                  min="0"
                                  max="100"
                                  value={editPackageCustomizations[pkg.id]?.discountPercent !== undefined ? editPackageCustomizations[pkg.id].discountPercent : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditPackageCustomizations({
                                      ...editPackageCustomizations,
                                      [pkg.id]: { ...(editPackageCustomizations[pkg.id] || {}), discountPercent: val, discount: '' }
                                    });
                                  }}
                                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: '100%', border: '1px solid #333', borderRadius: '4px' }}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#888', marginBottom: '0.35rem' }}>Custom Features (one per line)</label>
                              <textarea
                                className="form-input"
                                rows="3"
                                placeholder="Edit package features here..."
                                value={(editPackageCustomizations[pkg.id]?.features || pkg.features || []).join('\n')}
                                onChange={(e) => {
                                  const newFeatures = e.target.value.split('\n');
                                  setEditPackageCustomizations({
                                    ...editPackageCustomizations,
                                    [pkg.id]: {
                                      ...(editPackageCustomizations[pkg.id] || {}),
                                      features: newFeatures
                                    }
                                  });
                                }}
                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: '100%', border: '1px solid #333', borderRadius: '4px', resize: 'vertical' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowEditPackageModal(null)} disabled={updating}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Save Packages'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Delete Booking Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteBooking}
        title="Delete Booking"
        message="Are you sure you want to delete this booking AND all its related transactions? This action cannot be undone."
        onConfirm={async () => {
          if (!confirmDeleteBooking) return;
          try {
            const booking = confirmDeleteBooking;
            const q = query(collection(db, 'transactions'), where('bookingId', '==', booking.id));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(async (d) => {
              await deleteDoc(doc(db, 'transactions', d.id));
            });
            await deleteDocument('bookings', booking.id);
            showToast('Booking and related transactions deleted.', 'success');
          } catch (e) {
            console.error('Delete error', e);
            showToast('Error deleting booking', 'error');
          }
          setConfirmDeleteBooking(null);
        }}
        onCancel={() => setConfirmDeleteBooking(null)}
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={!!confirmStatusChange}
        title={confirmStatusChange?.type === 'cancel' ? "Konfirmasi Cancel" : "Konfirmasi Revert"}
        message={confirmStatusChange?.type === 'cancel'
          ? "Perhatian: Mengubah status ke CANCELLED akan memindahkan semua dana pembayaran ke cashflow OTHER (Income) pada tanggal hari ini. Lanjutkan?"
          : "Perhatian: Mengubah status dari CANCELLED akan mengembalikan dana di cashflow OTHER kembali ke kategori PAYMENT pada tanggal event semula. Lanjutkan?"}
        onConfirm={() => {
          proceedSaveEditBooking(confirmStatusChange.type);
          setConfirmStatusChange(null);
        }}
        onCancel={() => setConfirmStatusChange(null)}
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
        type="warning"
      />

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
      {showRejectWarning && (
        <div className="admin-modal-overlay" style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}>
          <div style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '380px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            animation: 'fadeInUp 0.3s ease-out'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <AlertTriangle size={24} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.15rem', fontWeight: '600' }}>Peringatan</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Tidak dapat menolak booking karena sudah ada transaksi pembayaran (Approved). Harap batalkan pembayaran terlebih dahulu.
            </p>
            <button
              onClick={() => setShowRejectWarning(false)}
              style={{
                width: '100%',
                padding: '0.8rem',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.05em'
              }}
              onMouseOver={(e) => e.target.style.background = '#dc2626'}
              onMouseOut={(e) => e.target.style.background = '#ef4444'}
            >
              MENGERTI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
