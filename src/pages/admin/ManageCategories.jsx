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
import { Plus, Edit2, Trash2, Save, X, Upload, Eye, EyeOff, GripVertical } from 'lucide-react';
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTableRow({ cat, onEdit, onToggleVisibility, onDelete, isDragDisabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (cat.isHidden ? 0.6 : 1),
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
    background: isDragging ? '#1a1a1a' : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} onClick={() => onEdit(cat)} className="admin-table-row-clickable">
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div {...attributes} {...listeners} style={{ cursor: isDragDisabled ? 'not-allowed' : 'grab', color: isDragDisabled ? '#333' : '#666', padding: '4px', display: 'flex' }} onClick={e => e.stopPropagation()}>
            <GripVertical size={16} />
          </div>
        </div>
      </td>
      <td>
        {cat.coverImageUrl ? (
          <img src={cat.coverImageUrl} alt={cat.title} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 50, height: 50, background: '#1E1E1E', borderRadius: 4 }} />
        )}
      </td>
      <td style={{ fontWeight: 500, color: '#FFF' }}>{cat.title}</td>
      <td style={{ color: '#666' }}>{cat.slug}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={(e) => onToggleVisibility(e, cat)} title={cat.isHidden ? "Show Category" : "Hide Category"}>
            {cat.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => onEdit(cat)} title="Edit Category">
            <Edit2 size={12} />
          </button>
          <button className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon" onClick={() => onDelete(cat.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function SortableMobileCard({ cat, onEdit, onToggleVisibility, onDelete, isDragDisabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (cat.isHidden ? 0.6 : 1),
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="mobile-card mobile-card--row" onClick={() => onEdit(cat)}>
      <div {...attributes} {...listeners} style={{ cursor: isDragDisabled ? 'not-allowed' : 'grab', color: isDragDisabled ? '#333' : '#666', padding: '0.5rem', marginRight: '0.5rem', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        <GripVertical size={16} />
      </div>
      <div className="mobile-card__image-container">
        {cat.coverImageUrl ? (
          <img src={cat.coverImageUrl} alt={cat.title} className="mobile-card__image" />
        ) : (
          <div className="mobile-card__image-placeholder" />
        )}
      </div>
      <div className="mobile-card__title" style={{ flex: 1, marginLeft: '1rem' }}>
        {cat.title}
      </div>
      <div className="mobile-card__right" onClick={(e) => e.stopPropagation()}>
        <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={(e) => onToggleVisibility(e, cat)} title={cat.isHidden ? "Show Category" : "Hide Category"}>
          {cat.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => onEdit(cat)}>
          <Edit2 size={14} />
        </button>
        <button className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon" onClick={() => onDelete(cat.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
export default function ManageCategories() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const { data: categories, loading, refetch } = useFirestoreCollection(
    'categories',
    [orderBy('order', 'asc')]
  );
  const [editing, setEditing] = useState(null); // null or category object
  const [coverFile, setCoverFile] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('all');

  const filteredCategories = categories.filter((c) => {
    if (activeTab === 'hidden') return c.isHidden;
    if (activeTab === 'visible') return !c.isHidden;
    return true;
  });

  const emptyCategory = {
    title: '',
    slug: '',
    coverImageUrl: '',
    order: categories.length + 1,
    isHidden: false,
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (active && over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      
      try {
        setSaving(true);
        const updates = newCategories.map((cat, index) => {
          const newOrder = index + 1;
          if (cat.order !== newOrder) {
            return updateDocument('categories', cat.id, { order: newOrder });
          }
          return null;
        }).filter(Boolean);
        
        if (updates.length > 0) {
            await Promise.all(updates);
            showToast('Order updated successfully!');
            await refetch();
        }
      } catch (err) {
        console.error('Update order error:', err);
        showToast('Failed to update order.', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  useEffect(() => {
    document.title = `Categories — ${settings?.brandName || ''}`;
  }, [settings]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
  };

  const handleSave = async () => {
    if (!editing.title) {
      showToast('Title is required.', 'error');
      return;
    }

    try {
      setSaving(true);
      
      let coverImageUrl = editing.coverImageUrl || '';
      if (coverFile) {
        setUploadProgress(0);
        
        const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
        const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned';

        const formData = new FormData();
        formData.append('file', coverFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', `webportfolio/categories`);

        // We use XMLHttpRequest here to keep the progress bar working
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(progress);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              coverImageUrl = response.secure_url;
              resolve();
            } else {
              reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload.'));
          xhr.send(formData);
        });
      }
      
      const slug = editing.slug || generateSlug(editing.title);
      const data = {
        title: editing.title,
        slug,
        order: editing.order,
        coverImageUrl,
        userId: user.uid,
      };

      if (editing.id) {
        await updateDocument('categories', editing.id, data);
        showToast('Category updated!');
      } else {
        await addDocument('categories', data);
        showToast('Category created!');
      }

      setEditing(null);
      setCoverFile(null);
      setUploadProgress(0);
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
      await deleteDocument('categories', id);
      showToast('Category deleted.');
      await refetch();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete.', 'error');
    }
  };

  const handleToggleVisibility = async (e, cat) => {
    e.stopPropagation();
    try {
      const newStatus = !cat.isHidden;
      await updateDocument('categories', cat.id, { isHidden: newStatus });
      showToast(`Category is now ${newStatus ? 'hidden' : 'visible'}.`);
      await refetch();
    } catch (err) {
      console.error('Toggle visibility error:', err);
      showToast('Failed to change visibility.', 'error');
    }
  };

  return (
    <div id="admin-manage-categories">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Categories</h1>
          <p className="admin-header__subtitle">Manage your categories (e.g. Wedding, Prewedding)</p>
        </div>
        {!editing && (
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => { setEditing({ ...emptyCategory }); setCoverFile(null); }}
          >
            <Plus size={16} />
            Add Category
          </button>
        )}
      </div>

      {/* Edit / Create Form */}
      {/* Edit / Create Form Modal */}
      <AnimatePresence>
        {editing && (
          <div className="admin-modal-overlay" onClick={() => { setEditing(null); setCoverFile(null); }}>
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
                    <><Edit2 size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Edit Category</>
                  ) : (
                    <><Plus size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> New Category</>
                  )}
                </h3>
                <button className="admin-modal__close" onClick={() => { setEditing(null); setCoverFile(null); }}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body" style={{ padding: '1.5rem' }}>
                <div className="admin-grid-2-col">
                  <div className="form-group">
                    <label className="form-label">Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editing.title}
                      onChange={(e) => {
                        setEditing((prev) => ({
                          ...prev,
                          title: e.target.value,
                          slug: generateSlug(e.target.value),
                        }));
                      }}
                      placeholder="e.g., Wedding"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Slug (URL)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editing.slug}
                      onChange={(e) => setEditing((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="e.g., wedding"
                    />
                  </div>

                </div>

                {/* Image Uploads */}
                <div className="form-group" style={{ maxWidth: '400px' }}>
                  <label className="form-label">Cover Image (Category Grid)</label>
                  {coverFile ? (
                    <img src={URL.createObjectURL(coverFile)} alt="Cover Preview" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8, marginBottom: '0.5rem' }} />
                  ) : editing.coverImageUrl ? (
                    <img src={editing.coverImageUrl} alt="Cover" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8, marginBottom: '0.5rem' }} />
                  ) : null}
                  <label className="admin-upload" style={{ padding: '1rem', cursor: 'pointer' }}>
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    <Upload size={20} style={{ margin: '0 auto 0.5rem', display: 'block', color: '#555' }} />
                    <p className="admin-upload__text">Upload cover image</p>
                  </label>
                </div>

                {saving && coverFile && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#222', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#fff' }}>
                      <span>Uploading Image...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#444', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.2s ease-out' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#0a0a0a' }}>
                <button className="admin-btn admin-btn--secondary" onClick={() => { setEditing(null); setCoverFile(null); }}>
                  Cancel
                </button>
                <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? (uploadProgress > 0 ? 'Uploading...' : 'Saving...') : 'Save Category'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category List */}
      {!loading && categories.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #333' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'all' ? '#fff' : '#666', borderBottom: activeTab === 'all' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >All</button>
            <button
              onClick={() => setActiveTab('visible')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'visible' ? '#fff' : '#666', borderBottom: activeTab === 'visible' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Visible</button>
            <button
              onClick={() => setActiveTab('hidden')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'hidden' ? '#fff' : '#666', borderBottom: activeTab === 'hidden' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Hidden</button>
          </div>
          
          {filteredCategories.length > 0 ? (
            <>
              {activeTab !== 'all' && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 165, 0, 0.1)', color: 'orange', borderRadius: 4, fontSize: '0.85rem' }}>
                  Drag and drop to reorder is only available in the "All" tab.
                </div>
              )}
              {/* Desktop Table */}
              <div className="admin-card hide-on-mobile">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}></th>
                        <th>Cover</th>
                        <th>Title</th>
                        <th>Slug</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <SortableContext items={filteredCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {filteredCategories.map((cat) => (
                          <SortableTableRow
                            key={cat.id}
                            cat={cat}
                            onEdit={(c) => { setEditing({ ...c }); setCoverFile(null); }}
                            onToggleVisibility={handleToggleVisibility}
                            onDelete={handleDelete}
                            isDragDisabled={activeTab !== 'all'}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </table>
                </DndContext>
              </div>

              {/* Mobile Card List */}
              <div className="mobile-card-list">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {filteredCategories.map((cat) => (
                      <SortableMobileCard
                        key={cat.id}
                        cat={cat}
                        onEdit={(c) => { setEditing({ ...c }); setCoverFile(null); }}
                        onToggleVisibility={handleToggleVisibility}
                        onDelete={handleDelete}
                        isDragDisabled={activeTab !== 'all'}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </>
          ) : (
            <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#666' }}>No categories found in this tab.</p>
            </div>
          )}
        </>
      )}

      {!loading && categories.length === 0 && !editing && (
        <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#666' }}>No categories yet. Click "Add Category" to get started.</p>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Category"
        message="Are you sure you want to delete this category? This will not delete the galleries/photos inside it."
        confirmText="Delete Category"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
}
