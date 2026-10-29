import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, ChevronDown, ChevronUp, Printer, Copy, Check, MessageCircle, X, CheckCircle, AlertCircle, LocateFixed, CalendarCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import { useStorage } from '../../hooks/useStorage';
import { useFirestoreCollection, orderBy, addDocument } from '../../hooks/useFirestore';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import InvoicePreview from './InvoicePreview';
import { formatRupiah } from '../../lib/utils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/booking.css';

// Fix leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
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
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position}></Marker>;
}

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15);
    }
  }, [position, map]);
  return null;
}

export default function BookingForm() {
  const { user, register, loginWithGoogle, isAdmin } = useAuth();
  const location = useLocation();
  const { uploadFile, uploading } = useStorage();
  const { settings } = useSiteSettings();

  const { data: packages, loading: loadingPackages } = useFirestoreCollection(
    'pricingPackages',
    [orderBy('order', 'asc')]
  );
  const { data: categories } = useFirestoreCollection(
    'pricingCategories',
    [orderBy('order', 'asc')]
  );

  const preSelectedPackage = location.state?.preSelectedPackage || null;
  const preSelectedPackages = location.state?.preSelectedPackages || null;

  const initialPackageIds = preSelectedPackages
    ? preSelectedPackages.map(p => p.id)
    : preSelectedPackage
      ? [preSelectedPackage.id]
      : [];

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    eventDate: '',
    eventTime: '',
    eventAddress: '',
    packageIds: initialPackageIds,
    paymentType: 'dp',
    paymentAmount: '',
    agreeTerms: false,
  });

  const [mapPosition, setMapPosition] = useState(null); // {lat, lng}
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingMap, setSearchingMap] = useState(false);
  const [paymentProof, setPaymentProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedPkgId, setExpandedPkgId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [bookingMode, setBookingMode] = useState('inquiry'); // 'inquiry' or 'direct'
  const [googleLoading, setGoogleLoading] = useState(false);
  const termsRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePrintTerms = async () => {
    if (!termsRef.current) return;
    try {
      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.left = '-9999px';
      printContainer.style.top = '0';
      printContainer.style.width = '800px';
      printContainer.style.background = '#ffffff';
      printContainer.style.color = '#000000';
      printContainer.style.padding = '60px 80px';
      printContainer.style.fontFamily = 'sans-serif';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'flex-end';
      header.style.marginBottom = '40px';
      header.style.borderBottom = '2px solid #000000';
      header.style.paddingBottom = '20px';

      const brand = document.createElement('h1');
      brand.innerText = settings?.brandName || 'PORTFOLIO';
      brand.style.margin = '0';
      brand.style.fontSize = '32px';
      brand.style.fontWeight = 'bold';
      brand.style.letterSpacing = '2px';
      brand.style.textTransform = 'uppercase';

      const docType = document.createElement('div');
      docType.innerText = 'TERMS & CONDITIONS';
      docType.style.fontSize = '18px';
      docType.style.fontWeight = 'bold';
      docType.style.color = '#333333';
      docType.style.letterSpacing = '1px';

      header.appendChild(brand);
      header.appendChild(docType);
      printContainer.appendChild(header);

      const content = document.createElement('div');
      content.innerHTML = termsRef.current.innerHTML;
      content.style.whiteSpace = 'pre-wrap';
      content.style.fontSize = '14px';
      content.style.lineHeight = '1.6';
      printContainer.appendChild(content);

      document.body.appendChild(printContainer);
      const canvas = await html2canvas(printContainer, { backgroundColor: '#ffffff', scale: 2 });
      document.body.removeChild(printContainer);

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Terms_And_Conditions.png`;
      link.click();
    } catch (err) {
      console.error('Error generating terms image:', err);
    }
  };

  // Auto-fill user data if logged in
  useEffect(() => {
    if (user && !isAdmin) {
      setFormData(prev => ({
        ...prev,
        fullName: user.displayName || prev.fullName,
        email: user.email || prev.email,
        phone: prev.phone || '',
      }));
    }
  }, [user, isAdmin]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'packageIds') {
      setFormData(prev => {
        const currentIds = prev.packageIds;
        const newIds = checked
          ? [...currentIds, value]
          : currentIds.filter(id => id !== value);
        return { ...prev, packageIds: newIds };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setPaymentProof(e.target.files[0]);
    }
  };

  const handleMapSearch = async () => {
    if (!searchQuery) return;
    setSearchingMap(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setMapPosition({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        alert("Location not found.");
      }
    } catch (err) {
      console.error(err);
      alert("Error searching location.");
    } finally {
      setSearchingMap(false);
    }
  };

  const [locatingGPS, setLocatingGPS] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocatingGPS(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to retrieve your location. Please check your browser permissions.");
        setLocatingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Calculate selected packages details
  const selectedPackagesData = packages.filter(p => formData.packageIds.includes(p.id));
  const estimatedTotal = selectedPackagesData.reduce((sum, pkg) => {
    const priceNum = typeof pkg.price === 'string' ? parseInt(pkg.price.replace(/\D/g, ''), 10) : (pkg.price || 0);
    const finalPriceNum = pkg.discountPercent ? priceNum * (1 - pkg.discountPercent / 100) : priceNum;
    return sum + (isNaN(finalPriceNum) ? 0 : finalPriceNum);
  }, 0);
  const packageTitles = selectedPackagesData.map(p => p.title).join(', ');

  const pphPercentage = settings?.pphPercentage || 0;
  const pphAmount = estimatedTotal * (pphPercentage / 100);
  const finalEstimatedTotal = estimatedTotal + pphAmount;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Gagal masuk dengan Google. Silakan coba lagi.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const isInquiryMode = bookingMode === 'inquiry';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.packageIds.length === 0) {
      return setError('Please select at least one package.');
    }
    if (!isInquiryMode) {
      if (!formData.paymentAmount || (parseInt(formData.paymentAmount.replace(/\D/g, ''), 10) || 0) <= 0) {
        return setError('Payments cannot be empty or 0.');
      }
    }
    if (!mapPosition) {
      return setError('Please drop a pin on the map or search for your event location.');
    }
    if (!isInquiryMode) {
      if (!paymentProof) {
        return setError('Please upload your payment proof.');
      }
      if (!formData.agreeTerms) {
        return setError('You must agree to the Terms & Conditions.');
      }
    }

    try {
      setSubmitting(true);
      let currentUser = user;

      if (!user) {
        const result = await register(
          formData.email,
          formData.password,
          formData.fullName,
          formData.phone
        );
        currentUser = result.user;
      }

      // Check max 3 bookings limit (SPAM PROTECTION)
      if (!isAdmin) {
        const bookingsRef = collection(db, 'bookings');
        const q = query(bookingsRef, where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);

        const maxLimit = settings?.maxBookingsPerClient || 3;

        if (querySnapshot.size >= maxLimit) {
          throw new Error(`You have reached the maximum limit of ${maxLimit} bookings per account. Please contact the admin if you would like to add more bookings.`);
        }
      }

      // Upload payment proof (only for direct booking)
      let proofUrl = '';
      if (!isInquiryMode && paymentProof) {
        const timestamp = Date.now();
        const filePath = `bookings/payment_proofs/${currentUser.uid}_${timestamp}_${paymentProof.name}`;
        proofUrl = await uploadFile(paymentProof, filePath);
      }

      const bookingData = {
        userId: currentUser.uid,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        eventDate: formData.eventDate,
        eventTime: formData.eventTime,
        eventAddress: formData.eventAddress,
        shareloc: { lat: mapPosition.lat, lng: mapPosition.lng },
        packageIds: formData.packageIds,
        packagesData: selectedPackagesData.map(p => {
          const priceNum = typeof p.price === 'string' ? parseInt(p.price.replace(/\D/g, ''), 10) : (p.price || 0);
          const discountAmount = p.discountPercent ? (priceNum * (p.discountPercent / 100)) : 0;
          return {
            id: p.id,
            title: p.title,
            price: priceNum,
            discountPercent: p.discountPercent || 0,
            discountAmount: discountAmount,
            finalPrice: priceNum - discountAmount,
            categoryId: p.categoryId || '',
            categoryName: categories?.find(c => c.id === p.categoryId)?.title || '',
            features: p.features || []
          };
        }),
        packageTitle: packageTitles,
        subtotalPrice: estimatedTotal,
        pphPercentage: pphPercentage,
        pphAmount: pphAmount,
        packagePrice: finalEstimatedTotal,
        bookingMode: isInquiryMode ? 'inquiry' : 'direct',
        paymentType: isInquiryMode ? '' : formData.paymentType,
        paymentAmount: isInquiryMode ? 0 : (parseInt(formData.paymentAmount.replace(/\D/g, ''), 10) || 0),
        paymentProofUrl: proofUrl,
        payments: isInquiryMode ? [] : [
          {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            amount: parseInt(formData.paymentAmount.replace(/\D/g, ''), 10) || 0,
            proofUrl: proofUrl,
            status: 'pending',
            createdAt: new Date().toISOString(),
            note: formData.paymentType === 'dp' ? 'Down Payment (DP)' : 'Full Payment (Lunas)'
          }
        ],
        status: isInquiryMode ? 'inquiry' : 'pending',
        createdAt: new Date(),
        hasUnreadUpdates: true,
      };

      const newDocId = await addDocument('bookings', bookingData);

      setSubmittedBooking({ id: newDocId, ...bookingData, createdAt: new Date().toISOString() });
      setSubmitted(true);
    } catch (err) {
      console.error('Booking error:', err);
      setError(err.message || 'An error occurred during booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && submittedBooking) {
    const isInquiryBooking = submittedBooking.bookingMode === 'inquiry';
    const waText = isInquiryBooking
      ? `Halo Admin, saya ingin bertanya ketersediaan jadwal untuk tanggal ${submittedBooking.eventDate || '-'}. Order ID: ${submittedBooking.id}`
      : `Halo Admin, saya baru saja membuat booking baru. Order ID: ${submittedBooking.id}`;

    return (
      <div className="contact-form__success" id="contact-success" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <CheckCircle className="contact-form__success-icon" size={48} />
        <h3 className="contact-form__success-title">
          {isInquiryBooking ? 'Pertanyaan Terkirim!' : 'Booking Successful!'}
        </h3>
        <p className="contact-form__success-text" style={{ marginBottom: '2rem' }}>
          {isInquiryBooking
            ? 'Terima kasih! Pertanyaan ketersediaan jadwal Anda telah kami terima. Admin akan segera menghubungi Anda.'
            : 'Thank you for your booking. Please review and download your invoice below.'
          }
        </p>

        {!isInquiryBooking && <InvoicePreview booking={submittedBooking} settings={settings} />}

        <div style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/my-bookings" className="btn btn-outline">
            Go to My Bookings
          </Link>
          <Link to="/" className="btn btn-outline">
            Back to Home
          </Link>
          <a
            href={settings?.adminWhatsApp ? `https://wa.me/${settings.adminWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(waText)}` : '#'}
            target={settings?.adminWhatsApp ? "_blank" : "_self"}
            onClick={(e) => {
              if (!settings?.adminWhatsApp) {
                e.preventDefault();
                alert("Nomor WhatsApp Admin belum diatur.");
              }
            }}
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <MessageCircle size={18} />
            Contact Admin via WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} id="booking-form">
      <AnimatePresence>
        {error && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backdropFilter: 'blur(10px)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: 'rgba(18, 18, 18, 0.8)', padding: '3rem 2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <AlertCircle size={26} strokeWidth={1.5} />
              </div>
              <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '0 0 1rem 0', fontWeight: 400, fontFamily: 'var(--font-heading, "Playfair Display", serif)', letterSpacing: '0.02em' }}>
                Pemberitahuan
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 2.5rem 0', lineHeight: '1.7', fontSize: '0.9rem', fontWeight: 300 }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => setError('')}
                style={{ background: '#fff', color: '#000', border: 'none', padding: '1rem 2rem', borderRadius: '30px', fontWeight: 500, cursor: 'pointer', width: '100%', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}
                onMouseOver={(e) => { e.target.style.background = '#e5e5e5'; e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 10px 20px rgba(255,255,255,0.1)'; }}
                onMouseOut={(e) => { e.target.style.background = '#fff'; e.target.style.transform = 'none'; e.target.style.boxShadow = 'none'; }}
                onMouseDown={(e) => { e.target.style.transform = 'scale(0.98)'; }}
                onMouseUp={(e) => { e.target.style.transform = 'translateY(-2px)'; }}
              >
                Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Mode Tabs - Moved to top */}
      <div className="booking-section" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 className="booking-section-title" style={{ textAlign: 'center', borderBottom: 'none', paddingBottom: '0.5rem' }}>Select Booking Mode</h3>
        <p className="booking-section-subtitle" style={{ textAlign: 'center', marginTop: 0, marginBottom: '1.5rem' }}>Determine whether you want to check availability or make a booking.</p>
        <div className="booking-mode-tabs" style={{ marginTop: 0, marginBottom: 0 }}>
          <button
            type="button"
            className={`booking-mode-tab ${bookingMode === 'inquiry' ? 'booking-mode-tab--active' : ''}`}
            onClick={() => setBookingMode('inquiry')}
          >
            <span className="booking-mode-tab__icon"><MessageCircle size={22} strokeWidth={1.5} /></span>
            <span className="booking-mode-tab__label">Check Availability</span>
            <span className="booking-mode-tab__desc">Check schedule before booking</span>
          </button>
          <button
            type="button"
            className={`booking-mode-tab ${bookingMode === 'direct' ? 'booking-mode-tab--active' : ''}`}
            onClick={() => setBookingMode('direct')}
          >
            <span className="booking-mode-tab__icon"><CalendarCheck size={22} strokeWidth={1.5} /></span>
            <span className="booking-mode-tab__label">Direct Booking</span>
            <span className="booking-mode-tab__desc">Direct payment & booking</span>
          </button>
        </div>
      </div>

      {!user && (
        <div className="booking-section">
          <h3 className="booking-section-title">Personal Information</h3>
          <p className="booking-section-subtitle">Sign in with Google or register manually by filling in the data below.</p>

          {/* Google Sign-In Button */}
          <button
            type="button"
            className="booking-google-btn"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '20px', height: '20px' }} />
            {googleLoading ? 'Processing...' : 'Sign in / Register with Google'}
          </button>

          <div className="booking-auth-divider">
            <span>OR FILL MANUALLY</span>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input type="text" name="fullName" className="form-input" required
              value={formData.fullName} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone / WhatsApp *</label>
            <input type="tel" name="phone" className="form-input" required
              value={formData.phone} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" name="email" className="form-input" required
              value={formData.email} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input type="password" name="password" className="form-input" required minLength={6}
              value={formData.password} onChange={handleChange} placeholder="Min. 6 characters" />
          </div>
        </div>
      )}

      {user && !isAdmin && (
        <div className="booking-section">
          <h3 className="booking-section-title">Personal Information</h3>
          <p className="booking-section-subtitle">Logged in as {user.displayName || user.email}</p>
          <div className="form-group">
            <label className="form-label">Phone / WhatsApp *</label>
            <input type="tel" name="phone" className="form-input" required
              value={formData.phone} onChange={handleChange} />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="booking-section">
          <h3 className="booking-section-title">Client Information (Admin Manual Booking)</h3>
          <p className="booking-section-subtitle">You are adding a booking on behalf of a client.</p>
          <div className="contact-form__row">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input type="text" name="fullName" className="form-input" required
                value={formData.fullName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Client Email</label>
              <input type="email" name="email" className="form-input"
                value={formData.email} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Client Phone / WhatsApp *</label>
            <input type="tel" name="phone" className="form-input" required
              value={formData.phone} onChange={handleChange} />
          </div>
        </div>
      )}

      <div className="booking-section">
        <h3 className="booking-section-title">Event Details</h3>
        <div className="contact-form__row">
          <div className="form-group">
            <label className="form-label">Event Date *</label>
            <input type="date" name="eventDate" className="form-input" required
              value={formData.eventDate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Event Time *</label>
            <input type="time" name="eventTime" className="form-input" required
              value={formData.eventTime} onChange={handleChange} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Event Address *</label>
          <textarea name="eventAddress" className="form-textarea" required rows={3}
            value={formData.eventAddress} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label className="form-label">Shareloc (Pin Location) *</label>
          <p className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Search for an address or click on the map to place a pin.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search location (e.g. Jakarta Pusat)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapSearch(); } }}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-outline" onClick={handleMapSearch} disabled={searchingMap} title="Search Location" style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={18} />
            </button>
          </div>
          <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', zIndex: 1, position: 'relative' }}>
            <MapContainer ref={setMapInstance} center={[-6.2088, 106.8456]} zoom={11} scrollWheelZoom={true} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 1 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker position={mapPosition} setPosition={setMapPosition} />
              <MapUpdater position={mapPosition} />
            </MapContainer>

            {/* Custom Leaflet Control for Zoom and GPS */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000 }}>
              <div className="leaflet-control leaflet-bar" style={{ display: 'flex', flexDirection: 'column' }}>
                <a
                  href="#"
                  role="button"
                  title="Zoom in"
                  onClick={(e) => { e.preventDefault(); if (mapInstance) mapInstance.zoomIn(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '18px', fontWeight: 'bold' }}
                >
                  +
                </a>
                <a
                  href="#"
                  role="button"
                  title="Zoom out"
                  onClick={(e) => { e.preventDefault(); if (mapInstance) mapInstance.zoomOut(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '18px', fontWeight: 'bold' }}
                >
                  −
                </a>
                <a
                  href="#"
                  role="button"
                  title="My Location"
                  onClick={(e) => { e.preventDefault(); handleGPSLocation(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: locatingGPS ? 0.5 : 1, color: '#333' }}
                >
                  <LocateFixed size={18} />
                </a>
              </div>
            </div>
          </div>
          {mapPosition && (
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--color-accent)' }}>
              Location selected: {mapPosition.lat.toFixed(4)}, {mapPosition.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>

      {/* Package & Payment */}
      <div className="booking-section">
        <h3 className="booking-section-title">Package & Payment</h3>
        <p className="booking-section-subtitle">Select one or more packages for your event.</p>

        {/* Category Filter - Separate Column */}
        {categories && categories.filter(c => !c.isHidden).length > 0 && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Package Category</label>
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  cursor: 'pointer',
                  appearance: 'none',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="">All Categories</option>
                {categories.filter(c => !c.isHidden).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.title}</option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
        )}

        <div className="custom-select-container" ref={dropdownRef}>
          <button
            type="button"
            className="form-input custom-select-button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>
              {formData.packageIds.length > 0
                ? `${formData.packageIds.length} Package(s) Selected`
                : 'Select Packages..'}
            </span>
            <ChevronDown size={18} />
          </button>

          {dropdownOpen && (
            <div className="custom-select-dropdown">
              {loadingPackages ? (
                <div style={{ padding: '1rem', color: '#888' }}>Loading packages...</div>
              ) : (
                <>
                  {packages
                    .filter(pkg => isAdmin ? true : !pkg.isHidden)
                    .filter(pkg => filterCategory === '' || pkg.categoryId === filterCategory)
                    .map((pkg) => (
                      <label key={pkg.id} className="custom-select-option">
                        <input
                          type="checkbox"
                          name="packageIds"
                          value={pkg.id}
                          checked={formData.packageIds.includes(pkg.id)}
                          onChange={handleChange}
                        />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', minWidth: 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                            <span style={{ fontWeight: '600', color: '#E0E0E0', fontSize: '0.9rem', lineHeight: '1.3' }}>{pkg.title}</span>
                            {(() => {
                              const catName = categories?.find(c => c.id === pkg.categoryId)?.title; return catName ? (
                                <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '300', lineHeight: '1.35', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                  {catName}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                            {pkg.discountPercent > 0 ? (
                              <>
                                <span style={{ textDecoration: 'line-through', fontSize: '0.7rem', color: '#555', lineHeight: '1' }}>
                                  {formatRupiah(pkg.price)}
                                </span>
                                <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', lineHeight: '1' }}>
                                  <span style={{ background: 'rgba(201, 169, 110, 0.15)', color: 'var(--color-accent)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                    -{pkg.discountPercent}%
                                  </span>
                                  {formatRupiah((typeof pkg.price === 'string' ? parseInt(pkg.price.replace(/\D/g, ''), 10) : pkg.price) * (1 - pkg.discountPercent / 100))}
                                </span>
                              </>
                            ) : (
                              <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: '600' }}>
                                {formatRupiah(pkg.price)}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  {packages
                    .filter(pkg => isAdmin ? true : !pkg.isHidden)
                    .filter(pkg => filterCategory === '' || pkg.categoryId === filterCategory)
                    .length === 0 && (
                      <div style={{ padding: '1.25rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
                        No packages in this category.
                      </div>
                    )}
                </>
              )}
            </div>
          )}
        </div>

        {selectedPackagesData.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {selectedPackagesData.map((pkg) => {
              const isCollapsed = expandedPkgId === pkg.id;
              return (
                <div key={pkg.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <div
                    onClick={() => setExpandedPkgId(isCollapsed ? null : pkg.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isCollapsed ? <ChevronDown size={16} color="#888" /> : <ChevronUp size={16} color="#888" />}
                      <span style={{ fontWeight: '500', fontSize: '1rem', color: '#fff' }}>{pkg.title}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {pkg.discountPercent > 0 ? (
                        <>
                          <div style={{ textDecoration: 'line-through', fontSize: '0.8rem', color: '#666' }}>
                            {formatRupiah(pkg.price)}
                          </div>
                          <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                            {formatRupiah((typeof pkg.price === 'string' ? parseInt(pkg.price.replace(/\D/g, ''), 10) : pkg.price) * (1 - pkg.discountPercent / 100))}
                          </div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                          {formatRupiah(pkg.price)}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>
                        {categories?.find(c => c.id === pkg.categoryId)?.title || ''}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {(pkg.features || []).map((feat, idx) => (
                          <div key={idx} style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: '1.4' }}>
                            {feat}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {formData.packageIds.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#888', fontSize: '0.9rem' }}>
              <span>Subtotal:</span>
              <span>{formatRupiah(estimatedTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#888', fontSize: '0.9rem' }}>
              <span>Pajak PPh ({pphPercentage}%):</span>
              <span>{formatRupiah(pphAmount)}</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.75rem 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>
                Estimated Total Cost:
              </div>
              <div style={{ fontSize: '1.6rem', color: 'var(--color-accent)', fontWeight: '500' }}>
                {formatRupiah(finalEstimatedTotal)}
              </div>
            </div>
          </div>
        )}

        {/* Bank Transfer Information - only show for direct booking */}
        {!isInquiryMode && settings?.bankName && settings?.bankAccountNumber && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>Bank Transfer Information</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Transfer your payment to the following account.</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Name</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '1rem', fontWeight: 500 }}>{settings.bankName}</p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Number</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.1em', color: '#fff' }}>{settings.bankAccountNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(settings.bankAccountNumber);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (copied ? '#10B981' : 'var(--color-border)'), borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: copied ? '#10B981' : 'var(--color-text-light)', fontSize: '0.85rem', transition: 'all 0.2s' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {settings.bankAccountHolder && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Holder</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 400 }}>{settings.bankAccountHolder}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isInquiryMode && (
          <>
            <div className="contact-form__row" style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Payment Option *</label>
                <select
                  name="paymentType"
                  className="form-input"
                  required
                  value={formData.paymentType}
                  onChange={handleChange}
                >
                  <option value="dp">Down Payment (DP)</option>
                  <option value="lunas">Full Payment</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Amount (Rp) *</label>
                <input
                  type="text"
                  name="paymentAmount"
                  className="form-input"
                  required
                  placeholder="e.g. 5000000"
                  value={formData.paymentAmount}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Upload Payment Proof (Image) *</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                required
                onChange={handleFileChange}
                style={{ padding: '0.5rem' }}
              />
            </div>
          </>
        )}
      </div>



      {/* Terms & Conditions - only show for direct booking */}
      {!isInquiryMode && (
        <div className="booking-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="booking-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Terms & Conditions</h3>
            <button type="button" className="btn-icon" onClick={handlePrintTerms} title="Print Terms as PNG" style={{ color: 'var(--color-text-light)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Printer size={16} />
            </button>
          </div>
          <div ref={termsRef} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1rem', fontSize: '0.85rem', color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {settings?.termsAndConditions || 'No terms and conditions provided.'}
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" name="agreeTerms" required
                checked={formData.agreeTerms} onChange={handleChange} style={{ marginTop: '0.2rem' }} />
              <span style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: 1.4 }}>I agree to the Terms & Conditions of Service.</span>
            </label>
          </div>
        </div>
      )}

      <button
        type="submit"
        className={`btn btn-lg booking-submit-btn ${isInquiryMode ? 'booking-submit-btn--inquiry' : 'btn-primary'}`}
        style={{ width: '100%', padding: '1rem', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        disabled={submitting || uploading}
      >
        {submitting || uploading
          ? 'Processing...'
          : isInquiryMode
            ? 'ASK NOW'
            : 'SUBMIT BOOKING'
        }
      </button>
    </form>
  );
}
