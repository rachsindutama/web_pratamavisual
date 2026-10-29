import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  useFirestoreCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  orderBy,
} from '../../hooks/useFirestore';
import { Plus, Edit2, Trash2, Save, X, Star, Eye, EyeOff, GripVertical, List, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { formatRupiah } from '../../lib/utils';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableCategoryItem({ cat, startEditing, handleDelete, toggleVisibility }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '0.75rem',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    opacity: cat.isHidden ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: '0.25rem' }}>
        <GripVertical size={16} color="#666" />
      </div>
      <div style={{ flex: 1, fontWeight: 500, color: '#FFF' }}>{cat.title}</div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => toggleVisibility(cat)} title={cat.isHidden ? "Show" : "Hide"}>
          {cat.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={() => startEditing(cat)}>
          <Edit2 size={14} />
        </button>
        <button className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon" onClick={() => handleDelete(cat.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function SortablePackageItem({ pkg, startEditing, handleDelete, toggleVisibility, categories }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pkg.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    opacity: pkg.isHidden ? 0.6 : 1,
    boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  };

  const categoryName = categories?.find(c => c.id === pkg.categoryId)?.title;

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: '0.5rem', touchAction: 'none' }}>
        <GripVertical size={20} color="#666" />
      </div>

      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEditing(pkg)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, color: '#FFF' }}>{pkg.title}</span>
          {pkg.highlighted && <Star size={14} style={{ color: 'var(--color-accent)' }} />}
          {categoryName && (
            <span style={{ 
              fontSize: '0.65rem', 
              padding: '0.15rem 0.5rem', 
              borderRadius: '100px', 
              background: 'rgba(255, 255, 255, 0.06)', 
              border: '1px solid rgba(255, 255, 255, 0.08)', 
              color: '#999', 
              fontWeight: 500,
              letterSpacing: '0.02em'
            }}>
              {categoryName}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
          {pkg.discountPercent > 0 ? (
            <>
              <span style={{ textDecoration: 'line-through' }}>{formatRupiah(pkg.price)}</span>
              <span style={{ color: 'var(--color-accent)' }}>
                {formatRupiah(Math.round((typeof pkg.price === 'string' ? parseInt(pkg.price.replace(/\D/g, ''), 10) : pkg.price) * (1 - pkg.discountPercent / 100)))}
              </span>
              <span className="admin-badge admin-badge--primary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>{pkg.discountPercent}% OFF</span>
            </>
          ) : (
            <span>{formatRupiah(pkg.price)}</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={(e) => { e.stopPropagation(); toggleVisibility(pkg); }} title={pkg.isHidden ? "Show" : "Hide"}>
          {pkg.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon" onClick={(e) => { e.stopPropagation(); startEditing(pkg); }}>
          <Edit2 size={16} />
        </button>
        <button className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon" onClick={(e) => { e.stopPropagation(); handleDelete(pkg.id); }}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function ManagePricing() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const { data: packages, loading: packagesLoading, refetch: refetchPackages } = useFirestoreCollection(
    'pricingPackages',
    [orderBy('order', 'asc')]
  );
  // Using pricingCategories instead of categories
  const { data: categories, loading: categoriesLoading, refetch: refetchCategories } = useFirestoreCollection(
    'pricingCategories',
    [orderBy('order', 'asc')]
  );
  
  const [packagesList, setPackagesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [featuresText, setFeaturesText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, type: null }); // type: 'package' | 'category'
  const [activeTab, setActiveTab] = useState('all');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  
  // Category management state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    setPackagesList(packages);
  }, [packages]);

  useEffect(() => {
    setCategoriesList(categories);
  }, [categories]);

  const filteredPackages = packagesList.filter((pkg) => {
    const term = searchTerm.toLowerCase();
    const matchName = pkg.title?.toLowerCase().includes(term);
    const categoryName = categories?.find(c => c.id === pkg.categoryId)?.title || '';
    const matchCategory = categoryName.toLowerCase().includes(term);
    const matchFeatures = pkg.features?.some((f) => f.toLowerCase().includes(term));
    const matchSearch = matchName || matchCategory || matchFeatures;
    
    let matchTab = true;
    if (activeTab === 'hidden') matchTab = pkg.isHidden;
    if (activeTab === 'visible') matchTab = !pkg.isHidden;

    const matchCategoryFilter = filterCategoryId === '' 
      || (filterCategoryId === '__uncategorized' ? (!pkg.categoryId || pkg.categoryId === '') : pkg.categoryId === filterCategoryId);

    return matchSearch && matchTab && matchCategoryFilter;
  });

  const emptyPackage = {
    title: '',
    price: '',
    categoryId: '',
    features: [],
    highlighted: false,
    isHidden: false,
    discountPercent: 0,
    order: packagesList.length + 1,
  };

  const emptyCategory = {
    title: '',
    slug: '',
    order: categoriesList.length + 1,
    isHidden: false,
  };

  useEffect(() => {
    document.title = `Pricing — ${settings?.brandName || ''}`;
  }, [settings]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startEditing = (pkg) => {
    setEditing({ ...pkg });
    setFeaturesText((pkg.features || []).join('\n'));
  };

  const handleSave = async () => {
    if (!editing.title || !editing.price) {
      showToast('Title and price are required.', 'error');
      return;
    }

    try {
      setSaving(true);
      const features = featuresText.split('\n').map((f) => f.trim()).filter(Boolean);
      const data = {
        ...editing,
        features,
        userId: user.uid,
      };
      delete data.id;

      if (editing.id) {
        await updateDocument('pricingPackages', editing.id, data);
        showToast('Package updated!');
      } else {
        await addDocument('pricingPackages', data);
        showToast('Package created!');
      }

      setEditing(null);
      setFeaturesText('');
      await refetchPackages();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory.title) {
      showToast('Title is required.', 'error');
      return;
    }
    try {
      setSaving(true);
      const slug = editingCategory.slug || editingCategory.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const data = {
        title: editingCategory.title,
        slug,
        order: editingCategory.order,
        isHidden: editingCategory.isHidden || false,
        userId: user.uid,
      };

      if (editingCategory.id) {
        await updateDocument('pricingCategories', editingCategory.id, data);
        showToast('Category updated!');
      } else {
        await addDocument('pricingCategories', data);
        showToast('Category created!');
      }

      setEditingCategory(null);
      await refetchCategories();
    } catch (err) {
      console.error('Save category error:', err);
      showToast('Failed to save category.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, type = 'package') => {
    setConfirmModal({ isOpen: true, id, type });
  };

  const confirmDelete = async () => {
    const { id, type } = confirmModal;
    setConfirmModal({ isOpen: false, id: null, type: null });
    if (!id) return;

    try {
      if (type === 'package') {
        await deleteDocument('pricingPackages', id);
        showToast('Package deleted.');
        await refetchPackages();
      } else {
        await deleteDocument('pricingCategories', id);
        showToast('Category deleted.');
        await refetchCategories();
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete.', 'error');
    }
  };

  const toggleVisibility = async (pkg) => {
    const newHidden = !pkg.isHidden;
    setPackagesList(prev => prev.map(p => p.id === pkg.id ? { ...p, isHidden: newHidden } : p));
    showToast(`Package is now ${newHidden ? 'hidden' : 'visible'}.`);

    try {
      await updateDocument('pricingPackages', pkg.id, { isHidden: newHidden });
    } catch (err) {
      setPackagesList(prev => prev.map(p => p.id === pkg.id ? { ...p, isHidden: !newHidden } : p));
      showToast('Failed to toggle visibility.', 'error');
    }
  };

  const toggleCategoryVisibility = async (cat) => {
    const newHidden = !cat.isHidden;
    setCategoriesList(prev => prev.map(c => c.id === cat.id ? { ...c, isHidden: newHidden } : c));
    showToast(`Category is now ${newHidden ? 'hidden' : 'visible'}.`);

    try {
      await updateDocument('pricingCategories', cat.id, { isHidden: newHidden });
    } catch (err) {
      setCategoriesList(prev => prev.map(c => c.id === cat.id ? { ...c, isHidden: !newHidden } : c));
      showToast('Failed to toggle visibility.', 'error');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndPackages = async (event) => {
    if (searchTerm || activeTab !== 'all' || filterCategoryId !== '') return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPackagesList((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);

        const bulkUpdate = async () => {
          try {
            const updatePromises = newArray.map((pkg, index) =>
              updateDocument('pricingPackages', pkg.id, { order: index + 1 })
            );
            await Promise.all(updatePromises);
          } catch (e) {
            showToast('Failed to save order.', 'error');
          }
        };
        bulkUpdate();
        return newArray;
      });
    }
  };

  const handleDragEndCategories = async (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCategoriesList((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);

        const bulkUpdate = async () => {
          try {
            const updatePromises = newArray.map((cat, index) =>
              updateDocument('pricingCategories', cat.id, { order: index + 1 })
            );
            await Promise.all(updatePromises);
          } catch (e) {
            showToast('Failed to save order.', 'error');
          }
        };
        bulkUpdate();
        return newArray;
      });
    }
  };

  return (
    <div id="admin-manage-pricing">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Pricing Packages</h1>
          <p className="admin-header__subtitle">Manage your service packages and categories</p>
        </div>
        {!editing && !categoryModalOpen && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input admin-search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: '1 1 150px', maxWidth: '200px', margin: 0 }}
            />
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                style={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #333', 
                  color: '#fff', 
                  padding: '0.5rem 2rem 0.5rem 0.75rem', 
                  borderRadius: '8px', 
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  minWidth: '160px',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                }}
              >
                <option value="">All Categories</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.title}</option>
                ))}
                <option value="__uncategorized">Uncategorized</option>
              </select>
            </div>
            <button
              className="admin-btn admin-btn--secondary"
              onClick={() => setCategoryModalOpen(true)}
              style={{ whiteSpace: 'nowrap' }}
            >
              <List size={16} />
              Manage Categories
            </button>
            <button
              className="admin-btn admin-btn--primary"
              onClick={() => { setEditing({ ...emptyPackage }); setFeaturesText(''); }}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Plus size={16} />
              Add Package
            </button>
          </div>
        )}
      </div>

      {/* Category Manager Modal */}
      <AnimatePresence>
        {categoryModalOpen && (
          <div className="admin-modal-overlay" onClick={() => !editingCategory && setCategoryModalOpen(false)}>
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '600px' }}
            >
              <div className="admin-modal__header">
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <List size={16} /> Pricing Categories
                </h3>
                <button className="admin-modal__close" onClick={() => !editingCategory && setCategoryModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body" style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {editingCategory ? (
                  <div style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '8px', border: '1px solid #333' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#fff' }}>{editingCategory.id ? 'Edit Category' : 'New Category'}</h4>
                    <div className="form-group">
                      <label className="form-label">Category Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editingCategory.title}
                        onChange={(e) => setEditingCategory({ ...editingCategory, title: e.target.value })}
                        placeholder="e.g., Wedding Packages"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Slug (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editingCategory.slug || ''}
                        onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                        placeholder="e.g., wedding-packages"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button className="admin-btn admin-btn--secondary" onClick={() => setEditingCategory(null)}>Cancel</button>
                      <button className="admin-btn admin-btn--primary" onClick={handleSaveCategory} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Category'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button 
                      className="admin-btn admin-btn--primary" 
                      style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}
                      onClick={() => setEditingCategory({ ...emptyCategory })}
                    >
                      <Plus size={16} /> Add New Category
                    </button>

                    {categoriesList.length > 0 ? (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCategories}>
                        <SortableContext items={categoriesList.map(c => c.id)} strategy={verticalListSortingStrategy}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {categoriesList.map((cat) => (
                              <SortableCategoryItem
                                key={cat.id}
                                cat={cat}
                                startEditing={() => setEditingCategory({ ...cat })}
                                handleDelete={(id) => handleDelete(id, 'category')}
                                toggleVisibility={toggleCategoryVisibility}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <p style={{ textAlign: 'center', color: '#666', margin: '2rem 0' }}>No categories found.</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit / Create Form Modal */}
      <AnimatePresence>
        {editing && (
          <div className="admin-modal-overlay" onClick={() => { setEditing(null); setFeaturesText(''); }}>
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
                    <><Edit2 size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Edit Package</>
                  ) : (
                    <><Plus size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> New Package</>
                  )}
                </h3>
                <button className="admin-modal__close" onClick={() => { setEditing(null); setFeaturesText(''); }}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body" style={{ padding: '1.5rem' }}>
                <div className="admin-grid-2-col">
                  <div className="form-group">
                    <label className="form-label">Package Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editing.title}
                      onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Basic Package"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editing.price}
                      onChange={(e) => setEditing((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="e.g., Rp 5.000.000"
                    />
                  </div>
                </div>

                <div className="admin-grid-2-col">
                  <div className="form-group">
                    <label className="form-label">Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={editing.discountPercent || ''}
                      onChange={(e) => setEditing((prev) => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discounted Price</label>
                    <div style={{ padding: '0.6rem 0.75rem', background: '#1a1a1a', borderRadius: 'var(--radius-sm)', border: '1px solid #333', minHeight: '42px', display: 'flex', alignItems: 'center' }}>
                      {editing.discountPercent > 0 ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#666', marginRight: '0.5rem', fontSize: '0.9rem' }}>{formatRupiah(editing.price || 0)}</span>
                          <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                            {formatRupiah(Math.round((typeof editing.price === 'string' ? parseInt(editing.price.replace(/\D/g, ''), 10) || 0 : editing.price || 0) * (1 - editing.discountPercent / 100)))}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>
                          {formatRupiah(editing.price || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={editing.categoryId || ''}
                    onChange={(e) => setEditing((prev) => ({ ...prev, categoryId: e.target.value }))}
                    style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                  >
                    <option value="">Select Category...</option>
                    {categories?.filter(c => !c.isHidden).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.title}</option>
                    ))}
                  </select>
                  {categories?.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>No categories created yet. Click "Manage Categories" to add one.</p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Features (one per line)</label>
                  <textarea
                    className="form-textarea"
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    placeholder="50 edited photos&#10;Online gallery&#10;2 hour session"
                    rows={5}
                  />
                </div>

                <div className="admin-grid-2-col">
                  <div className="form-group">
                    <label className="form-label">Visibility</label>
                    <button
                      type="button"
                      className={`admin-btn ${!editing.isHidden ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
                      onClick={() => setEditing((prev) => ({ ...prev, isHidden: !prev.isHidden }))}
                      style={{ marginTop: '0.25rem' }}
                    >
                      {editing.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      {editing.isHidden ? 'Hidden' : 'Visible'}
                    </button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Highlighted / Popular</label>
                    <button
                      type="button"
                      className={`admin-btn ${editing.highlighted ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
                      onClick={() => setEditing((prev) => ({ ...prev, highlighted: !prev.highlighted }))}
                      style={{ marginTop: '0.25rem' }}
                    >
                      <Star size={14} />
                      {editing.highlighted ? 'Highlighted' : 'Normal'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#0a0a0a' }}>
                <button className="admin-btn admin-btn--secondary" onClick={() => { setEditing(null); setFeaturesText(''); }}>
                  Cancel
                </button>
                <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Package'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Package List */}
      {!packagesLoading && packages.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #333' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'all' ? '#fff' : '#666', borderBottom: activeTab === 'all' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >All Packages</button>
            <button
              onClick={() => setActiveTab('visible')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'visible' ? '#fff' : '#666', borderBottom: activeTab === 'visible' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Visible</button>
            <button
              onClick={() => setActiveTab('hidden')}
              style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'hidden' ? '#fff' : '#666', borderBottom: activeTab === 'hidden' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
            >Hidden</button>
          </div>
          {filteredPackages.length > 0 ? (
            <>
              <>
                {searchTerm || activeTab !== 'all' || filterCategoryId !== '' ? (
                  <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#666' }}>Drag and drop disabled while searching or filtering.</div>
                ) : (
                  <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#666' }}>Drag and drop to reorder packages.</div>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndPackages}
                >
                  <SortableContext
                    items={filteredPackages.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {filteredPackages.map((pkg) => (
                        <SortablePackageItem
                          key={pkg.id}
                          pkg={pkg}
                          categories={categories}
                          startEditing={startEditing}
                          handleDelete={(id) => handleDelete(id, 'package')}
                          toggleVisibility={toggleVisibility}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            </>
          ) : (
            !editing && (
              <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: '#666' }}>No packages match your search.</p>
              </div>
            )
          )}
        </>
      )}

      {!packagesLoading && packages.length === 0 && !editing && (
        <div className="admin-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#666' }}>No pricing packages yet. Click "Add Package" to create one.</p>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={`Delete ${confirmModal.type === 'package' ? 'Pricing Package' : 'Category'}`}
        message={`Are you sure you want to delete this ${confirmModal.type === 'package' ? 'pricing package' : 'category'}?`}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null, type: null })}
      />
    </div>
  );
}
