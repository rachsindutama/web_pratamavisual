import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy as fbOrderBy, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { Download, Folder, Image as ImageIcon, ArrowLeft, Archive, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import '../../styles/admin.css';
import '../../styles/album.css';


export default function MyPhotos() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [albums, setAlbums] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const isLightboxOpen = lightboxIndex >= 0;

  const openLightbox = (index) => {
    setLightboxIndex(index);
  };
  const closeLightbox = () => {
    setLightboxIndex(-1);
  };

  const goNext = useCallback(() => {
    if (lightboxIndex < photos.length - 1) {
      setLightboxIndex((prev) => prev + 1);
    }
  }, [lightboxIndex, photos.length]);

  const goPrev = useCallback(() => {
    if (lightboxIndex > 0) {
      setLightboxIndex((prev) => prev - 1);
    }
  }, [lightboxIndex]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen, goNext, goPrev]);


  useEffect(() => {
    document.title = `My Photos — ${settings?.brandName || ''}`;
    fetchAlbums();
  }, [user, settings]);

  const fetchAlbums = async () => {
    if (!user) return;
    try {
      setLoadingAlbums(true);
      const q = query(
        collection(db, 'albums'),
        where('clientId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedAlbums = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedAlbums.sort((a, b) => (a.order || 0) - (b.order || 0));
      setAlbums(fetchedAlbums);
    } catch (error) {
      console.error("Error fetching client albums:", error);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const fetchPhotos = async (albumId) => {
    try {
      setLoadingPhotos(true);
      const q = query(
        collection(db, 'albumPhotos'),
        where('albumId', '==', albumId)
      );
      const snapshot = await getDocs(q);
      const fetchedPhotos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedPhotos.sort((a, b) => (a.order || 0) - (b.order || 0));
      setPhotos(fetchedPhotos);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleAlbumClick = (album) => {
    setSelectedAlbum(album);
    fetchPhotos(album.id);
  };

  const handleBackToAlbums = () => {
    setSelectedAlbum(null);
    setPhotos([]);
  };

  const getCorsUrl = (url) => {
    if (import.meta.env.DEV) {
      return url.replace('https://firebasestorage.googleapis.com', '/firebasestorage');
    }
    return url;
  };

  const downloadSingleImage = async (url, filename) => {
    try {
      const response = await fetch(getCorsUrl(url));
      const blob = await response.blob();
      saveAs(blob, filename || 'photo.jpg');
    } catch (error) {
      console.error("Error downloading image:", error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const downloadAllAsZip = async () => {
    if (!photos.length) return;
    try {
      setDownloadingZip(true);
      setDownloadProgress(0);
      
      const zip = new JSZip();
      const folderName = selectedAlbum.title || 'Album_Photos';
      const folder = zip.folder(folderName);
      
      let completed = 0;
      
      // We will fetch all photos and add them to zip
      const downloadPromises = photos.map(async (photo, index) => {
        try {
          const response = await fetch(getCorsUrl(photo.imageUrl));
          const blob = await response.blob();
          const ext = photo.imageUrl.split('?')[0].split('.').pop() || 'jpg';
          const filename = photo.alt ? `${photo.alt.replace(/[^a-z0-9]/gi, '_')}_${index}.${ext}` : `photo_${index + 1}.${ext}`;
          
          folder.file(filename, blob);
          
          completed++;
          setDownloadProgress(Math.round((completed / photos.length) * 100));
        } catch (err) {
          console.error("Failed to fetch photo for zip:", photo.imageUrl, err);
        }
      });
      
      await Promise.all(downloadPromises);
      
      setDownloadProgress(100);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folderName}.zip`);
      
    } catch (error) {
      console.error("Error generating zip:", error);
      alert("Failed to download ZIP file. Please try downloading photos individually.");
    } finally {
      setDownloadingZip(false);
      setDownloadProgress(0);
    }
  };

  if (loadingAlbums) {
    return (
      <div className="admin-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">My Photos</h1>
          <p className="admin-header__subtitle">View and download photos from your sessions</p>
        </div>
      </div>

      {!selectedAlbum ? (
        // Albums View
        <>
          {albums.length === 0 ? (
            <div className="admin-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <ImageIcon size={48} style={{ color: '#333', margin: '0 auto 1rem' }} />
              <p style={{ color: '#666', margin: 0 }}>No albums have been assigned to you yet.</p>
            </div>
          ) : (
            <div className="album-grid" style={{ gap: '1.5rem', marginTop: '1rem', '--grid-min': '250px' }}>
              {albums.map((album, index) => (
                <motion.div
                  key={album.id}
                  className="album-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  onClick={() => handleAlbumClick(album)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="album-card__image-wrapper">
                    {album.coverImageUrl ? (
                      <img
                        src={album.coverImageUrl}
                        alt={album.title}
                        className="album-card__image"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="album-card__image album-card__placeholder"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }}
                      >
                        <Folder size={32} style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    )}
                    <div className="album-card__overlay">
                      <div className="album-card__info">
                        <h3 className="album-card__title">{album.title}</h3>
                        <p className="album-card__meta">
                          {album.date ? `${album.date} | ` : ''}{album.photoCount || 0} FOTO
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : (
        // Photos View
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <button 
                onClick={handleBackToAlbums}
                className="admin-btn admin-btn--secondary"
                style={{ padding: '0.75rem' }}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#fff', letterSpacing: '0.02em' }}>{selectedAlbum.title}</h2>
                <p style={{ margin: '0.5rem 0 0', color: '#888', fontSize: '0.95rem' }}>{photos.length} Photos</p>
              </div>
            </div>
            
            {photos.length > 0 && (
              <button 
                onClick={downloadAllAsZip}
                disabled={downloadingZip}
                className="admin-btn admin-btn--primary"
              >
                {downloadingZip ? (
                  <>Downloading... {downloadProgress}%</>
                ) : (
                  <><Archive size={16} /> Download All (ZIP)</>
                )}
              </button>
            )}
          </div>

          {loadingPhotos ? (
            <div style={{ padding: '4rem 0', textAlign: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#0a0a0a', borderRadius: '8px', border: '1px dashed #333' }}>
              <p style={{ color: '#666', margin: 0 }}>This album doesn't have any photos yet.</p>
            </div>
          ) : (
            <div className="admin-image-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '2rem' }}>
              {photos.map((photo, index) => (
                <motion.div 
                  key={photo.id} 
                  whileTap={{ scale: 0.96 }}
                  onClick={() => openLightbox(index)}
                  style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#111', aspectRatio: '3/4', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', WebkitTapHighlightColor: 'transparent', cursor: 'pointer' }}
                >
                  <img 
                    src={photo.thumbnailUrl || photo.imageUrl} 
                    alt={photo.alt || 'Photo'} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                    onError={(e) => {
                      if (e.target.src !== photo.imageUrl) {
                        e.target.src = photo.imageUrl;
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => openLightbox(index)}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSingleImage(photo.imageUrl, photo.alt ? `${photo.alt}.jpg` : 'photo.jpg');
                      }}
                      className="admin-btn admin-btn--primary"
                      style={{ padding: '0.5rem 1rem', borderRadius: '20px' }}
                    >
                      <Download size={16} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Download
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeLightbox}
          >
            <button 
              onClick={closeLightbox} 
              style={{
                position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.5)', 
                color: '#fff', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer', zIndex: 10001
              }}
            >
              <X size={24} />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                style={{
                  position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', 
                  padding: '1rem', cursor: 'pointer', zIndex: 10001, WebkitTapHighlightColor: 'transparent', userSelect: 'none'
                }}
              >
                <ChevronLeft size={32} />
              </button>
            )}

            <div
                key={lightboxIndex}
                style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, WebkitTapHighlightColor: 'transparent' }}
                onClick={(e) => e.stopPropagation()}
              >
                <TransformWrapper
                  minScale={1}
                  maxScale={5}
                  wheel={{ step: 0.1 }}
                  doubleClick={{ step: 1.5 }}
                >
                  {({ state }) => (
                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
                    >
                      <img
                        src={photos[lightboxIndex]?.imageUrl}
                        alt={photos[lightboxIndex]?.alt || ''}
                        style={{
                          maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain',
                          userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                          cursor: state.scale > 1 ? 'grab' : 'zoom-in',
                          pointerEvents: 'auto', zIndex: 10000
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    </TransformComponent>
                  )}
                </TransformWrapper>
              </div>

            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', 
                  padding: '1rem', cursor: 'pointer', zIndex: 10001, WebkitTapHighlightColor: 'transparent', userSelect: 'none'
                }}
              >
                <ChevronRight size={32} />
              </button>
            )}

            <div style={{
              position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
              color: '#fff', fontSize: '0.9rem', background: 'rgba(0,0,0,0.5)', padding: '0.4rem 1rem',
              borderRadius: '20px', zIndex: 10001
            }}>
              {lightboxIndex + 1} / {photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
