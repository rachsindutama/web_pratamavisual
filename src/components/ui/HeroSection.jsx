import { Link } from 'react-router-dom';
import { optimizeImageUrl } from '../../lib/utils';
import '../../styles/hero.css';

export default function HeroSection({
  imageUrl,
  quote,
  subQuote,
  fullHeight = false,
  gallery = false,
  noOverlay = false,
  scrollButtonText,
  scrollTargetId,
  buttonLink,
  buttonText,
}) {
  const heroClass = `hero ${fullHeight ? 'hero--full' : ''} ${gallery ? 'hero--gallery' : ''} ${noOverlay ? 'hero--no-overlay' : ''}`;

  const handleScroll = () => {
    if (scrollTargetId) {
      const target = document.getElementById(scrollTargetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className={heroClass} id="hero-section">
      <div className="hero__image-wrapper">
        {imageUrl ? (
          <img
            src={optimizeImageUrl(imageUrl, 1600)}
            alt="Hero"
            className="hero__image"
            loading="eager"
          />
        ) : (
          <div className="hero__placeholder" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '100%', paddingBottom: '4rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Belum ada asset gambar yang ditambahkan.</p>
          </div>
        )}
      </div>

      {!noOverlay && (quote || subQuote) && (
        <>
          <div className="hero__overlay" />
          <div className="hero__content">
            {quote && <h1 className="hero__quote">{quote}</h1>}
            {subQuote && <p className="hero__subquote" style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}>{subQuote}</p>}
            {buttonLink && buttonText ? (
              <Link to={buttonLink} className="btn btn-hero">
                {buttonText}
              </Link>
            ) : scrollButtonText && scrollTargetId ? (
              <button
                className="btn btn-hero"
                onClick={handleScroll}
              >
                {scrollButtonText}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
