import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const globalCache = {};

/**
 * Generic Firestore hook for CRUD operations
 */
export function useFirestoreCollection(collectionName, queryConstraints = []) {
  const cacheKey = collectionName + JSON.stringify(queryConstraints);
  const [data, setData] = useState(globalCache[cacheKey] || []);
  const [loading, setLoading] = useState(!globalCache[cacheKey]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const collRef = collection(db, collectionName);
    const q = queryConstraints.length > 0
      ? query(collRef, ...queryConstraints)
      : query(collRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        globalCache[cacheKey] = results;
        setData(results);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(queryConstraints)]);

  return { data, loading, error, refetch: () => {} };
}

/**
 * Hook for a single Firestore document
 */
export function useFirestoreDoc(collectionName, docId) {
  const cacheKey = docId ? `${collectionName}_${docId}` : null;
  const [data, setData] = useState(cacheKey ? globalCache[cacheKey] : null);
  const [loading, setLoading] = useState(!globalCache[cacheKey]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!docId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const result = { id: docSnap.id, ...docSnap.data() };
        if (cacheKey) globalCache[cacheKey] = result;
        setData(result);
      } else {
        if (cacheKey) globalCache[cacheKey] = null;
        setData(null);
      }
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${collectionName}/${docId}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [collectionName, docId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Helper functions for Firestore CRUD
 */
export async function addDocument(collectionName, data) {
  const docRef = await addDoc(collection(db, collectionName), {
    createdAt: serverTimestamp(),
    ...data,
  });
  return docRef.id;
}

export async function updateDocument(collectionName, docId, data) {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    updatedAt: serverTimestamp(),
    ...data,
  });
}

export async function deleteDocument(collectionName, docId) {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

// Re-export Firestore query helpers for convenience
export { where, orderBy, serverTimestamp, increment };
