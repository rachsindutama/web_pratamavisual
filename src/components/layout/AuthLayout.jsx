import { Outlet, useLocation } from 'react-router-dom';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import '../../styles/auth.css';

export default function AuthLayout() {
  const { settings } = useSiteSettings();
  const location     = useLocation();

  const brandName     = settings?.brandName    || 'Pratamavisual';
  const coverImage    = settings?.loginCover?.imageUrl  || null;
  const coverHeadline = settings?.loginCover?.headline  || settings?.seoTitle || 'Pratamavisual';
  const coverTagline  = settings?.loginCover?.tagline   || settings?.seoDescription || 'Where your love story finds its light.';
  const coverLocation = settings?.loginCover?.location  || 'Surabaya · Jawa Timur';

  return (
    <div className="auth-split">

      {/* ── LEFT COVER — renders once, no re-animation on route change ── */}
      <aside className="auth-cover">
        <div
          className="auth-cover__bg"
          style={coverImage ? { backgroundImage: `url('${coverImage}')` } : {}}
        />
        <div className="auth-cover__overlay" />

        <div className="auth-cover__body">
          <span className="auth-cover__brand">{brandName}</span>
          <div className="auth-cover__line" />

          <h2 className="auth-cover__title">
            {coverHeadline.includes('—') ? (
              <>
                <span>{coverHeadline.split('—')[0].trim()}</span>
                <em>{coverHeadline.split('—')[1]?.trim()}</em>
              </>
            ) : (
              <span>{coverHeadline}</span>
            )}
          </h2>

          <p className="auth-cover__desc">{coverTagline}</p>

          <div className="auth-cover__tags">
            <span>Wedding</span>
            <span className="auth-cover__dot" />
            <span>Prewedding</span>
            <span className="auth-cover__dot" />
            <span>Engagement</span>
          </div>
        </div>

        <span className="auth-cover__location">{coverLocation}</span>
      </aside>

      {/* ── RIGHT FORM PANEL — key berubah saat route ganti → smooth fade-in ── */}
      <main className="auth-panel">
        {/*
          key={location.pathname} memaksa React unmount+remount child
          sehingga animasi fadeInUp pada .auth-card selalu replay saat navigasi
        */}
        <div key={location.pathname} className="auth-panel__inner">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
