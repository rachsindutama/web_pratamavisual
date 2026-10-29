import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'visitor');
          } else {
            setUserRole('visitor');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('visitor');
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  };

  const register = async (email, password, displayName, phone = '') => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update display name
    await updateProfile(result.user, { displayName });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      email,
      displayName,
      phone,
      role: 'visitor',
      photoUrl: '',
      createdAt: serverTimestamp(),
    });

    setUserRole('visitor');
    return result;
  };

  const logout = async () => {
    if (user?.uid) {
      try {
        await setDoc(doc(db, 'users', user.uid), { fcmToken: null }, { merge: true });
      } catch (err) {
        console.error('Failed to remove FCM token on logout:', err);
      }
    }
    await signOut(auth);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // Check if user doc exists, if not create it
    const userDocRef = doc(db, 'users', result.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: result.user.email,
        displayName: result.user.displayName || 'Google User',
        phone: result.user.phoneNumber || '',
        role: 'visitor',
        photoUrl: result.user.photoURL || '',
        createdAt: serverTimestamp(),
      });
      setUserRole('visitor');
    }
    
    return result;
  };

  const isAdmin = userRole === 'admin';

  const resetPassword = async (email) => {
    return await sendPasswordResetEmail(auth, email);
  };

  const value = {
    user,
    userRole,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    resetPassword,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
