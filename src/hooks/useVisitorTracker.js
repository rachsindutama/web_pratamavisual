import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Determines the device category based on viewport width.
 */
function getDeviceCategory() {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Hook that tracks visitor page views and stores them in Firestore.
 * Uses sessionStorage to avoid duplicate entries for the same page
 * within a single browser session.
 */
export function useVisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    const page = location.pathname;
    const sessionKey = `visited_${page}`;

    // Skip if already tracked this page in this session
    if (sessionStorage.getItem(sessionKey)) return;

    const trackVisit = async () => {
      try {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || false;
        
        await addDoc(collection(db, 'visitors'), {
          page,
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent || '',
          referrer: document.referrer || '',
          screenSize: getDeviceCategory(),
          isPWA,
        });
        sessionStorage.setItem(sessionKey, '1');
      } catch (err) {
        // Silently fail — visitor tracking should never break the app
        console.warn('Visitor tracking failed:', err.message);
      }
    };

    trackVisit();
  }, [location.pathname]);
}
