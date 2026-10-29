import { useState, useEffect } from 'react';
import { collection, query, where, orderBy as fbOrderBy, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  useFirestoreCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  orderBy,
} from '../../hooks/useFirestore';
import { compressImage } from '../../lib/utils';
import { Upload, Trash2, Image, Plus, FolderOpen, Edit2, Save, X, ChevronDown, GripVertical, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../components/ui/ConfirmModal';
import SortablePhotoItem from '../../components/admin/SortablePhotoItem';
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
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableAlbumItem({ album, selectedAlbum, setSelectedAlbum, handleEditAlbum, handleDeleteAlbum, handleToggleVisibility }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: album.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: album.isHidden ? 0.6 : 1 }}
      className={`admin-album-item ${selectedAlbum === album.id ? 'admin-album-item--active' : ''}`}
      onClick={() => {
        setSelectedAlbum(album.id);
        handleEditAlbum(album);
      }}
    >
      <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: '0.5rem', touchAction: 'none', display: 'flex', alignItems: 'center' }}>
        <GripVertical size={20} color="#666" />
      </div>
      <div className="admin-album-item__cover">
        {album.coverImageUrl ? (
          <img src={album.coverImageUrl} alt={album.title} />
        ) : (
          <div className="admin-album-item__placeholder">
            <FolderOpen size={20} />
          </div>
        )}
      </div>
      <div className="admin-album-item__info">
        <h4 className="admin-album-item__title">{album.title}</h4>
        <span className="admin-album-item__meta">
          {album.photoCount || 0} photos {album.date && `· ${album.date}`}
        </span>
      </div>
      <div className="admin-album-item__actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon"
          onClick={(e) => { e.stopPropagation(); handleToggleVisibility(album); }}
          title={album.isHidden ? "Show Album" : "Hide Album"}
        >
          {album.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          className="admin-btn admin-btn--secondary admin-btn--sm admin-btn--icon"
          onClick={(e) => { e.stopPropagation(); handleEditAlbum(album); }}
          title="Edit"
        >
          <Edit2 size={12} />
        </button>
        <button
          className="admin-btn admin-btn--danger admin-btn--sm admin-btn--icon"
          onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album); }}
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function ManageAlbums() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const { data: categories, loading: categoriesLoading } = useFirestoreCollection(
    'categories',
    [orderBy('order', 'asc')]
  );
  const { data: bookings } = useFirestoreCollection('bookings');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, data: null });
  const [activeTab, setActiveTab] = useState('all');

  // Album form state
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [albumForm, setAlbumForm] = useState({
    categoryId: '',
    clientId: '',
    title: '',
    subtitle: '',
    date: '',
    description: '',
  });
  const [albumCoverFile, setAlbumCoverFile] = useState(null);
  const [albumPhotosFiles, setAlbumPhotosFiles] = useState([]);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  useEffect(() => {
    document.title = `Albums — ${settings?.brandName || ''}`;
  }, [settings]);

  // Fetch albums when category changes
  useEffect(() => {
    fetchAlbums();
  }, [selectedCategory]);

  // Fetch photos when album changes
  useEffect(() => {
    if (selectedAlbum) {
      fetchPhotos();
    } else {
      setPhotos([]);
    }
  }, [selectedAlbum]);

  const fetchAlbums = async () => {
    try {
      setLoadingAlbums(true);
      let q;
      if (selectedCategory) {
        q = query(
          collection(db, 'albums'),
          where('categoryId', '==', selectedCategory),
          fbOrderBy('order', 'asc')
        );
      } else {
        q = query(
          collection(db, 'albums'),
          fbOrderBy('order', 'asc')
        );
      }
      const snapshot = await getDocs(q);
      setAlbums(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSelectedAlbum('');
      setPhotos([]);
    } catch (err) {
      console.error('Error fetching albums:', err);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const fetchPhotos = async () => {
    try {
      setLoadingPhotos(true);
      const q = query(
        collection(db, 'albumPhotos'),
        where('albumId', '==', selectedAlbum),
        fbOrderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      setPhotos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateSlug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

  // ---- Album CRUD ----
  const resetAlbumForm = () => {
    setAlbumForm({ categoryId: selectedCategory || '', clientId: '', title: '', subtitle: '', date: '', description: '' });
    setAlbumCoverFile(null);
    setAlbumPhotosFiles([]);
    setEditingAlbum(null);
    setShowAlbumModal(false);
  };

  const handleEditAlbum = (album) => {
    setEditingAlbum(album);
    setAlbumForm({
      categoryId: album.categoryId || '',
      clientId: album.clientId || '',
      title: album.title || '',
      subtitle: album.subtitle || '',
      date: album.date || '',
      description: album.description || '',
    });
    setAlbumCoverFile(null);
    setAlbumPhotosFiles([]);
    setShowAlbumModal(true);
  };

  const closeAlbumModal = () => {
    setShowAlbumModal(false);
    setEditingAlbum(null);
    setSelectedAlbum(null); // Also clear selection to reset photo views if needed
    setAlbumForm({ categoryId: '', clientId: '', title: '', subtitle: '', date: '', description: '' });
    setAlbumCoverFile(null);
    setAlbumPhotosFiles([]);
  };

  const performUploadPhotos = async (files, albumId, albumCategoryId, currentPhotoCount = 0) => {
    setUploading(true);
    setUploadProgress(0);
    let currentOrder = currentPhotoCount;

    let totalBytes = files.reduce((acc, file) => acc + file.size, 0);
    let bytesUploadedArray = new Array(files.length).fill(0);
    const results = [];
    let failedCount = 0;

    const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned';

    // Process sequentially to prevent Out-of-Memory crashes when uploading >10 files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let finalFileToUpload = file;
        const TWO_MB = 2 * 1024 * 1024;
        if (file.size > TWO_MB) {
          // Compress nicely to max 2MB (2048 KB) to bypass Cloudinary's limits
          finalFileToUpload = await compressImage(file, 2560, 2048);
        }

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              bytesUploadedArray[i] = e.loaded;
              const currentTotalBytes = bytesUploadedArray.reduce((acc, bytes) => acc + bytes, 0);
              const percentage = Math.round((currentTotalBytes / totalBytes) * 100);
              setUploadProgress(percentage);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              // Cloudinary automatically generates thumbnails on-the-fly, so we can generate the URL for it
              // e.g. replacing '/upload/' with '/upload/c_scale,w_800,q_auto,f_auto/'
              const thumbUrl = response.secure_url.replace('/upload/', '/upload/c_scale,w_800,q_auto,f_auto/');
              
              results.push({ 
                file: finalFileToUpload, 
                url: response.secure_url, 
                thumbUrl, 
                cloudinaryPublicId: response.public_id 
              });
              resolve();
            } else {
              reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload.'));

          const formData = new FormData();
          formData.append('file', finalFileToUpload);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          formData.append('folder', `webportfolio/album/${albumCategoryId}/${albumId}`);

          xhr.send(formData);
        });
      } catch (error) {
        console.error("Compression/Upload error:", error);
        failedCount++;
      }
    }

    for (const res of results) {
      currentOrder += 1;
      await addDocument('albumPhotos', {
        userId: user.uid,
        categoryId: albumCategoryId,
        albumId: albumId,
        imageUrl: res.url,
        thumbnailUrl: res.thumbUrl,
        alt: res.file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        order: currentOrder,
        cloudinaryPublicId: res.cloudinaryPublicId || null,
      });
    }

    await updateDocument('albums', albumId, {
      photoCount: (currentPhotoCount + results.length),
    });

    setUploading(false);
    setUploadProgress(0);
    return { uploaded: results.length, failed: failedCount };
  };

  const handleSaveAlbum = async () => {
    if (!albumForm.title.trim() || !albumForm.categoryId) return;
    try {
      setSavingAlbum(true);
      let coverImageUrl = editingAlbum?.coverImageUrl || '';

      // Upload cover if selected
      if (albumCoverFile) {
        const compressedCover = await compressImage(albumCoverFile, 2560, 1024);
        const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/d7wlzzdc/image/upload';
        const CLOUDINARY_UPLOAD_PRESET = 'portfolio_unsigned';

        const formData = new FormData();
        formData.append('file', compressedCover);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', `webportfolio/albums/${albumForm.categoryId}`);

        const response = await fetch(CLOUDINARY_UPLOAD_URL, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to upload cover image to Cloudinary');
        }

        const data = await response.json();
        coverImageUrl = data.secure_url;
      }

      const slug = generateSlug(albumForm.title);
      let albumId;
      let currentPhotoCount = 0;

      if (editingAlbum) {
        albumId = editingAlbum.id;
        currentPhotoCount = editingAlbum.photoCount || 0;
        await updateDocument('albums', albumId, {
          categoryId: albumForm.categoryId,
          clientId: albumForm.clientId,
          title: albumForm.title,
          subtitle: albumForm.subtitle,
          date: albumForm.date,
          description: albumForm.description,
          slug,
          coverImageUrl,
        });
        showToast('Album updated!');
      } else {
        albumId = await addDocument('albums', {
          userId: user.uid,
          categoryId: albumForm.categoryId,
          clientId: albumForm.clientId,
          title: albumForm.title,
          subtitle: albumForm.subtitle,
          date: albumForm.date,
          description: albumForm.description,
          slug,
          coverImageUrl,
          photoCount: 0,
          order: albums.length > 0 ? Math.min(...albums.map(a => a.order || 0)) - 1 : 0,
        });
        showToast('Album created!');
      }

      if (albumPhotosFiles.length > 0) {
        await performUploadPhotos(albumPhotosFiles, albumId, albumForm.categoryId, currentPhotoCount);
        showToast(`${albumPhotosFiles.length} photo(s) uploaded!`);
      }

      resetAlbumForm();
      await fetchAlbums();
      if (selectedAlbum === albumId) {
        await fetchPhotos();
      }
    } catch (err) {
      console.error('Album save error:', err);
      showToast('Failed to save album.', 'error');
    } finally {
      setSavingAlbum(false);
    }
  };

  const handleDeleteAlbum = async (album) => {
    setConfirmModal({ isOpen: true, type: 'album', data: album });
  };

  const handleToggleVisibility = async (album) => {
    const newStatus = !album.isHidden;
    // Optimistic update
    setAlbums((prev) => prev.map((a) => a.id === album.id ? { ...a, isHidden: newStatus } : a));
    showToast(`Album is now ${newStatus ? 'hidden' : 'visible'}.`);

    try {
      await updateDocument('albums', album.id, { isHidden: newStatus });
    } catch (err) {
      console.error('Toggle visibility error:', err);
      showToast('Failed to change visibility.', 'error');
      // Rollback
      setAlbums((prev) => prev.map((a) => a.id === album.id ? { ...a, isHidden: !newStatus } : a));
    }
  };

  const confirmDeleteAlbum = async () => {
    const album = confirmModal.data;
    setConfirmModal({ isOpen: false, type: null, data: null });
    if (!album) return;
    try {
      // Delete all photos in this album
      const q = query(collection(db, 'albumPhotos'), where('albumId', '==', album.id));
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        const photo = docSnap.data();
        if (photo.storagePath) {
          try {
            await deleteObject(ref(storage, photo.storagePath));
          } catch (e) { /* ignore */ }
        }
        if (photo.cloudinaryPublicId) {
          try {
            const deleteImg = httpsCallable(functions, 'deleteCloudinaryImage');
            await deleteImg({ publicId: photo.cloudinaryPublicId });
          } catch (e) { console.error('Cloudinary delete error:', e); }
        }
        await deleteDocument('albumPhotos', docSnap.id);
      }
      await deleteDocument('albums', album.id);
      showToast('Album deleted.');
      if (selectedAlbum === album.id) {
        setSelectedAlbum('');
        setPhotos([]);
      }
      await fetchAlbums();
    } catch (err) {
      console.error('Delete album error:', err);
      showToast('Failed to delete album.', 'error');
    }
  };

  // ---- Photo Upload & Delete ----
  const handleUploadPhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !selectedAlbum) return;

    try {
      const currentPhotoCount = photos.length;
      const targetCategoryId = editingAlbum?.categoryId || albumForm.categoryId;
      const { uploaded: uploadedCount, failed: failedCount } = await performUploadPhotos(files, selectedAlbum, targetCategoryId, currentPhotoCount);
      
      if (failedCount > 0) {
        showToast(`${uploadedCount} masuk. Tapi Cloudinary MENOLAK ${failedCount} foto karena ukuran aslinya terlalu besar!`, 'error');
      } else if (uploadedCount > 0) {
        showToast(`${uploadedCount} photo(s) uploaded!`);
      }
      
      await fetchPhotos();

      setAlbums((prev) =>
        prev.map((g) =>
          g.id === selectedAlbum
            ? { ...g, photoCount: currentPhotoCount + uploadedCount }
            : g
        )
      );
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Failed to upload some photos.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photo) => {
    setConfirmModal({ isOpen: true, type: 'photo', data: photo });
  };

  const confirmDeletePhoto = async () => {
    const photo = confirmModal.data;
    setConfirmModal({ isOpen: false, type: null, data: null });
    if (!photo) return;
    try {
      if (photo.storagePath) {
        try {
          await deleteObject(ref(storage, photo.storagePath));
        } catch (e) { /* ignore */ }
      }
      if (photo.cloudinaryPublicId) {
        try {
          const deleteImg = httpsCallable(functions, 'deleteCloudinaryImage');
          await deleteImg({ publicId: photo.cloudinaryPublicId });
        } catch (e) { console.error('Cloudinary delete error:', e); }
      }
      await deleteDocument('albumPhotos', photo.id);

      const newCount = Math.max(0, photos.length - 1);
      if (selectedAlbum) {
        await updateDocument('albums', selectedAlbum, { photoCount: newCount });
      }

      showToast('Photo deleted.');
      await fetchPhotos();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete photo.', 'error');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setPhotos((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);

        // Update Firestore in background
        const bulkUpdate = async () => {
          try {
            const updatePromises = newArray.map((photo, index) =>
              updateDocument('albumPhotos', photo.id, { order: index })
            );
            await Promise.all(updatePromises);
          } catch (e) {
            console.error('Failed to update order', e);
            showToast('Failed to save photo order.', 'error');
          }
        };
        bulkUpdate();

        return newArray;
      });
    }
  };

  const handleAlbumDragEnd = async (event) => {
    if (activeTab !== 'all') return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAlbums((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);

        // Update Firestore in background
        const bulkUpdate = async () => {
          try {
            const updatePromises = newArray.map((album, index) =>
              updateDocument('albums', album.id, { order: index + 1 })
            );
            await Promise.all(updatePromises);
          } catch (e) {
            console.error('Failed to update order', e);
            showToast('Failed to save album order.', 'error');
          }
        };
        bulkUpdate();

        return newArray;
      });
    }
  };

  const selectedCategoryName = categories.find((c) => c.id === selectedCategory)?.title || '';
  const selectedAlbumName = albums.find((g) => g.id === selectedAlbum)?.title || '';

  const filteredAlbums = albums.filter((album) => {
    if (activeTab === 'hidden') return album.isHidden;
    if (activeTab === 'visible') return !album.isHidden;
    return true;
  });

  return (
    <div id="admin-manage-album">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Album Manager</h1>
          <p className="admin-header__subtitle">
            Manage categories, albums, and photos
          </p>
        </div>
      </div>

      {/* Step 1: Category Selector */}
      <div className="admin-card">
        <div className="admin-card__header">
          <h2 className="admin-card__title">Category Selection</h2>
        </div>
        <div className="form-group">
          <select
            className="form-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">— All Categories —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 2: Albums */}
      <div className="admin-card">
        <div className="admin-card__header">
          <h2 className="admin-card__title">
            {selectedCategory ? `Albums in ${selectedCategoryName}` : 'All Albums'}
          </h2>
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => { resetAlbumForm(); setShowAlbumModal(true); }}
          >
            <Plus size={16} /> New Album
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '1.5rem', margin: '0 1.5rem 1.5rem', borderBottom: '1px solid #333' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{ padding: '0.75rem 0', background: 'none', border: 'none', color: activeTab === 'all' ? '#fff' : '#666', borderBottom: activeTab === 'all' ? '2px solid var(--color-accent)' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
          >All Albums</button>
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
          <div style={{ margin: '0 1.5rem 1rem', fontSize: '0.85rem', color: '#666' }}>Drag and drop disabled while filtering.</div>
        ) : (
          <div style={{ margin: '0 1.5rem 1rem', fontSize: '0.85rem', color: '#666' }}>Drag and drop to reorder albums.</div>
        )}

        {/* Album List */}
        {loadingAlbums ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filteredAlbums.length > 0 ? (
          <div className="admin-album-list" style={{ padding: '0 1.5rem 1.5rem' }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleAlbumDragEnd}
            >
              <SortableContext
                items={filteredAlbums.map(a => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredAlbums.map((album) => (
                  <SortableAlbumItem
                    key={album.id}
                    album={album}
                    selectedAlbum={selectedAlbum}
                    setSelectedAlbum={setSelectedAlbum}
                    handleEditAlbum={handleEditAlbum}
                    handleDeleteAlbum={handleDeleteAlbum}
                    handleToggleVisibility={handleToggleVisibility}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <FolderOpen size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p>No albums yet. Create one above!</p>
          </div>
        )}
      </div>

      {/* Album Form Modal (Create & Edit) */}
      <AnimatePresence>
        {showAlbumModal && (
          <div className="admin-modal-overlay" onClick={closeAlbumModal}>
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
                  {editingAlbum ? (
                    <><Edit2 size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Edit Album — {editingAlbum.title}</>
                  ) : (
                    <><Plus size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> New Album</>
                  )}
                </h3>
                <button className="admin-modal__close" onClick={closeAlbumModal}>
                  <X size={18} />
                </button>
              </div>

              <div className="admin-modal__body" style={{ padding: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-input"
                    value={albumForm.categoryId}
                    onChange={(e) => setAlbumForm({ ...albumForm, categoryId: e.target.value })}
                  >
                    <option value="" disabled>— Select Category —</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Client (Owner)</label>

                  {/* Select button */}
                  <div
                    className="form-input"
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111' }}
                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  >
                    <span>
                      {albumForm.clientId ? (
                        (() => {
                          const c = bookings?.find(b => b.userId === albumForm.clientId);
                          return c ? `${c.fullName} (${c.email})` : 'Unknown Client';
                        })()
                      ) : (
                        <span style={{ color: '#888' }}>— Not linked to any Client —</span>
                      )}
                    </span>
                    <ChevronDown size={16} />
                  </div>

                  {/* Dropdown Menu */}
                  {isClientDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0, right: 0,
                      marginTop: '0.5rem',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      zIndex: 10,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                      maxHeight: '300px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ padding: '0.75rem', borderBottom: '1px solid #333' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search client by name or email..."
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        <div
                          style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #222', color: '#888', fontSize: '0.9rem' }}
                          onClick={() => {
                            setAlbumForm({ ...albumForm, clientId: '' });
                            setIsClientDropdownOpen(false);
                            setClientSearchQuery('');
                          }}
                        >
                          — Not linked to any Client —
                        </div>
                        {bookings && bookings
                          .filter((v, i, a) => a.findIndex(t => (t.userId === v.userId)) === i)
                          .filter(b => b.userId)
                          .filter(b =>
                            !clientSearchQuery ||
                            (b.fullName && b.fullName.toLowerCase().includes(clientSearchQuery.toLowerCase())) ||
                            (b.email && b.email.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                          )
                          .slice(0, 5)
                          .map((b) => (
                            <div
                              key={b.userId}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #222',
                                background: albumForm.clientId === b.userId ? 'rgba(255,255,255,0.05)' : 'transparent'
                              }}
                              onClick={() => {
                                setAlbumForm({ ...albumForm, clientId: b.userId });
                                setIsClientDropdownOpen(false);
                                setClientSearchQuery('');
                              }}
                            >
                              <div style={{ fontWeight: '500', color: '#fff', fontSize: '0.95rem' }}>{b.fullName}</div>
                              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.1rem' }}>{b.email}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Album Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={albumForm.title}
                    onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
                    placeholder="e.g. Yosua & Putri"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Subtitle</label>
                  <input
                    type="text"
                    className="form-input"
                    value={albumForm.subtitle}
                    onChange={(e) => setAlbumForm({ ...albumForm, subtitle: e.target.value })}
                    placeholder="e.g. Bali Wedding Ceremony"
                  />
                </div>
                <div className="admin-grid-2-col">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={albumForm.date}
                      onChange={(e) => setAlbumForm({ ...albumForm, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cover Image</label>
                    {editingAlbum?.coverImageUrl && !albumCoverFile && (
                      <img
                        src={editingAlbum.coverImageUrl}
                        alt="Current cover"
                        style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, marginBottom: '0.5rem' }}
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setAlbumCoverFile(e.target.files[0])}
                      className="form-input"
                      style={{ padding: '0.4rem' }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    value={albumForm.description}
                    onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })}
                    rows={3}
                    placeholder="Brief story about this session..."
                  />
                </div>
                {!editingAlbum && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Add Photos (Multiple)</label>
                    <label className="admin-upload" style={{ cursor: 'pointer', opacity: (savingAlbum || uploading) ? 0.5 : 1, pointerEvents: (savingAlbum || uploading) ? 'none' : 'auto', marginBottom: '0.5rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setAlbumPhotosFiles(prev => [...prev, ...files]);
                        }}
                        style={{ display: 'none' }}
                        disabled={savingAlbum || uploading}
                      />
                      <Upload className="admin-upload__icon" size={24} style={{ marginBottom: '0.5rem' }} />
                      <p className="admin-upload__text" style={{ fontSize: '0.85rem' }}>
                        Click or drag to select photos for this album
                      </p>
                    </label>
                    {albumPhotosFiles.length > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>
                          {albumPhotosFiles.length} file(s) selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setAlbumPhotosFiles([])}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          Clear Selection
                        </button>
                      </div>
                    )}
                    {uploading && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#fff' }}>
                          <span>Uploading {uploadProgress === 100 ? 'Processing...' : 'Photos...'}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.2s ease-out' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Photo Manager for Existing Albums */}
                {editingAlbum && selectedAlbum === editingAlbum.id && (
                  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #1e1e1e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>Manage Photos</h3>
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>{photos.length} photo(s)</span>
                    </div>

                    {uploading && (
                      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#fff' }}>
                          <span>Uploading {uploadProgress === 100 ? 'Processing...' : 'Photos...'}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.2s ease-out' }} />
                        </div>
                      </div>
                    )}

                    <label className="admin-upload" style={{ cursor: 'pointer', opacity: uploading ? 0.5 : 1, pointerEvents: uploading ? 'none' : 'auto', marginBottom: '1.5rem' }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleUploadPhotos}
                        style={{ display: 'none' }}
                        disabled={uploading}
                      />
                      <Upload className="admin-upload__icon" size={24} style={{ marginBottom: '0.5rem' }} />
                      <p className="admin-upload__text" style={{ fontSize: '0.85rem' }}>
                        {uploading ? 'Uploading...' : 'Click or drag to upload directly to album'}
                      </p>
                    </label>

                    {/* Photo Grid */}
                    {!loadingPhotos && photos.length > 0 && (
                      <div>
                        <div style={{ marginBottom: '1rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>Drag to reorder photos</span>
                        </div>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={photos.map(p => p.id)}
                            strategy={rectSortingStrategy}
                          >
                            <div className="admin-image-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                              {photos.map((photo) => (
                                <SortablePhotoItem
                                  key={photo.id}
                                  photo={photo}
                                  onDelete={handleDeletePhoto}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}

                    {!loadingPhotos && photos.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #1e1e1e' }}>
                        <p style={{ color: '#666', fontSize: '0.85rem' }}>No photos yet. Upload some above!</p>
                      </div>
                    )}

                    {loadingPhotos && (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="spinner" style={{ margin: '0 auto' }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e1e1e', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#0a0a0a' }}>
                <button
                  className="admin-btn admin-btn--secondary"
                  onClick={closeAlbumModal}
                >
                  Cancel
                </button>
                <button
                  className="admin-btn admin-btn--primary"
                  onClick={async () => { await handleSaveAlbum(); closeAlbumModal(); }}
                  disabled={savingAlbum || uploading || !albumForm.title.trim() || !albumForm.categoryId}
                >
                  <Save size={14} /> {savingAlbum || uploading ? 'Saving...' : 'Save Album'}
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

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'album' ? 'Delete Album' : 'Delete Photo'}
        message={
          confirmModal.type === 'album'
            ? `Are you sure you want to delete the album "${confirmModal.data?.title}" and all its photos? This cannot be undone.`
            : 'Are you sure you want to delete this photo?'
        }
        confirmText="Delete"
        onConfirm={confirmModal.type === 'album' ? confirmDeleteAlbum : confirmDeletePhoto}
        onCancel={() => setConfirmModal({ isOpen: false, type: null, data: null })}
      />
    </div>
  );
}
