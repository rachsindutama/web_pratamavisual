import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import '../../styles/footer.css';

export default function Footer() {
  const { settings } = useSiteSettings();



  const footerLinks = settings?.footerLinks || {
    aboutMe: { label: 'About me', url: '#', heading: 'FIND OUT MORE' },
    instagram: { label: 'Instagram', url: '#', heading: 'FOLLOW ME ON' },
    connect: { label: 'Connect', url: '/booking', heading: 'GET IN TOUCH' },
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('/') || url.startsWith('#')) return url;
    if (!/^https?:\/\//i.test(url)) return `https://${url}`;
    return url;
  };

  const renderFooterLink = (linkItem, defaultHeading, defaultLabel, defaultUrl) => {
    if (linkItem?.isHidden) return null;

    const url = formatUrl(linkItem?.url || defaultUrl);
    const heading = linkItem?.heading || defaultHeading;
    const label = linkItem?.label || defaultLabel;
    const isExternal = !url.startsWith('/') && !url.startsWith('#');

    return (
      <div className="footer-link-item">
        <p className="footer-link-item__label">{heading}</p>
        {isExternal ? (
          <a href={url} className="footer-link-item__title" target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          <Link to={url} className="footer-link-item__title">
            {label}
          </Link>
        )}
      </div>
    );
  };

  const allHidden = footerLinks.aboutMe?.isHidden && footerLinks.instagram?.isHidden && footerLinks.connect?.isHidden;

  return (
    <footer className="footer" id="site-footer">
      <div className="container">
        {/* Top Section - Large Brand & Links */}
        <div className="footer__top">
          <div className="footer__brand-col">
            {(settings?.companyName || settings?.vendorAddress) && (
              <div className="footer__company-info">
                {settings?.companyName && (
                  <p className="footer__company">{settings.companyName}</p>
                )}
                {settings?.ahuNumber && (
                  <p className="footer__ahu">{settings.ahuNumber}</p>
                )}
                {settings?.vendorAddress && (
                  <p className="footer__address">{settings.vendorAddress}</p>
                )}
              </div>
            )}
          </div>

          {!allHidden && (
            <div className="footer__links-col">
              {renderFooterLink(footerLinks.aboutMe, 'FIND OUT MORE', 'About me', '#')}
              {renderFooterLink(footerLinks.instagram, 'FOLLOW ME ON', 'Instagram', '#')}
              {renderFooterLink(footerLinks.connect, 'GET IN TOUCH', 'Connect', '/booking')}
            </div>
          )}
        </div>

        {/* Bottom Section - Copyright & Actions */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            {settings?.copyrightText || `© ${new Date().getFullYear()} ${settings?.brandName || 'Portfolio'}. All rights reserved.`}
          </p>
          <button
            className="footer__back-to-top"
            onClick={scrollToTop}
            aria-label="Back to top"
            id="back-to-top"
            title="Back to Top"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </footer>
  );
}
