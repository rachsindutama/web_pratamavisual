import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, EffectCoverflow } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-coverflow';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import CategoryGrid from '../components/ui/CategoryGrid';
import TestimonialSection from '../components/ui/TestimonialSection';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import HeroSection from '../components/ui/HeroSection';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useFirestoreCollection, orderBy } from '../hooks/useFirestore';
import '../styles/categories.css';

function CustomVideoPlayer({ vid }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Clean embed URL for a premium look
  const cleanEmbedUrl = vid.embedUrl 
    ? `${vid.embedUrl}?autoplay=1&rel=0&modestbranding=1`
    : '';

  return (
    <div className="video-grid-item" onClick={() => setIsPlaying(true)}>
      {isPlaying ? (
        <iframe 
          src={cleanEmbedUrl}
          title={vid.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowFullScreen
        ></iframe>
      ) : (
        <>
          {vid.thumbnailUrl && (
            <img 
              src={vid.thumbnailUrl} 
              alt={vid.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} 
            />
          )}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', pointerEvents: 'auto', zIndex: 2 }}>
            <div 
              style={{ 
                width: '72px', 
                height: '72px', 
                borderRadius: '50%', 
                background: 'rgba(255,255,255,0.15)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }} 
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
              }} 
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              }}
            >
              <Play fill="#fff" color="#fff" size={32} style={{ marginLeft: '6px' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Categories() {
  const { settings } = useSiteSettings();
  const { data: categories, loading } = useFirestoreCollection(
    'categories',
    [orderBy('order', 'asc')]
  );
  const { data: videos } = useFirestoreCollection(
    'videos',
    [orderBy('order', 'asc')]
  );

  useEffect(() => {
    if (settings) {
      document.title = settings.seoTitle || settings.brandName || '';
    }
  }, [settings]);

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <div
      className="categories-page"
      id="categories-page"
      style={{ paddingTop: settings?.portfolioHero?.imageUrl ? '0' : undefined }}
    >
      {settings?.portfolioHero?.imageUrl && (
        <HeroSection
          imageUrl={settings.portfolioHero.imageUrl}
          quote={settings.portfolioHero.title || 'Portfolio'}
          subQuote={settings.portfolioHero.subtitle}
          buttonText={settings.portfolioHero.buttonText}
          buttonLink={settings.portfolioHero.buttonText ? '/pricing' : null}
          gallery={true}
        />
      )}

      <div className="container-wide" style={{ paddingTop: settings?.portfolioHero?.imageUrl ? 'var(--space-4xl)' : '0' }}>
        <motion.h1
          className="categories-page__title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {settings?.sectionTitles?.portfolio || 'Portfolio'}
        </motion.h1>
        <CategoryGrid categories={(categories || []).filter(c => !c.isHidden)} />

        {(categories || []).filter(c => !c.isHidden).length === 0 && (
          <motion.p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              padding: '4rem 0',
              fontSize: 'var(--text-sm)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Belum ada asset gambar/foto yang ditambahkan.
          </motion.p>
        )}
      </div>

      {/* Video Gallery Section */}
      {(() => {
        const visibleVideos = (videos || []).filter(vid => !vid.isHidden);
        if (visibleVideos.length === 0) return null;
        
        return (
          <section className="featured-video-section">
            <div className="container-wide">
              <motion.h2 
                className="featured-video-title"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {settings?.sectionTitles?.videos || 'Cinematic Videos'}
              </motion.h2>
              <Swiper
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={'auto'}
                loop={true}
                coverflowEffect={{
                  rotate: 0,
                  stretch: 0,
                  depth: 100,
                  modifier: 2,
                  slideShadows: true,
                }}
                pagination={{ clickable: true }}
                navigation={{
                  nextEl: '.custom-swiper-next',
                  prevEl: '.custom-swiper-prev',
                }}
                modules={[EffectCoverflow, Pagination, Navigation]}
                className="video-carousel"
                style={{ paddingBottom: '3rem', paddingTop: '1rem' }}
              >
                {visibleVideos.map((vid, i) => (
                  <SwiperSlide key={vid.id} style={{ width: '90%', maxWidth: '900px' }}>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                    >
                      <CustomVideoPlayer vid={vid} />
                    </motion.div>
                  </SwiperSlide>
                ))}
              
              {/* Custom Navigation Buttons */}
              <div className="custom-swiper-prev">
                <ChevronLeft size={28} color="#fff" />
              </div>
              <div className="custom-swiper-next">
                <ChevronRight size={28} color="#fff" />
              </div>
            </Swiper>
          </div>
        </section>
        );
      })()}

      {/* Achievements Section */}
      {(() => {
        const visibleAchievements = (settings?.achievements || settings?.funFacts || []).filter(fact => !fact.isHidden);
        if (visibleAchievements.length === 0) return null;

        return (
          <section className="fun-facts-section">
            <div className="container-wide">
              <h2 className="fun-facts-title" style={{ marginBottom: settings?.achievementsSubtitle ? '1rem' : undefined }}>
                {settings?.sectionTitles?.achievements || settings?.sectionTitles?.funFacts || 'Achievements'}
              </h2>
              {settings?.achievementsSubtitle && (
                <p className="text-body" style={{ color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto var(--space-3xl)', textAlign: 'center' }}>
                  {settings.achievementsSubtitle}
                </p>
              )}
              <div className="fun-facts-grid">
                {visibleAchievements.map((fact, i) => (
                  <motion.div
                    key={i}
                    className="fun-fact-card"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <h3 className="fun-fact-number">{fact.number || ''}</h3>
                    <p className="fun-fact-description">{fact.description || ''}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      <TestimonialSection />
    </div>
  );
}
