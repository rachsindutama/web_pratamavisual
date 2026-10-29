import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import HeroSection from '../components/ui/HeroSection';
import MasonryAlbum from '../components/ui/MasonryAlbum';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { ChevronLeft } from 'lucide-react';
import '../styles/album.css';
import { formatDate } from '../utils/formatDate';

export default function AlbumDetail() {
  const { categorySlug, albumSlug } = useParams();
  const { settings } = useSiteSettings();
  const [category, setCategory] = useState(null);
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlbumAndPhotos() {
      try {
        setLoading(true);

        // Fetch category by slug
        const catQuery = query(
          collection(db, 'categories'),
          where('slug', '==', categorySlug)
        );
        const catSnapshot = await getDocs(catQuery);

        if (catSnapshot.empty) {
          setLoading(false);
          return;
        }

        const catDoc = catSnapshot.docs[0];
        const catData = { id: catDoc.id, ...catDoc.data() };
        setCategory(catData);

        // Fetch album by slug within this category
        const albumQuery = query(
          collection(db, 'albums'),
          where('categoryId', '==', catDoc.id),
          where('slug', '==', albumSlug)
        );
        const albumSnapshot = await getDocs(albumQuery);

        if (albumSnapshot.empty) {
          setLoading(false);
          return;
        }

        const albumDoc = albumSnapshot.docs[0];
        const albumData = { id: albumDoc.id, ...albumDoc.data() };
        
        if (albumData.isHidden) {
          setLoading(false);
          return;
        }

        setAlbum(albumData);

        // Fetch photos for this album
        const photosQuery = query(
          collection(db, 'albumPhotos'),
          where('albumId', '==', albumDoc.id),
          orderBy('order', 'asc')
        );
        const photosSnapshot = await getDocs(photosQuery);
        const photosData = photosSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPhotos(photosData);
      } catch (err) {
        console.error('Error fetching album:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAlbumAndPhotos();
  }, [categorySlug, albumSlug]);

  useEffect(() => {
    if (album && category && settings) {
      document.title = settings.seoTitle || settings.brandName || '';
    }
  }, [album, category, settings]);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  if (!album || !category) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 'var(--nav-height)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 className="heading-2" style={{ marginBottom: '1rem' }}>Album Not Found</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>The album you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="album-page" id="album-page">
      {/* Album Hero */}
      <HeroSection
        imageUrl={album.coverImageUrl || category.coverImageUrl}
        quote={album.title}
        subQuote={album.date ? formatDate(album.date) : (album.subtitle || category.title)}
        fullHeight={true}
        scrollButtonText="VIEW GALLERY"
        scrollTargetId="album-photos-section"
      />

      {/* Album Info */}
      <div className="container" id="album-photos-section">
        <motion.div
          className="album-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <Link to={`/categories/${categorySlug}`} className="album-header__back">
            <ChevronLeft size={18} />
            Back to {category.title}
          </Link>
          {album.description && (
            <div className="album-header__description">
              {album.description.split('\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Photo Grid */}
      <div className="container-wide">
        <MasonryAlbum photos={photos} />
      </div>
    </div>
  );
}
