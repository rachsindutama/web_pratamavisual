import { useState, useEffect } from 'react';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { messaging, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useFCM() {
  const { user } = useAuth();
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionState, setPermissionState] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!messaging) return;

    // Automatically fetch token on load if permission is already granted
    // This keeps the token fresh without requiring user to click "Enable" every time
    if (user && 'Notification' in window && Notification.permission === 'granted') {
      const fetchSilentToken = async () => {
        try {
          const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY });
          if (token) {
            setFcmToken(token);
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { 
              fcmToken: token,
              fcmTokens: arrayUnion(token)
            }, { merge: true });
          }
        } catch (err) {
          console.warn('Silent token fetch failed:', err);
        }
      };
      fetchSilentToken();
    }

    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received: ', payload);
      
      // Show system notification even when app is open
      if (payload.notification) {
        const notificationOptions = {
          body: payload.notification.body,
          icon: '/favicon.svg',
          vibrate: [200, 100, 200], // Explicitly request vibration
          silent: false // Ensure system notification sound is played
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(payload.notification.title, notificationOptions);
          }).catch(() => {
            if ('Notification' in window) {
              new Notification(payload.notification.title, notificationOptions);
            }
          });
        } else {
          if ('Notification' in window) {
            new Notification(payload.notification.title, notificationOptions);
          }
        }
        
        // Foreground fallback vibration
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const requestPermission = async () => {
    if (!messaging || !user) return false;
    
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications.');
        setError('Notifications are not supported by this browser.');
        return false;
      }

      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: import.meta.env.VITE_VAPID_KEY 
        });
        
        if (token) {
          console.log('FCM Token received:', token);
          setFcmToken(token);
          // Save the token to the user's document using setDoc with merge to avoid 'no document to update' errors
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { 
            fcmToken: token,
            fcmTokens: arrayUnion(token)
          }, { merge: true });
          return true;
        } else {
          console.log('No registration token available. Request permission to generate one.');
          setError('No token generated');
          return false;
        }
      } else {
        console.log('Unable to get permission to notify.');
        return false;
      }
    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
      setError(err.message);
      return false;
    }
  };

  const forceRefresh = async () => {
    if (!messaging || !user) return false;
    try {
      console.log('Forcing token refresh...');
      await deleteToken(messaging);
      const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY });
      if (token) {
        console.log('New FCM Token received:', token);
        setFcmToken(token);
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { 
          fcmToken: token,
          fcmTokens: arrayUnion(token)
        }, { merge: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to force refresh token:', err);
      setError(err.message);
      return false;
    }
  };

  return { requestPermission, forceRefresh, fcmToken, permissionState, error };
}
