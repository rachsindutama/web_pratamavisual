import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { optimizeImageUrl } from '../../lib/utils';
import '../../styles/album.css';

export default function MasonryAlbum({ photos = [] }) {
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

  // Keyboard navigation
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

  if (photos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-muted)' }}>
        <p>Belum ada asset gambar/foto yang ditambahkan.</p>
      </div>
    );
  }

  return (
    <>
      <div className="masonry-grid" id="gallery-grid">
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            className="masonry-item"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.96 }}
            viewport={{ once: true }}
            transition={{ delay: (index % 4) * 0.1, duration: 0.5 }}
            onClick={() => openLightbox(index)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <img
              src={optimizeImageUrl(photo.thumbnailUrl || photo.imageUrl, 800)}
              alt={photo.alt || `Photo ${index + 1}`}
              className="masonry-item__image"
              loading="lazy"
              onError={(e) => {
                if (e.target.src !== photo.imageUrl) {
                  e.target.src = photo.imageUrl;
                }
              }}
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
            <div className="masonry-item__overlay" />
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeLightbox}
            id="lightbox-overlay"
          >
            <button className="lightbox__close" onClick={closeLightbox} aria-label="Close lightbox">
              <X size={24} />
            </button>

            {lightboxIndex > 0 && (
              <button
                className="lightbox__nav lightbox__nav--prev"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Previous photo"
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
                        className="lightbox__image"
                        style={{
                          maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain',
                          userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
                          cursor: state.scale > 1 ? 'grab' : 'zoom-in',
                          pointerEvents: 'auto'
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
                className="lightbox__nav lightbox__nav--next"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Next photo"
              >
                <ChevronRight size={32} />
              </button>
            )}

            <div className="lightbox__counter">
              {lightboxIndex + 1} / {photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
