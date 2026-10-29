import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import HeroSection from '../components/ui/HeroSection';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useSiteSettings } from '../hooks/useSiteSettings';
import '../styles/album.css';
import { formatDate } from '../utils/formatDate';
import { optimizeImageUrl } from '../lib/utils';

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.6,
      ease: 'easeOut',
    },
  }),
};

export default function CategoryDetail() {
  const { categorySlug } = useParams();
  const { settings } = useSiteSettings();
  const [category, setCategory] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategoryAndAlbums() {
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

        // Fetch albums for this category
        const albumsQuery = query(
          collection(db, 'albums'),
          where('categoryId', '==', catDoc.id),
          orderBy('order', 'asc')
        );
        const albumsSnapshot = await getDocs(albumsQuery);
        const albumsData = albumsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })).filter((album) => !album.isHidden);
        setAlbums(albumsData);
      } catch (err) {
        console.error('Error fetching category:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCategoryAndAlbums();
  }, [categorySlug]);

  useEffect(() => {
    if (category && settings) {
      document.title = settings.seoTitle || settings.brandName || '';
    }
  }, [category, settings]);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  if (!category) {
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
          <h2 className="heading-2" style={{ marginBottom: '1rem' }}>Category Not Found</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>The category you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page" id="category-page">
      {/* Category Hero */}
      <HeroSection
        imageUrl={category.coverImageUrl}
        quote={`${category.title} Albums`}
        gallery={true}
        scrollButtonText="VIEW ALBUMS"
        scrollTargetId="category-albums-section"
      />

      {/* Albums Grid */}
      <div className="container" id="category-albums-section" style={{ paddingTop: 'var(--space-4xl)' }}>
        {albums.length > 0 ? (
          <div className="album-grid">
            {albums.map((album, index) => (
              <motion.div
                key={album.id}
                className="album-card"
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                custom={index}
              >
                <Link to={`/categories/${categorySlug}/${album.slug || album.id}`}>
                  <div className="album-card__image-wrapper">
                    {album.coverImageUrl ? (
                      <img
                        src={optimizeImageUrl(album.coverImageUrl, 800)}
                        alt={album.title}
                        className="album-card__image"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="album-card__image album-card__placeholder"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }}
                      >
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', margin: 0 }}>Belum ada asset gambar/foto yang ditambahkan.</p>
                      </div>
                    )}
                    <div className="album-card__overlay">
                      <div className="album-card__info">
                        <h3 className="album-card__title">{album.title}</h3>
                        <p className="album-card__meta">
                          {album.date ? `${formatDate(album.date)} | ` : ''}{album.photoCount || 0} FOTO
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--space-4xl) 0', color: 'var(--color-text-muted)' }}>
            <p>Belum ada asset gambar/foto yang ditambahkan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
