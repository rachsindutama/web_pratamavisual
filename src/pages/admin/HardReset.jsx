import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSiteSettings } from '../../hooks/useSiteSettings';

const COLLECTIONS = [
  { id: 'albumPhotos', label: 'Album Photos' },
  { id: 'albums', label: 'Albums' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'cashflowCategories', label: 'Cashflow Categories' },
  { id: 'categories', label: 'Categories' },
  { id: 'fileServerAccess', label: 'File Server Access' },
  { id: 'fileTags', label: 'File Tags' },
  { id: 'pricingCategories', label: 'Pricing Categories' },
  { id: 'pricingPackages', label: 'Pricing Packages' },
  { id: 'settings', label: 'Settings' },
  { id: 'siteSettings', label: 'Site Settings' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'users', label: 'Users' },
  { id: 'videos', label: 'Videos' },
  { id: 'visitors', label: 'Visitors' },
];

export default function HardReset() {
  const [selected, setSelected] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState('');
  const [toast, setToast] = useState(null);
  const { settings } = useSiteSettings();

  useEffect(() => {
    document.title = `Hard Reset — ${settings?.brandName || ''}`;
  }, [settings]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSelection = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selected.length === COLLECTIONS.length) {
      setSelected([]);
    } else {
      setSelected(COLLECTIONS.map(c => c.id));
    }
  };

  // Recursively find Firebase Storage URLs or explicit storage paths
  const extractStorageRefs = (obj) => {
    let refs = [];
    if (!obj) return refs;

    if (typeof obj === 'string') {
      if (obj.includes('firebasestorage.googleapis.com')) {
        refs.push(obj);
      }
      return refs;
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => {
        refs = refs.concat(extractStorageRefs(item));
      });
      return refs;
    }

    if (typeof obj === 'object') {
      const knownPathKeys = ['storagePath', 'thumbStoragePath', 'imageStoragePath'];
      for (const [key, value] of Object.entries(obj)) {
        if (knownPathKeys.includes(key) && typeof value === 'string') {
          refs.push(value);
        } else {
          refs = refs.concat(extractStorageRefs(value));
        }
      }
    }
    return refs;
  };

  const executeReset = async () => {
    if (confirmText !== 'RESET') {
      showToast('You must type RESET to confirm.', 'error');
      return;
    }

    try {
      setIsDeleting(true);
      setProgress('Initializing...');

      let totalDeletedDocs = 0;
      let totalDeletedFiles = 0;

      for (const colName of selected) {
        setProgress(`Fetching ${colName}...`);
        const snapshot = await getDocs(collection(db, colName));
        const docs = snapshot.docs;

        let i = 0;
        for (const document of docs) {
          i++;
          setProgress(`Deleting from ${colName}: ${i}/${docs.length}`);

          const data = document.data();
          const storageRefs = extractStorageRefs(data);

          // Delete associated files in Firebase storage
          for (const fileRef of storageRefs) {
            try {
              const fileStorageRef = ref(storage, fileRef);
              await deleteObject(fileStorageRef);
              totalDeletedFiles++;
            } catch (err) {
              console.error(`Failed to delete file ${fileRef}:`, err);
            }
          }

          // Delete from Cloudinary if it exists
          if (data.cloudinaryPublicId) {
            try {
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('../../lib/firebase');
              const deleteImg = httpsCallable(functions, 'deleteCloudinaryImage');
              await deleteImg({ publicId: data.cloudinaryPublicId });
              totalDeletedFiles++;
            } catch (err) {
              console.error(`Failed to delete Cloudinary file ${data.cloudinaryPublicId}:`, err);
            }
          }

          // Delete firestore document
          await deleteDoc(doc(db, colName, document.id));
          totalDeletedDocs++;
        }
      }

      showToast(`Success! Deleted ${totalDeletedDocs} documents and ${totalDeletedFiles} files.`);
      setSelected([]);
      setIsModalOpen(false);
      setConfirmText('');
    } catch (err) {
      console.error('Hard reset error:', err);
      showToast('An error occurred during reset. Check console for details.', 'error');
    } finally {
      setIsDeleting(false);
      setProgress('');
    }
  };

  return (
    <div id="admin-hard-reset">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title" style={{ color: 'var(--color-danger)' }}>Hard Reset</h1>
          <p className="admin-header__subtitle">Permanently delete data and associated files.</p>
        </div>
      </div>

      <div className="admin-card" style={{ border: '1px solid var(--color-danger)' }}>
        <div className="admin-card__header">
          <h2 className="admin-card__title">Select Collections to Clear</h2>
          <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={toggleAll}>
            {selected.length === COLLECTIONS.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {COLLECTIONS.map((col) => (
            <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: '#111', borderRadius: '8px', border: '1px solid #222' }}>
              <input
                type="checkbox"
                checked={selected.includes(col.id)}
                onChange={() => toggleSelection(col.id)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-danger)' }}
              />
              <span style={{ color: '#fff', fontWeight: 500 }}>{col.label}</span>
              <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: 'auto' }}>({col.id})</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #222', paddingTop: '1.5rem' }}>
          <button
            className="admin-btn admin-btn--danger"
            disabled={selected.length === 0}
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600 }}
          >
            <AlertTriangle size={20} />
            Reset Selected ({selected.length})
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="admin-modal-overlay">
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ border: '2px solid var(--color-danger)' }}
            >
              <div className="admin-modal__header" style={{ borderBottomColor: '#331111', background: '#220505' }}>
                <h3 style={{ margin: 0, color: 'var(--color-danger)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} />
                  Confirm Mass Deletion
                </h3>
                <button className="admin-modal__close" onClick={() => !isDeleting && setIsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body">
                <p style={{ color: '#ccc', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  You are about to permanently delete all documents and their associated Storage files (images, proofs) for the following collections:
                </p>
                <ul style={{ color: '#fff', marginBottom: '1.5rem', paddingLeft: '1.25rem', fontFamily: 'monospace' }}>
                  {selected.map(id => <li key={id}>{id}</li>)}
                </ul>
                <p style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '1.5rem' }}>
                  This action CANNOT be undone.
                </p>

                <div className="form-group">
                  <label className="form-label">Type <strong>RESET</strong> to confirm:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESET"
                    disabled={isDeleting}
                    style={{ borderColor: confirmText === 'RESET' ? 'var(--color-success)' : 'var(--color-border)' }}
                  />
                </div>

                {isDeleting && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
                    <div style={{ color: 'var(--color-accent)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                      {progress}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '1.25rem', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: '#0a0a0a' }}>
                <button
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="admin-btn admin-btn--danger"
                  onClick={executeReset}
                  disabled={isDeleting || confirmText !== 'RESET'}
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'PERMANENTLY DELETE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
