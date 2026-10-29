import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFCM } from '../../hooks/useFCM';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  LayoutDashboard,
  Settings,
  FolderOpen,
  Images,
  DollarSign,
  Mail,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  Tags,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Bell,
  Download,
  Video,
  Server,
  FileText
} from 'lucide-react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import '../../styles/admin.css';

const sidebarLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/settings', label: 'Site Settings', icon: Settings },
  { to: '/admin/bookings', label: 'Bookings', icon: FolderOpen },
  { to: '/admin/cashflow', label: 'Cashflow', icon: DollarSign },
  { to: '/admin/taxes', label: 'Tax PPh', icon: FileText },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/album', label: 'Albums', icon: Images },
  { to: '/admin/videos', label: 'Videos', icon: Video },
  { to: '/admin/pricing', label: 'Pricing', icon: CreditCard },
  { to: '/admin/testimonials', label: 'Testimonials', icon: MessageSquare },
  { to: '/admin/file-server', label: 'File Server', icon: Server },
  { to: '/admin/hard-reset', label: 'Hard Reset', icon: AlertTriangle },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { permissionState, requestPermission } = useFCM();
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: bookings } = useFirestoreCollection('bookings');
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();

  useEffect(() => {
    const scrollToTop = () => {
      const wrapper = document.querySelector('.admin-content-wrapper');
      if (wrapper) wrapper.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    requestAnimationFrame(() => {
      scrollToTop();
      setTimeout(scrollToTop, 50);
    });
  }, [pathname]);

  const unreadCount = bookings.filter(b => b.hasUnreadUpdates).length;

  // OS App Badging API
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(console.error);
      } else {
        navigator.clearAppBadge().catch(console.error);
      }
    }
  }, [unreadCount]);

  return (
    <div className="admin-layout" id="admin-layout">
      {/* Mobile Toggle */}
      {!sidebarOpen && (
        <button
          className="admin-sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`} id="admin-sidebar">
        <div className="admin-sidebar__brand">{settings?.brandName || 'PORTFOLIO'}</div>

        <div className="admin-sidebar__label">Management</div>

        {sidebarLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <link.icon className="admin-sidebar__link-icon" size={18} />
                {link.label}
              </div>
              {link.label === 'Bookings' && unreadCount > 0 && (
                <span style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-bg)',
                  borderRadius: '50%',
                  padding: '0.1rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <div className="admin-sidebar__footer">
          <Link to="/" className="admin-sidebar__back">
            <ArrowLeft size={14} />
            Back to Website
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-content-wrapper">
        {/* Top Navbar */}
        <header className="admin-top-navbar">
          <h2>Admin Panel</h2>
          <div className="admin-top-navbar-right">
            <span className="admin-top-navbar-user">{user?.displayName || user?.email}</span>
            <button onClick={logout} className="admin-btn admin-btn--secondary" style={{ padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-main">
          {canInstall && !isInstalled && (
            <div style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))', border: '1px solid var(--color-accent)', padding: '1rem 1.25rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <h3 style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}><Download size={16} /> Install App</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>Install this app for faster access!</p>
              </div>
              <button onClick={promptInstall} className="admin-btn admin-btn--primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                Install
              </button>
            </div>
          )}
          {permissionState === 'default' && (
            <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid var(--color-accent)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bell size={16} /> Enable Push Notifications</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{settings?.notificationTextAdmin || 'Get instantly notified when a client books a session or submits a testimonial.'}</p>
              </div>
              <button onClick={requestPermission} className="admin-btn admin-btn--primary">
                Enable
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
