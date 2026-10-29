import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import '../../styles/navbar.css';

export default function Navbar({ transparent = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const { settings, loading } = useSiteSettings();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navClass = transparent && !scrolled && !mobileOpen
    ? 'navbar navbar--transparent'
    : 'navbar navbar--solid';


  return (
    <>
      <nav className={navClass} id="main-navbar">
        <div className="navbar__brand">
          <Link to="/">{settings?.brandName || (loading ? '' : 'PORTFOLIO')}</Link>
        </div>

        <div className="navbar__links">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
            end
          >
            HOME
          </NavLink>
          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            PRICING
          </NavLink>
          <NavLink
            to="/booking"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            BOOKING
          </NavLink>
        </div>

        <div className="navbar__auth-links">
          {user ? (
            <>
              {!isAdmin && (
                <Link to="/my-bookings" className="navbar__auth-link">
                  My Bookings
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="navbar__auth-link">
                  Settings
                </Link>
              )}
              <button onClick={logout} className="navbar__auth-link">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="navbar__auth-link">
              Login
            </Link>
          )}
        </div>

        <button
          className={`navbar__toggle ${mobileOpen ? 'navbar__toggle--open' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          id="mobile-menu-toggle"
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text)' }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`navbar__mobile-menu ${mobileOpen ? 'navbar__mobile-menu--open' : ''}`}
        id="mobile-menu"
      >
        <NavLink to="/" className="navbar__mobile-link" end>
          HOME
        </NavLink>
        <NavLink to="/pricing" className="navbar__mobile-link">
          PRICING
        </NavLink>
        <NavLink to="/booking" className="navbar__mobile-link">
          BOOKING
        </NavLink>
        {user ? (
          <>
            {!isAdmin && (
              <NavLink to="/my-bookings" className="navbar__mobile-link">
                My Bookings
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className="navbar__mobile-link">
                Settings
              </NavLink>
            )}
            <button
              onClick={() => { logout(); setMobileOpen(false); }}
              className="navbar__mobile-link"
              style={{ background: 'none', border: 'none' }}
            >
              Logout
            </button>
          </>
        ) : (
          <NavLink to="/login" className="navbar__mobile-link">
            Login
          </NavLink>
        )}
      </div>
    </>
  );
}
