import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  useFirestoreCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  orderBy,
} from '../../hooks/useFirestore';
import { Plus, Edit2, Trash2, Save, X, Video, GripVertical, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../components/ui/ConfirmModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableVideoItem({ vid, setEditing, handleDelete, handleToggleVisibility }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: vid.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: vid.isHidden ? 0.6 : 1 }}
      className="admin-album-item"
      onClick={() => setEditing({ ...vid })}
    >
      <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: '0.5rem', touchAction: 'none', display: 'flex', alignItems: 'center' }}>
        <GripVertical size={20} color="#666" />
      </div>
      <div className="admin-album-item__cover" style={{ width: '120px', aspectRatio: '16/9', borderRadius: '4px', overflow: 'hidden' }}>
        {vid.thumbnailUrl ? (
          <img src={vid.thumbnailUrl} alt={vid.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#1E1E1E' }} />
        )}
      </div>
      <div className="admin-album-item__info">
        <h4 className="admin-album-item__title">{vid.title}</h4>
      </div>
      <div className="admin-album-item__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon"
          onClick={(e) => { e.stopPropagation(); handleToggleVisibility(vid); }}
          title={vid.isHidden ? "Show Video" : "Hide Video"}
        >
          {vid.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon"
          onClick={(e) => { e.stopPropagation(); setEditing({ ...vid }); }}
          title="Edit"
        >
          <Edit2 size={12} />
        </button>
        <button
          className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon"
          onClick={(e) => { e.stopPropagation(); handleDelete(vid.id); }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function ManageVideos() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const { data: dbVideos, loading, refetch } = useFirestoreCollection(
    'videos',
    [orderBy('order', 'asc')]
  );
  const [localVideos, setLocalVideos] = useState([]);
  const [editing, setEditing] = useState(null); // null or video object
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [activeTab, setActiveTab] = useState('all');

  const filteredVideos = localVideos.filter(vid => {
    if (activeTab === 'hidden') return vid.isHidden;
    if (activeTab === 'visible') return !vid.isHidden;
    return true;
  });

  // Sync local state with DB when not dragging
  useEffect(() => {
    if (dbVideos) {
      setLocalVideos([...dbVideos]);
    }
  }, [dbVideos]);

  const emptyVideo = {
    title: '',
    description: '',
    youtubeUrl: '',
    order: localVideos.length > 0 ? Math.max(...localVideos.map(v => v.order || 0)) + 1 : 1,
  };

  useEffect(() => {
    document.title = `Videos — ${settings?.brandName || ''}`;
  }, [settings]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const extractYouTubeId = (url) => {
    if (!url) return null;
    let videoId = '';
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes('youtube.com') && parsedUrl.searchParams.has('v')) {
        videoId = parsedUrl.searchParams.get('v');
      } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.slice(1);
      } else {
        if (url.length === 11) {
            videoId = url;
        }
      }
    } catch (e) {
      if (url.length === 11) {
          videoId = url;
      }
    }
    return videoId || null;
  };

  const handleSave = async () => {
    if (!editing.title || !editing.youtubeUrl) {
      showToast('Title and YouTube URL are required.', 'error');
      return;
    }

    try {
      setSaving(true);
      
      const videoId = extractYouTubeId(editing.youtubeUrl);
      if (!videoId) {
        showToast('Invalid YouTube URL.', 'error');
        setSaving(false);
        return;
      }

      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      
      const data = {
        title: editing.title,
        description: editing.description || '',
        youtubeUrl: editing.youtubeUrl,
        embedUrl,
        thumbnailUrl,
        order: editing.order,
        userId: user.uid,
      };

      if (editing.id) {
        await updateDocument('videos', editing.id, data);
        showToast('Video updated!');
      } else {
        await addDocument('videos', data);
        showToast('Video added!');
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
      await deleteDocument('videos', id);
      showToast('Video deleted.');
      await refetch();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete.', 'error');
    }
  };

  const handleToggleVisibility = async (vid) => {
    try {
      const newStatus = !vid.isHidden;
      await updateDocument('videos', vid.id, { isHidden: newStatus });
      setLocalVideos((prev) => prev.map((v) => v.id === vid.id ? { ...v, isHidden: newStatus } : v));
      showToast(`Video is now ${newStatus ? 'hidden' : 'visible'}.`);
    } catch (err) {
      console.error('Toggle visibility error:', err);
      showToast('Failed to change visibility.', 'error');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event) => {
    if (activeTab !== 'all') return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalVideos((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);

        const bulkUpdate = async () => {
          try {
            const updatePromises = newArray.map((vid, index) =>
              updateDocument('videos', vid.id, { order: index + 1 })
            );
            await Promise.all(updatePromises);
          } catch (e) {
            console.error('Failed to update order', e);
            showToast('Failed to save order.', 'error');
          }
        };
        bulkUpdate();

        return newArray;
      });
    }
  };

  return (
    <div id="admin-manage-videos">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Videos</h1>
          <p className="admin-header__subtitle">Manage your cinematic video gallery. Drag and drop to reorder.</p>
        </div>
        {!editing && (
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => setEditing({ ...emptyVideo })}
          >
            <Plus size={16} />
            Add Video
          </button>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <div className="admin-modal-overlay" onClick={() => setEditing(null)}>
            <motion.div
              className="admin-modal admin-modal--lg"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal__header">
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>
                  {editing.id ? (
                    <><Edit2 size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Edit Video</>
                  ) : (
                    <><Plus size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> New Video</>
                  )}
                </h3>
                <button className="admin-modal__close" onClick={() => setEditing(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body" style={{ padding: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Video Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editing.title}
                    onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Cinematic Prewedding di Bromo"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">YouTube Link *</label>
                  <input
                    type="url"
                    className="form-input"
                    value={editing.youtubeUrl}
                    onChange={(e) => setEditing((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                    placeholder="e.g., https://www.youtube.com/watch?v=T64XN4zX13g"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={editing.description}
                    onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Short description about the video..."
                  />
                </div>

                {editing.youtubeUrl && extractYouTubeId(editing.youtubeUrl) && (
                  <div className="form-group" style={{ maxWidth: '400px' }}>
                     <label className="form-label">Thumbnail Preview</label>
                     <img 
                        src={`https://img.youtube.com/vi/${extractYouTubeId(editing.youtubeUrl)}/maxresdefault.jpg`} 
                        alt="Preview" 
                        style={{ width: '100%', borderRadius: '8px', border: '1px solid #333' }}
                        onError={(e) => { e.target.src = `https://img.youtube.com/vi/${extractYouTubeId(editing.youtubeUrl)}/hqdefault.jpg`; }}
                     />
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#0a0a0a' }}>
                <button className="admin-btn admin-btn--secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Video'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!loading && localVideos.length > 0 && (
        <div className="admin-card">
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #333' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'all' ? '#fff' : '#666', borderBottom: activeTab === 'all' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >All Videos</button>
            <button
              onClick={() => setActiveTab('visible')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'visible' ? '#fff' : '#666', borderBottom: activeTab === 'visible' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Visible</button>
            <button
              onClick={() => setActiveTab('hidden')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'hidden' ? '#fff' : '#666', borderBottom: activeTab === 'hidden' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Hidden</button>
          </div>
          {activeTab !== 'all' ? (
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#666' }}>Drag and drop disabled while filtering.</div>
          ) : (
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#666' }}>Drag and drop to reorder videos.</div>
          )}
          {filteredVideos.length > 0 ? (
            <div className="admin-album-list">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredVideos.map(v => v.id)}
                  strategy={verticalListSortingStrategy}
                >
                {filteredVideos.map((vid) => (
                  <SortableVideoItem
                    key={vid.id}
                    vid={vid}
                    setEditing={setEditing}
                    handleDelete={handleDelete}
                    handleToggleVisibility={handleToggleVisibility}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#666' }}>No videos found in this category.</p>
            </div>
          )}
        </div>
      )}

      {!loading && localVideos.length === 0 && !editing && (
        <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Video size={48} style={{ margin: '0 auto 1rem', color: '#333' }} />
          <p style={{ color: '#666' }}>No videos yet. Click "Add Video" to get started.</p>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Video"
        message="Are you sure you want to delete this video from your gallery?"
        confirmText="Delete Video"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
}
