import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, deleteField, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Loader2, Bell, BellOff } from 'lucide-react';
import { optimizeImageUrl } from '../../lib/utils';
import { useFCM } from '../../hooks/useFCM';

export default function SiteSettings() {
  const { user } = useAuth();
  const { permissionState, requestPermission } = useFCM();
  const [hasToken, setHasToken] = useState(false);
  const [activeTab, setActiveTab] = useState('brand');
  const [settings, setSettings] = useState({
    brandName: '',
    faviconUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    footerLinks: {
      aboutMe: { label: 'About me', url: '#', heading: 'FIND OUT MORE' },
      instagram: { label: 'Instagram', url: '#', heading: 'FOLLOW ME ON' },
      connect: { label: 'Connect', url: '/booking', heading: 'GET IN TOUCH' },
    },
    portfolioHero: {
      imageUrl: '',
      title: 'Our Best Portfolio',
      subtitle: 'Capturing moments that matter.',
      buttonText: 'VIEW PRICING',
    },
    loginCover: {
      imageUrl: '',
      headline: '',
      tagline: '',
      location: 'Surabaya · Jawa Timur',
    },
    achievements: [
      { number: '26+', description: 'This is a paragraph. Click edit and enter your own text.' },
      { number: '15+', description: 'This is a paragraph. Click edit and enter your own text.' },
      { number: '109+', description: 'This is a paragraph. Click edit and enter your own text.' },
      { number: '3', description: 'This is a paragraph. Click edit and enter your own text.' }
    ],
    sectionTitles: {
      portfolio: 'Portfolio',
      achievements: 'Achievements',
      testimonials: 'Client Stories',
    },
    achievementsSubtitle: '',
    copyrightText: '',
    pricingTitle: '',
    pricingSubtitle: '',
    contactTitle: '',
    contactSubtitle: '',
    termsAndConditions: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    adminWhatsApp: '',
    notificationTextAdmin: 'Receive instant updates when a client books a session or submits a testimonial.',
    notificationTextClient: 'Dapatkan notifikasi jika status booking Anda berubah atau saat album foto Anda sudah siap!',
    defaultEstimatedDays: 30,
    maxRevisions: 3,
    maxBookingsPerClient: 3,
    companyName: '',
    ahuNumber: '',
    pphPercentage: 0,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingLoginCover, setUploadingLoginCover] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.title = `Site Settings — ${settings.brandName || ''}`;
    fetchSettings();
    fetchAdminToken();
  }, []);

  useEffect(() => {
    if (settings.brandName) {
      document.title = `Site Settings — ${settings.brandName}`;
    }
  }, [settings.brandName]);

  const fetchAdminToken = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setHasToken(!!userSnap.data().fcmToken);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'siteSettings', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // If funFacts exists, it means we haven't properly migrated and deleted it yet.
        // It should take precedence over achievements because achievements might have been accidentally saved as defaults.
        if (data.funFacts) {
          data.achievements = data.funFacts;
        }
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const settingsToSave = { ...settings };
      if (settingsToSave.navLinks) {
        delete settingsToSave.navLinks;
      }

      // Ensure legacy funFacts is deleted from Firestore
      settingsToSave.funFacts = deleteField();

      await setDoc(doc(db, 'siteSettings', user.uid), {
        ...settingsToSave,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDisableNotifications = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { fcmToken: null }, { merge: true });
      setHasToken(false);
      showToast('Notifications disabled on this device.');
    } catch (err) {
      showToast('Failed to disable notifications.', 'error');
    }
  };

  const handleEnableNotifications = async () => {
    const success = await requestPermission();
    if (success) {
      setHasToken(true);
      showToast('Notifications enabled successfully!');
    } else {
      if (permissionState === 'unsupported' || !('Notification' in window)) {
        showToast('Browser ini tidak mendukung notifikasi. Coba tambahkan ke Home Screen.', 'error');
      } else {
        showToast('Gagal mengaktifkan notifikasi. Coba periksa izin browser.', 'error');
      }
    }
  };

  const updateField = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };



  const updateFooterLink = (key, subKey, value) => {
    setSettings((prev) => ({
      ...prev,
      footerLinks: {
        ...prev.footerLinks,
        [key]: { ...prev.footerLinks[key], [subKey]: value },
      },
    }));
  };

  const updatePortfolioHero = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      portfolioHero: { ...prev.portfolioHero, [field]: value },
    }));
  };

  const updateLoginCover = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      loginCover: { ...prev.loginCover, [field]: value },
    }));
  };

  const handleLoginCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadingLoginCover(true);
      const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
      const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'webportfolio/siteSettings');
      const response = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      updateLoginCover('imageUrl', data.secure_url);
      showToast('Login cover image uploaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to upload login cover image.', 'error');
    } finally {
      setUploadingLoginCover(false);
    }
  };

  const updateAchievement = (index, field, value) => {
    setSettings((prev) => {
      const existingArray = prev.achievements || prev.funFacts || [];
      const newFacts = [...existingArray];
      newFacts[index] = { ...newFacts[index], [field]: value };

      const nextSettings = { ...prev, achievements: newFacts };
      if (nextSettings.funFacts) delete nextSettings.funFacts;
      return nextSettings;
    });
  };

  const updateSectionTitle = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      sectionTitles: { ...prev.sectionTitles, [field]: value },
    }));
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingFavicon(true);
      const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
      const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', `webportfolio/siteSettings`);

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload favicon to Cloudinary');
      }

      const data = await response.json();
      updateField('faviconUrl', data.secure_url);
      showToast('Favicon uploaded successfully!', 'success');
    } catch (err) {
      console.error('Error uploading favicon:', err);
      showToast('Failed to upload favicon.', 'error');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleHeroImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingHero(true);

      const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
      const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', `webportfolio/siteSettings`);

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload hero image to Cloudinary');
      }

      const data = await response.json();
      updatePortfolioHero('imageUrl', data.secure_url);
      showToast('Hero image uploaded successfully!', 'success');
    } catch (err) {
      console.error('Error uploading hero image:', err);
      showToast('Failed to upload hero image.', 'error');
    } finally {
      setUploadingHero(false);
    }
  };

  return (
    <div id="admin-site-settings">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Site Settings</h1>
          <p className="admin-header__subtitle">Customize your website content and appearance</p>
        </div>
        <button
          className="admin-btn admin-btn--primary admin-btn--sticky"
          onClick={handleSave}
          disabled={saving}
          title="Save Changes"
        >
          {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
        </button>
      </div>

      <div className="admin-tabs-container" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        {/* Mobile Dropdown */}
        <div className="admin-tabs-mobile" style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="form-input"
            style={{ width: '100%', cursor: 'pointer' }}
          >
            {[
              { id: 'brand', label: 'Brand & General' },
              { id: 'seo', label: 'SEO Settings' },
              { id: 'titles', label: 'Section Titles' },
              { id: 'hero', label: 'Portfolio Hero' },
              { id: 'logincover', label: 'Login Cover' },
              { id: 'achievements', label: 'Achievements' },
              { id: 'footer', label: 'Footer Links' },
              { id: 'bank', label: 'Bank Account' },
              { id: 'terms', label: 'Terms & Conditions' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'workflow', label: 'Project Workflow' }
            ].map(tab => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>

        {/* Desktop Tabs */}
        <div className="admin-tabs-desktop" style={{ width: '100%', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[
              { id: 'brand', label: 'Brand & General' },
              { id: 'seo', label: 'SEO Settings' },
              { id: 'titles', label: 'Section Titles' },
              { id: 'hero', label: 'Portfolio Hero' },
              { id: 'logincover', label: 'Login Cover' },
              { id: 'achievements', label: 'Achievements' },
              { id: 'footer', label: 'Footer Links' },
              { id: 'bank', label: 'Bank Account' },
              { id: 'terms', label: 'Terms & Conditions' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'workflow', label: 'Project Workflow' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: activeTab === tab.id ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid',
                  borderColor: activeTab === tab.id ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  color: activeTab === tab.id ? '#000' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? '600' : 'normal',
                  transition: 'all 0.2s',
                  fontSize: '0.85rem'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'notifications' && (
        <>
          {/* Notifications */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={18} /> Push Notifications
              </h2>
            </div>

            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {settings.notificationTextAdmin || 'Receive instant updates when a client books a session or submits a testimonial.'}
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem', fontWeight: '500' }}>Device Notifications</h4>

                {permissionState === 'granted' && hasToken ? (
                  <p style={{ color: 'var(--color-success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }}></span>
                    Active on this device
                  </p>
                ) : permissionState === 'denied' ? (
                  <p style={{ color: '#ff4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4444', display: 'inline-block' }}></span>
                    Blocked by browser settings
                  </p>
                ) : permissionState === 'unsupported' ? (
                  <p style={{ color: '#ff4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4444', display: 'inline-block' }}></span>
                    Tidak didukung browser ini (Coba 'Add to Home Screen')
                  </p>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-text-muted)', display: 'inline-block' }}></span>
                    Currently disabled
                  </p>
                )}
              </div>

              <div>
                {permissionState === 'granted' && hasToken ? (
                  <button onClick={handleDisableNotifications} className="admin-btn" style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    Disable
                  </button>
                ) : permissionState !== 'denied' && permissionState !== 'unsupported' ? (
                  <button onClick={handleEnableNotifications} className="admin-btn admin-btn--primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    Turn On
                  </button>
                ) : null}
              </div>
            </div>

            <div className="admin-card__header" style={{ marginTop: '1rem' }}>
              <h2 className="admin-card__title">Notification Text Settings</h2>
            </div>
            <div className="form-group">
              <label className="form-label">Admin Notification Prompt</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={settings.notificationTextAdmin || ''}
                onChange={(e) => setSettings({ ...settings, notificationTextAdmin: e.target.value })}
                placeholder="Text to show to admins about notifications"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Client Notification Prompt</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={settings.notificationTextClient || ''}
                onChange={(e) => setSettings({ ...settings, notificationTextClient: e.target.value })}
                placeholder="Text to show to clients about notifications"
              />
            </div>

            {permissionState === 'denied' && (
              <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                To enable notifications, you need to click the lock icon in your browser's address bar and reset the notification permission.
              </p>
            )}
          </div>
        </>
      )}

      {activeTab === 'workflow' && (
        <>
          {/* Project Workflow */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Project Workflow</h2>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Configure automation rules and constraints for the booking project lifecycle.
            </p>
            <div className="admin-grid-3-col">
              <div className="form-group">
                <label className="form-label">Default Estimated Completion (Days)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.defaultEstimatedDays || 0}
                  onChange={(e) => updateField('defaultEstimatedDays', parseInt(e.target.value) || 0)}
                  placeholder="e.g., 30"
                  min="0"
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                  The default number of days after the event date when the project is expected to be finished.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Max Revisions for Estimated Date</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.maxRevisions || 0}
                  onChange={(e) => updateField('maxRevisions', parseInt(e.target.value) || 0)}
                  placeholder="e.g., 3"
                  min="0"
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                  Maximum number of times the estimated date can be changed before it is locked.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Max Bookings Per Client</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.maxBookingsPerClient || 3}
                  onChange={(e) => updateField('maxBookingsPerClient', parseInt(e.target.value) || 3)}
                  placeholder="e.g., 3"
                  min="1"
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                  Maximum number of times a client can submit a booking before being blocked.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'brand' && (
        <>
          {/* Brand & General */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Brand & General</h2>
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Favicon Icon (max 1MB)</label>
              {settings.faviconUrl && (
                <div style={{ marginBottom: '1rem', width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: '#fff' }}>
                  <img src={settings.faviconUrl} alt="Favicon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <input
                type="file"
                accept="image/png, image/jpeg, image/x-icon, image/svg+xml, image/webp"
                onChange={handleFaviconUpload}
                disabled={uploadingFavicon}
                className="form-input"
                style={{ padding: '0.5rem' }}
              />
              {uploadingFavicon && <p style={{ color: 'var(--color-accent)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Uploading...</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Brand Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.brandName}
                onChange={(e) => updateField('brandName', e.target.value)}
                placeholder="e.g., RACHSINDUTAMA"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Copyright Text</label>
              <input
                type="text"
                className="form-input"
                value={settings.copyrightText}
                onChange={(e) => updateField('copyrightText', e.target.value)}
                placeholder="e.g., © 2026 Rachsindutama"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Admin WhatsApp Number</label>
              <input
                type="text"
                className="form-input"
                value={settings.adminWhatsApp || ''}
                onChange={(e) => updateField('adminWhatsApp', e.target.value)}
                placeholder="e.g., 6281234567890 (Start with country code)"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Address</label>
              <textarea
                className="form-input"
                value={settings.vendorAddress || ''}
                onChange={(e) => updateField('vendorAddress', e.target.value)}
                placeholder="Enter vendor's full address"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Email</label>
              <input
                type="email"
                className="form-input"
                value={settings.vendorEmail || ''}
                onChange={(e) => updateField('vendorEmail', e.target.value)}
                placeholder="e.g., admin@pratamavisual.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nama PT/Perusahaan</label>
              <input
                type="text"
                className="form-input"
                value={settings.companyName || ''}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="e.g., PT Pratama Visual"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nomor AHU</label>
              <input
                type="text"
                className="form-input"
                value={settings.ahuNumber || ''}
                onChange={(e) => updateField('ahuNumber', e.target.value)}
                placeholder="e.g., AHU-0012345.AH.01.02.Tahun 2026"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pajak PPh Percentage (%)</label>
              <input
                type="number"
                className="form-input"
                value={settings.pphPercentage || 0}
                onChange={(e) => updateField('pphPercentage', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 11"
                min="0"
                step="0.1"
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'seo' && (
        <>
          {/* SEO Settings */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">SEO Settings</h2>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Tingkatkan performa website Anda di mesin pencari seperti Google, dan ubah tampilan ketika link website dibagikan di media sosial atau WhatsApp.
            </p>

            <div className="form-group">
              <label className="form-label">SEO Title (Meta Title)</label>
              <input
                type="text"
                className="form-input"
                value={settings.seoTitle || ''}
                onChange={(e) => updateField('seoTitle', e.target.value)}
                placeholder="e.g., Rachsindutama | Profesional Photography Portfolio"
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>Judul website yang akan muncul di tab browser dan judul utama di Google (Disarankan: 50-60 karakter).</p>
            </div>

            <div className="form-group">
              <label className="form-label">SEO Description (Meta Description)</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={settings.seoDescription || ''}
                onChange={(e) => updateField('seoDescription', e.target.value)}
                placeholder="e.g., Portofolio fotografi Rachsindutama. Melayani jasa foto wedding, prewedding, produk, dan komersial."
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>Deskripsi singkat tentang website atau layanan Anda. Muncul di bawah judul pada hasil pencarian Google (Disarankan: 150-160 karakter).</p>
            </div>

            <div className="form-group">
              <label className="form-label">Keywords</label>
              <input
                type="text"
                className="form-input"
                value={settings.seoKeywords || ''}
                onChange={(e) => updateField('seoKeywords', e.target.value)}
                placeholder="e.g., fotografer jakarta, jasa foto wedding, portofolio fotografi"
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>Pisahkan setiap kata kunci dengan koma (,).</p>
            </div>

          </div>
        </>
      )}

      {activeTab === 'titles' && (
        <>
          {/* Section Titles */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Section Titles</h2>
            </div>
            <div className="admin-grid-3-col">
              <div className="form-group">
                <label className="form-label">Portfolio Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.sectionTitles?.portfolio || ''}
                  onChange={(e) => updateSectionTitle('portfolio', e.target.value)}
                  placeholder="e.g., Portfolio"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Achievements Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.sectionTitles?.achievements || ''}
                  onChange={(e) => updateSectionTitle('achievements', e.target.value)}
                  placeholder="e.g., Achievements"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Testimonials Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.sectionTitles?.testimonials || ''}
                  onChange={(e) => updateSectionTitle('testimonials', e.target.value)}
                  placeholder="e.g., Client Stories"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Videos Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.sectionTitles?.videos || ''}
                  onChange={(e) => updateSectionTitle('videos', e.target.value)}
                  placeholder="e.g., Cinematic Videos"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'hero' && (
        <>
          {/* Portfolio Hero */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Portfolio Hero Section</h2>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Hero Background Image</label>
              {settings.portfolioHero?.imageUrl && (
                <div style={{ marginBottom: '1rem', width: '100%', maxWidth: '400px', height: '200px', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={settings.portfolioHero.imageUrl} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleHeroImageUpload}
                disabled={uploadingHero}
                className="form-input"
                style={{ padding: '0.5rem' }}
              />
              {uploadingHero && <p style={{ color: 'var(--color-accent)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Uploading...</p>}
            </div>

            <div className="admin-grid-2-col">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.portfolioHero?.title || ''}
                  onChange={(e) => updatePortfolioHero('title', e.target.value)}
                  placeholder="e.g., Our Best Portfolio"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subtitle</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.portfolioHero?.subtitle || ''}
                  onChange={(e) => updatePortfolioHero('subtitle', e.target.value)}
                  placeholder="e.g., Special offer for wedding packages"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Button Text</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.portfolioHero?.buttonText || ''}
                  onChange={(e) => updatePortfolioHero('buttonText', e.target.value)}
                  placeholder="e.g., VIEW PRICING"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'logincover' && (
        <>
          {/* Login Cover */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Login Cover (Desktop)</h2>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Foto dan teks yang muncul di sisi kiri halaman login (hanya tampil di desktop / layar lebar).
            </p>

            {/* Image Upload */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Cover Image</label>
              {settings.loginCover?.imageUrl && (
                <div style={{ marginBottom: '1rem', width: '100%', maxWidth: '400px', height: '220px', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={settings.loginCover.imageUrl} alt="Login Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLoginCoverUpload}
                disabled={uploadingLoginCover}
                className="form-input"
                style={{ padding: '0.5rem' }}
              />
              {uploadingLoginCover && <p style={{ color: 'var(--color-accent)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Uploading...</p>}
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                Gunakan foto landscape yang dramatis dan sinematik. Disarankan: 1200×800px ke atas.
              </p>
            </div>

            <div className="admin-grid-2-col">
              {/* Headline */}
              <div className="form-group">
                <label className="form-label">Headline</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.loginCover?.headline || ''}
                  onChange={(e) => updateLoginCover('headline', e.target.value)}
                  placeholder="e.g., Pratamavisual | Fotografer Wedding Surabaya"
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                  Judul besar di cover. Gunakan ' — ' (spasi-dash-spasi) untuk memisahkan sub-judul yang lebih kecil dan miring.
                </p>
              </div>

              {/* Tagline */}
              <div className="form-group">
                <label className="form-label">Tagline</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.loginCover?.tagline || ''}
                  onChange={(e) => updateLoginCover('tagline', e.target.value)}
                  placeholder="e.g., Where your love story finds its light."
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                  Kalimat pendek di bawah headline. Kosongkan untuk otomatis pakai SEO Description.
                </p>
              </div>

              {/* Location */}
              <div className="form-group">
                <label className="form-label">Location Text</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.loginCover?.location || ''}
                  onChange={(e) => updateLoginCover('location', e.target.value)}
                  placeholder="e.g., Surabaya · Jawa Timur"
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                  Teks kecil di pojok kanan bawah cover.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'achievements' && (
        <>
          {/* Achievements */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Achievements</h2>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Achievements Subtitle</label>
              <input
                type="text"
                className="form-input"
                value={settings.achievementsSubtitle || ''}
                onChange={(e) => updateField('achievementsSubtitle', e.target.value)}
                placeholder="e.g., Discover what we have achieved over the years"
              />
            </div>

            <div className="admin-grid-2-col" style={{ gap: '1.5rem' }}>
              {(settings.achievements || settings.funFacts)?.map((fact, index) => (
                <div key={index} style={{ padding: '1rem', border: '1px solid #1E1E1E', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Achievement {index + 1}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id={`hide-achievement-${index}`}
                        checked={fact.isHidden || false}
                        onChange={(e) => updateAchievement(index, 'isHidden', e.target.checked)}
                        style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
                      />
                      <label htmlFor={`hide-achievement-${index}`} style={{ margin: 0, cursor: 'pointer', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Hide
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Number / Heading</label>
                    <input
                      type="text"
                      className="form-input"
                      value={fact.number || ''}
                      onChange={(e) => updateAchievement(index, 'number', e.target.value)}
                      placeholder="e.g., 26+"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={fact.description || ''}
                      onChange={(e) => updateAchievement(index, 'description', e.target.value)}
                      placeholder="e.g., This is a paragraph..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'footer' && (
        <>
          {/* Footer Links */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Footer Links</h2>
            </div>
            {Object.entries(settings.footerLinks).map(([key, link]) => (
              <div key={key} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #1E1E1E' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                    {key === 'aboutMe' ? 'About Me' : key === 'instagram' ? 'Instagram' : 'Connect'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id={`hide-${key}`}
                      checked={link.isHidden || false}
                      onChange={(e) => updateFooterLink(key, 'isHidden', e.target.checked)}
                      style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
                    />
                    <label htmlFor={`hide-${key}`} style={{ margin: 0, cursor: 'pointer', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Hide
                    </label>
                  </div>
                </div>
                <div className="admin-grid-3-col">
                  <div className="form-group">
                    <label className="form-label">Heading</label>
                    <input
                      type="text"
                      className="form-input"
                      value={link.heading || ''}
                      onChange={(e) => updateFooterLink(key, 'heading', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label</label>
                    <input
                      type="text"
                      className="form-input"
                      value={link.label || ''}
                      onChange={(e) => updateFooterLink(key, 'label', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">URL</label>
                    <input
                      type="text"
                      className="form-input"
                      value={link.url || ''}
                      onChange={(e) => updateFooterLink(key, 'url', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'bank' && (
        <>
          {/* Bank Account */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Bank Account</h2>
            </div>
            <div className="admin-grid-3-col">
              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.bankName || ''}
                  onChange={(e) => updateField('bankName', e.target.value)}
                  placeholder="e.g., BCA"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.bankAccountNumber || ''}
                  onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                  placeholder="e.g., 3251612977"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Account Holder Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.bankAccountHolder || ''}
                  onChange={(e) => updateField('bankAccountHolder', e.target.value)}
                  placeholder="e.g., Rachmad Sindu Pratama"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'terms' && (
        <>
          {/* Terms & Conditions */}
          <div className="admin-card">
            <div className="admin-card__header">
              <h2 className="admin-card__title">Terms & Conditions</h2>
            </div>
            <div className="form-group">
              <label className="form-label">Client Booking Terms</label>
              <textarea
                className="form-textarea"
                rows={8}
                value={settings.termsAndConditions || ''}
                onChange={(e) => updateField('termsAndConditions', e.target.value)}
                placeholder="Enter the terms and conditions that clients must agree to when booking..."
              />
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
