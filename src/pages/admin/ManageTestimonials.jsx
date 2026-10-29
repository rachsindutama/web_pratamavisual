import { useState, useEffect } from 'react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { useAuth } from '../../contexts/AuthContext';
import {
  useFirestoreCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  orderBy,
} from '../../hooks/useFirestore';
import { Plus, Edit2, Trash2, Save, X, Check, EyeOff, Eye } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { formatDate } from '../../utils/formatDate';
import { motion, AnimatePresence } from 'framer-motion';

export default function ManageTestimonials() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const { data: testimonials, loading, refetch } = useFirestoreCollection('testimonials', [
    orderBy('createdAt', 'desc'),
  ]);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [activeTab, setActiveTab] = useState('all');

  const filteredTestimonials = testimonials.filter((t) => {
    if (activeTab === 'hidden') return t.status === 'hidden';
    if (activeTab === 'visible') return t.status === 'approved';
    if (activeTab === 'pending') return t.status === 'pending';
    return true;
  });

  const emptyTestimonial = {
    clientName: '',
    message: '',
    status: 'approved',
    createdAtDate: new Date().toISOString().split('T')[0],
  };

  useEffect(() => {
    document.title = `Testimonials — ${settings?.brandName || ''}`;
  }, [settings]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!editing.clientName || !editing.message) {
      showToast('Name and message are required.', 'error');
      return;
    }

    try {
      setSaving(true);
      const data = {
        clientName: editing.clientName,
        message: editing.message,
        status: editing.status,
      };

      if (editing.createdAtDate) {
        data.createdAt = new Date(editing.createdAtDate);
      }

      if (editing.id) {
        await updateDocument('testimonials', editing.id, data);
        showToast('Testimonial updated!');
      } else {
        await addDocument('testimonials', { ...data, userId: 'admin' });
        showToast('Testimonial created!');
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

  const handleUpdateStatus = async (id, status) => {
    try {
      await updateDocument('testimonials', id, { status });
      showToast(`Testimonial marked as ${status}`);
    } catch (err) {
      console.error('Update status error:', err);
      showToast('Failed to update status', 'error');
    }
  };

  return (
    <div id="admin-manage-testimonials">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Testimonials</h1>
          <p className="admin-header__subtitle">Manage client feedback and reviews</p>
        </div>
        {!editing && (
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => setEditing({ ...emptyTestimonial })}
          >
            <Plus size={16} />
            Add Manual Testimonial
          </button>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <div className="admin-modal-overlay" onClick={() => setEditing(null)}>
            <motion.div
              className="admin-modal admin-modal--md"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal__header">
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>
                  {editing.id ? 'Edit Testimonial' : 'New Testimonial'}
                </h3>
                <button className="admin-modal__close" onClick={() => setEditing(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body">
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editing.clientName}
                    onChange={(e) => setEditing((prev) => ({ ...prev, clientName: e.target.value }))}
                    placeholder="e.g. John & Jane"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editing.createdAtDate || ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, createdAtDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Testimonial Message *</label>
                  <textarea
                    className="form-textarea"
                    value={editing.message}
                    onChange={(e) => setEditing((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Write the testimonial here..."
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={editing.status}
                    onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="approved">Approved (Public)</option>
                    <option value="pending">Pending</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#0a0a0a' }}>
                <button className="admin-btn admin-btn--secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!loading && testimonials.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #333' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'all' ? '#fff' : '#666', borderBottom: activeTab === 'all' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >All Testimonials</button>
            <button
              onClick={() => setActiveTab('visible')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'visible' ? '#fff' : '#666', borderBottom: activeTab === 'visible' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Approved</button>
            <button
              onClick={() => setActiveTab('pending')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'pending' ? '#fff' : '#666', borderBottom: activeTab === 'pending' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Pending</button>
            <button
              onClick={() => setActiveTab('hidden')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'hidden' ? '#fff' : '#666', borderBottom: activeTab === 'hidden' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Hidden</button>
          </div>
          {filteredTestimonials.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredTestimonials.map((t) => {
                let dateStr = new Date().toISOString().split('T')[0];
                if (t.createdAt) {
              const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
              if (!isNaN(tDate)) {
                dateStr = tDate.toISOString().split('T')[0];
              }
            }
            
            return (
              <div 
                key={t.id} 
                className="admin-card" 
                style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => setEditing({ ...t, createdAtDate: dateStr })}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#fff', marginBottom: '0.25rem' }}>{t.clientName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Submitted on {formatDate(t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt)}</div>
                  </div>
                  <span className={`admin-badge admin-badge--${t.status === 'approved' ? 'success' : t.status === 'pending' ? 'warning' : 'secondary'}`}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ color: '#ccc', lineHeight: 1.6, margin: '0 0 1.5rem 0', fontStyle: 'italic' }}>
                  "{t.message}"
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', borderTop: '1px solid #1e1e1e', paddingTop: '1rem' }}>
                  {t.status !== 'approved' && (
                    <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, 'approved'); }} title="Unhide">
                      <Eye size={14} /> Unhide
                    </button>
                  )}
                  {t.status === 'approved' && (
                    <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, 'hidden'); }} title="Hide">
                      <EyeOff size={14} /> Hide
                    </button>
                  )}
                  <button className="admin-btn admin-btn--secondary admin-btn--sm" onClick={(e) => { e.stopPropagation(); setEditing({ ...t, createdAtDate: dateStr }); }}>
                    <Edit2 size={14} /> Edit
                  </button>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
            </div>
          ) : (
            <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#666' }}>No testimonials found in this category.</p>
            </div>
          )}
        </>
      )}

      {!loading && testimonials.length === 0 && !editing && (
        <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#666' }}>No testimonials yet.</p>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Testimonial"
        message="Are you sure you want to delete this testimonial? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
}
