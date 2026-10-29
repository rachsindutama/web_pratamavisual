import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { useVisitorTracker } from '../../hooks/useVisitorTracker';

export default function Layout() {
  const { pathname } = useLocation();
  useVisitorTracker();

  useEffect(() => {
    // Force scroll to top on route change
    // Using requestAnimationFrame ensures it runs after DOM paint
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      // Double check in case of layout shifts
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }, 50);
    });
  }, [pathname]);

  return (
    <>
      <Navbar transparent={false} />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

