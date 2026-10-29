import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateDocument } from '../../hooks/useFirestore';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useFCM } from '../../hooks/useFCM';
import { useSiteSettings } from '../../hooks/useSiteSettings';

export default function ClientSettings() {
  const { user } = useAuth();
  const { permissionState, requestPermission } = useFCM();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [hasToken, setHasToken] = useState(false);
  const { settings } = useSiteSettings();

  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    newPassword: '',
  });

  useEffect(() => {
    document.title = `Settings — ${settings?.brandName || ''}`;
  }, [settings]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;
        
        setHasToken(!!userData?.fcmToken);
        
        setFormData(prev => ({
          ...prev,
          displayName: userData?.displayName || user.displayName || '',
          phone: userData?.phone || '',
        }));
      }
    };
    fetchUserData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update Firebase Auth Profile
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      // Update Firestore User Document
      await updateDocument('users', user.uid, {
        displayName: formData.displayName,
        phone: formData.phone,
      });

      // Update password if provided
      if (formData.newPassword) {
        await updatePassword(user, formData.newPassword);
        setFormData(prev => ({ ...prev, newPassword: '' }));
      }

      setSuccess('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('To change your password, please log out and log back in first.');
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { fcmToken: null }, { merge: true });
      setHasToken(false);
      setSuccess('Notifications disabled on this device.');
    } catch (err) {
      console.error('Error testing push notification:');
    }
  };

  const handleEnableNotifications = async () => {
    setError('');
    setSuccess('');
    const success = await requestPermission();
    if (success) {
      setHasToken(true);
      setSuccess('Notifications enabled successfully!');
    } else {
      setError('Browser tidak mendukung notifikasi atau izin ditolak.');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Settings</h1>
        <p className="admin-page-subtitle">Manage your personal information and preferences</p>
      </div>

      <div className="admin-tabs-container" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        {/* Mobile Dropdown */}
        <div className="admin-tabs-mobile" style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <select 
            value={activeTab} 
            onChange={(e) => { setActiveTab(e.target.value); setSuccess(''); setError(''); }}
            className="form-input"
            style={{ width: '100%', cursor: 'pointer' }}
          >
            <option value="profile">Profile</option>
            <option value="notifications">Notifications</option>
          </select>
        </div>

        {/* Desktop Tabs */}
        <div className="admin-tabs-desktop" style={{ width: '100%', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              onClick={() => { setActiveTab('profile'); setSuccess(''); setError(''); }}
              style={{
                padding: '0.5rem 1.25rem',
                background: activeTab === 'profile' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid',
                borderColor: activeTab === 'profile' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                color: activeTab === 'profile' ? '#000' : 'var(--color-text-muted)',
                cursor: 'pointer',
                fontWeight: activeTab === 'profile' ? '600' : 'normal',
                transition: 'all 0.2s',
                fontSize: '0.85rem'
              }}
            >
              Profile
            </button>
            <button
              onClick={() => { setActiveTab('notifications'); setSuccess(''); setError(''); }}
              style={{
                padding: '0.5rem 1.25rem',
                background: activeTab === 'notifications' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid',
                borderColor: activeTab === 'notifications' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                color: activeTab === 'notifications' ? '#000' : 'var(--color-text-muted)',
                cursor: 'pointer',
                fontWeight: activeTab === 'notifications' ? '600' : 'normal',
                transition: 'all 0.2s',
                fontSize: '0.85rem'
              }}
            >
              Notifications
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px' }}>
        {error && <div className="form-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
        {success && <div style={{ color: 'var(--color-success)', padding: '0.75rem 0', marginBottom: '1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>✓ {success}</div>}

        {activeTab === 'profile' ? (
          <form onSubmit={handleUpdateProfile} className="admin-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={user?.email || ''}
              disabled
              style={{ opacity: 0.7 }}
            />
            <small style={{ color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>Email cannot be changed.</small>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="displayName"
              className="form-input"
              value={formData.displayName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              className="form-input"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+62 8..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '2rem' }}>
            <label className="form-label">New Password (Optional)</label>
            <input
              type="password"
              name="newPassword"
              className="form-input"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="Leave blank to keep current password"
              minLength={6}
            />
          </div>

          <button type="submit" className="admin-btn admin-btn--primary" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
        ) : (
          <div className="notifications-settings" style={{ paddingTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: '500' }}>
              Push Notifications
            </h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {settings?.notificationTextClient || 'Receive instant updates when your booking status changes or when new album photos are uploaded by the photographer.'}
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '2rem', borderBottom: '1px solid var(--color-border)' }}>
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

            {permissionState === 'denied' && (
              <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                To enable notifications, you need to click the lock icon in your browser's address bar and reset the notification permission.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
