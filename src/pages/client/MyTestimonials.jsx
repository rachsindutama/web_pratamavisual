import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  useFirestoreCollection,
  addDocument,
  updateDocument,
  orderBy,
  deleteDocument
} from '../../hooks/useFirestore';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { formatDate } from '../../utils/formatDate';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/admin.css';

export default function MyTestimonials() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const { data: testimonials, loading, refetch } = useFirestoreCollection('testimonials', [
    orderBy('createdAt', 'desc'),
  ]);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  const userTestimonials = testimonials.filter(t => t.userId === user?.uid);

  useEffect(() => {
    document.title = `My Testimonials — ${settings?.brandName || ''}`;
  }, [settings]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.message) {
      showToast('Please write a message.', 'error');
      return;
    }

    try {
      setSaving(true);
      const data = {
        message: editing.message,
        clientName: user.displayName || editing.clientName || 'Valued Client',
      };

      if (editing.id) {
        await updateDocument('testimonials', editing.id, {
          ...data,
          status: 'pending' // Re-submit for approval after edit
        });
        showToast('Testimonial updated and sent for review!');
      } else {
        await addDocument('testimonials', { 
          ...data, 
          userId: user.uid,
          status: 'pending'
        });
        showToast('Testimonial submitted successfully!');
      }

      setEditing(null);
      await refetch();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    const id = confirmModal.id;
    setConfirmModal({ isOpen: false, id: null });
    if (!id) return;

    try {
      await deleteDocument('testimonials', id);
      showToast('Testimonial deleted.');
      await refetch();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete.', 'error');
    }
  };

  return (
    <div style={{ paddingBottom: '4rem', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: '0.5rem' }}>My Testimonials</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Share your experience working with us.
          </p>
        </div>
        {!editing && (
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => setEditing({ message: '', clientName: user?.displayName || '' })}
          >
            <Plus size={16} />
            Write Testimonial
          </button>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="admin-card"
            style={{ marginBottom: '2rem', border: '1px solid var(--color-accent)' }}
          >
            <div className="admin-card__header">
              <h3 className="admin-card__title">{editing.id ? 'Edit Testimonial' : 'Write a Testimonial'}</h3>
              <button className="admin-modal__close" onClick={() => setEditing(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Your Name (Display Name)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editing.clientName}
                  onChange={(e) => setEditing({ ...editing, clientName: e.target.value })}
                  placeholder="How you want your name to appear"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  className="form-textarea"
                  value={editing.message}
                  onChange={(e) => setEditing({ ...editing, message: e.target.value })}
                  placeholder="Tell us about your experience..."
                  rows={5}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Submitting...' : 'Submit Testimonial'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && userTestimonials.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {userTestimonials.map((t) => (
            <div key={t.id} className="admin-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#fff', marginBottom: '0.25rem' }}>{t.clientName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>Submitted on {formatDate(t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt)}</div>
                </div>
                {t.status !== 'hidden' && (
                  <span className={`admin-badge admin-badge--${t.status === 'approved' ? 'success' : t.status === 'pending' ? 'warning' : 'secondary'}`}>
                    {t.status.toUpperCase()}
                  </span>
                )}
              </div>
              <p style={{ color: '#ccc', lineHeight: 1.6, margin: '0 0 1.5rem 0', fontStyle: 'italic' }}>
                "{t.message}"
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', borderTop: '1px solid #1e1e1e', paddingTop: '1rem' }}>
                <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setEditing({ ...t })}>
                  <Edit2 size={14} /> Edit
                </button>
                <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => handleDelete(t.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && !editing && (
          <div className="admin-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: '#666', margin: 0 }}>You haven't shared any testimonials yet.</p>
          </div>
        )
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Testimonial"
        message="Are you sure you want to delete this testimonial? It will be removed from the website."
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
}
