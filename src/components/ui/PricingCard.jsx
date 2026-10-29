import { useState, useRef, useEffect } from 'react';
import { Check, Share2, Download, Link as LinkIcon, X, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';
import { formatRupiah } from '../../lib/utils';
import StoryTemplate from './StoryTemplate';
import '../../styles/pricing.css';

export default function PricingCard({ pkg, categoryName, isSelected, onToggleSelect }) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const menuRef = useRef(null);
  const templateRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCopyLink = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/pricing#${pkg.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadStory = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!templateRef.current) return;

    try {
      setIsDownloading(true);

      const dataUrl = await toPng(templateRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1
      });

      const link = document.createElement('a');
      link.download = `pratamavisual-${pkg.title.toLowerCase().replace(/\s+/g, '-')}-story.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate story image', err);
      alert('Gagal membuat gambar template. Silakan coba lagi.');
    } finally {
      setIsDownloading(false);
      setShowMenu(false);
    }
  };

  return (
    <div id={pkg.id} className={`pricing-card ${pkg.highlighted ? 'pricing-card--highlighted' : ''} ${isSelected ? 'pricing-card--selected' : ''}`}>

      {/* Hidden Story Template for html-to-image capture */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        <StoryTemplate ref={templateRef} pkg={pkg} categoryName={categoryName} />
      </div>

      {/* Share Container */}
      <div ref={menuRef} style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', zIndex: 10 }}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
          className="pricing-card__share-btn"
          title="Bagikan paket"
          style={{ position: 'static', background: showMenu ? 'rgba(255,255,255,0.05)' : 'transparent', borderRadius: '50%' }}
        >
          {showMenu ? <X size={18} /> : <Share2 size={18} />}
        </button>

        {showMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '0.25rem',
            background: '#1A1A1A',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
            minWidth: '180px',
            zIndex: 20
          }}>
            <button
              onClick={handleCopyLink}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#E0E0E0', padding: '0.75rem', cursor: 'pointer', textAlign: 'left', borderRadius: '6px', width: '100%' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {copied ? <Check size={16} color="var(--color-accent)" /> : <LinkIcon size={16} />}
              <span style={{ fontSize: '0.85rem' }}>{copied ? 'Link Disalin!' : 'Salin Tautan'}</span>
            </button>

            <button
              onClick={handleDownloadStory}
              disabled={isDownloading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#E0E0E0', padding: '0.75rem', cursor: isDownloading ? 'wait' : 'pointer', textAlign: 'left', borderRadius: '6px', width: '100%', opacity: isDownloading ? 0.6 : 1 }}
              onMouseOver={e => !isDownloading && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {isDownloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              <span style={{ fontSize: '0.85rem' }}>{isDownloading ? 'Memproses...' : 'Unduh'}</span>
            </button>
          </div>
        )}
      </div>

      <h3 className="pricing-card__title">{pkg.title}</h3>
      <div className="pricing-card__price-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {pkg.discountPercent > 0 && (
          <div className="pricing-card__discount-badge" style={{ background: 'var(--color-accent)', color: '#000', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {pkg.discountPercent}% OFF
          </div>
        )}
        {pkg.discountPercent > 0 ? (
          <>
            <span style={{ textDecoration: 'line-through', fontSize: '0.9rem', color: '#888' }}>{formatRupiah(pkg.price)}</span>
            <p className="pricing-card__price" style={{ marginTop: '0.2rem' }}>
              {formatRupiah((typeof pkg.price === 'string' ? parseInt(pkg.price.replace(/\D/g, ''), 10) : pkg.price) * (1 - pkg.discountPercent / 100))}
            </p>
          </>
        ) : (
          <p className="pricing-card__price">{formatRupiah(pkg.price)}</p>
        )}
      </div>
      {categoryName && (
        <p className="pricing-card__description">{categoryName}</p>
      )}
      {pkg.features && pkg.features.length > 0 && (
        <div className="pricing-card__features">
          {pkg.features.map((feature, index) => (
            <div key={index} className="pricing-card__feature">
              <Check className="pricing-card__feature-icon" size={16} />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}
      <button
        className={`btn pricing-card__cta ${isSelected ? 'btn-outline' : 'btn-primary'}`}
        onClick={() => onToggleSelect && onToggleSelect(pkg)}
        id={`pricing-cta-${pkg.id}`}
        style={isSelected ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : {}}
      >
        {isSelected ? 'Cancel Selection' : 'Choose Package'}
      </button>
    </div>
  );
}
