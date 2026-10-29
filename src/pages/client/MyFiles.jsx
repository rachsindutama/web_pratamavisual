import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  Folder, File, HardDrive,
  Download, ChevronRight, RefreshCw,
  Wifi, WifiOff, FileImage, FileVideo,
  Star, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  ArrowDownAZ, ArrowUpZA, Calendar, HardDrive as SizeIcon, ArrowUpDown,
  LayoutList, LayoutGrid, ArrowUp, FileText, Home, Search, AlertCircle
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LoadingState, { PixelLoader } from '../../components/ui/LoadingState';
import '../../styles/admin.css';
import '../../styles/files.css';

// Pure helpers — defined at module level so they're available before component init
const isImage = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
};

const isRawImage = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  return ['raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf'].includes(ext);
};

const isVideo = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
};

const getFileTypeLabel = (item) => {
  if (item.isDir) return 'Folder';
  const ext = item.name.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg'].includes(ext)) return 'JPEG Image';
  if (ext === 'png') return 'PNG Image';
  if (ext === 'webp') return 'WebP Image';
  if (ext === 'gif') return 'GIF Image';
  if (['raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf'].includes(ext)) return 'RAW Photo';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return ext.toUpperCase() + ' Video';
  if (ext === 'pdf') return 'PDF Document';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Archive';
  return ext ? ext.toUpperCase() + ' File' : 'File';
};

const formatDateModified = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '—';
  }
};

const AuthMedia = ({ serverUrl, filePath, authToken, isVideo, ...props }) => {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let isMounted = true;

    const fetchMedia = async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(`${serverUrl}/api/files/preview?path=${encodeURIComponent(filePath)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': '69420'
          }
        });
        if (res.ok) {
          const blob = await res.blob();
          if (isMounted) {
            objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
          }
        } else {
          if (isMounted) setError(true);
        }
      } catch (err) {
        console.error('Failed to load media:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (serverUrl && filePath && authToken) fetchMedia();
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [serverUrl, filePath, authToken]);

  if (loading) {
    if (props.className === 'lightbox-media') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <LoadingState variant="Drive" label="Memuat media..." />
        </div>
      );
    }
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
        <PixelLoader variant="Drive" size={3} gap={1} />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
        <FileImage size={14} style={{ opacity: 0.5, color: '#38bdf8' }} />
      </div>
    );
  }

  if (isVideo) {
    return <video src={blobUrl} {...props} />;
  }
  return <img src={blobUrl} {...props} />;
};

export default function MyFiles() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const serverUrl = settings?.localFileServerUrl?.replace(/\/$/, '') || '';

  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [error, setError] = useState('');
  const [tags, setTags] = useState({});
  const [taggedList, setTaggedList] = useState([]);
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'starred'
  const [authToken, setAuthToken] = useState('');
  const [previewIndex, setPreviewIndex] = useState(null); // index into activeMediaFiles array

  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');

  const sortedFiles = React.useMemo(() => {
    return [...files].sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;

      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'date') cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0);

      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [files, sortBy, sortOrder]);

  const sortedTaggedList = React.useMemo(() => {
    return [...taggedList].sort((a, b) => {
      const aName = a.fileName || a.path.split('/').pop() || '';
      const bName = b.fileName || b.path.split('/').pop() || '';
      let cmp = 0;
      if (sortBy === 'name') cmp = aName.localeCompare(bName);
      else if (sortBy === 'date') cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [taggedList, sortBy, sortOrder]);

  const filteredFiles = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedFiles;
    const q = searchQuery.toLowerCase();
    return sortedFiles.filter(f => f.name.toLowerCase().includes(q));
  }, [sortedFiles, searchQuery]);

  const filteredTaggedList = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedTaggedList;
    const q = searchQuery.toLowerCase();
    return sortedTaggedList.filter(t => (t.fileName || t.path).toLowerCase().includes(q));
  }, [sortedTaggedList, searchQuery]);

  // Active media items for lightbox preview
  const activeMediaFiles = React.useMemo(() => {
    if (activeTab === 'starred') {
      return filteredTaggedList
        .filter(t => isImage(t.fileName || t.path) || isVideo(t.fileName || t.path))
        .map(t => ({
          name: t.fileName || t.path.split('/').pop(),
          path: t.path,
          isDir: false,
          modifiedAt: t.updatedAt
        }));
    }
    return filteredFiles
      .filter(f => !f.isDir && (isImage(f.name) || isVideo(f.name)))
      .map(f => ({
        ...f,
        path: currentPath === '/' ? `/${f.name}` : `${currentPath}/${f.name}`
      }));
  }, [activeTab, filteredTaggedList, filteredFiles, currentPath]);

  const previewFile = previewIndex !== null ? (() => {
    const item = activeMediaFiles[previewIndex];
    if (!item) return null;
    return { name: item.name, path: item.path, isVideo: isVideo(item.name), item };
  })() : null;

  // Transfer state
  const [transfer, setTransfer] = useState(null); // { type: 'upload'|'download', progress: 0, file: '', speed: '' }

  useEffect(() => {
    document.title = `My Files — ${settings?.brandName || ''}`;
  }, [settings]);

  const fetchTags = async () => {
    try {
      if (!user) return;
      const q = query(collection(db, 'fileTags'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const tagsData = {};
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        tagsData[d.path] = true;
        list.push({ id: doc.id, ...d });
      });
      setTags(tagsData);
      setTaggedList(list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  const initData = async (targetPath = '/') => {
    setInitialLoading(true);
    setError('');

    let activeServerUrl = serverUrl;
    let isFileServerEnabled = settings?.fileServerEnabled !== false;

    // Fetch fresh settings from Firestore so user doesn't get stuck on stale state
    try {
      const adminId = import.meta.env.VITE_DEFAULT_ADMIN_ID || 'DEFAULT_ADMIN_UID';
      const snap = await getDoc(doc(db, 'siteSettings', adminId));
      if (snap.exists()) {
        const fresh = snap.data();
        if (fresh.fileServerEnabled !== undefined) {
          isFileServerEnabled = Boolean(fresh.fileServerEnabled);
        }
        if (fresh.localFileServerUrl) {
          activeServerUrl = fresh.localFileServerUrl.replace(/\/$/, '');
        }
      }
    } catch (err) {
      console.warn('Could not re-fetch site settings:', err);
    }

    // Check if File Server has been explicitly disabled by Admin
    if (!isFileServerEnabled) {
      setServerStatus('disabled');
      setError('Layanan file server sedang dinonaktifkan sementara. Anda akan dapat mengaksesnya kembali setelah admin mengaktifkannya.');
      setInitialLoading(false);
      return;
    }

    if (!activeServerUrl) {
      setServerStatus('offline');
      setError('File server URL is not configured.');
      setInitialLoading(false);
      return;
    }

    try {
      // 1. Health check
      const healthRes = await fetch(`${activeServerUrl}/api/health`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'ngrok-skip-browser-warning': '69420' }
      });
      if (!healthRes.ok) throw new Error('Cannot connect to local server.');

      setServerStatus('online');

      // 2. Fetch files directly
      const token = user ? await user.getIdToken() : '';
      if (token) setAuthToken(token);

      const filesRes = await fetch(`${activeServerUrl}/api/files?path=${encodeURIComponent(targetPath)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420'
        }
      });
      if (!filesRes.ok) {
        const errData = await filesRes.json();
        throw new Error(errData.error || 'Failed to load files');
      }
      const data = await filesRes.json();
      setFiles((data.items || []).sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      }));
      setCurrentPath(targetPath);

      // 3. Fetch tags
      fetchTags();
    } catch (err) {
      console.error(err);
      setServerStatus('offline');
      setError('Tidak dapat terhubung ke server lokal. Admin mungkin sedang mematikan komputer atau server lokal tidak aktif.');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    initData('/');
  }, [serverUrl, settings?.fileServerEnabled]);

  const toggleTag = async (item, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (item.isDir) return;

    const filePath = item.path || (currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`);
    const docId = `${user.uid}_${btoa(encodeURIComponent(filePath)).replace(/[\/\+]/g, '_').slice(0, 30)}`; // safe doc id

    const isTagged = tags[filePath];

    try {
      if (isTagged) {
        await deleteDoc(doc(db, 'fileTags', docId));
        setTags(prev => { const n = { ...prev }; delete n[filePath]; return n; });
        setTaggedList(prev => prev.filter(t => t.path !== filePath));
      } else {
        const newTag = {
          userId: user.uid,
          path: filePath,
          fileName: item.name,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'fileTags', docId), newTag);
        setTags(prev => ({ ...prev, [filePath]: true }));
        setTaggedList(prev => [newTag, ...prev.filter(t => t.path !== filePath)]);
      }
    } catch (err) {
      console.error('Error toggling tag:', err);
      alert('Failed to save selection.');
    }
  };

  const getHeaders = async () => {
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'ngrok-skip-browser-warning': '69420'
    };
  };

  const cleanPath = (p) => {
    if (!p || p === '/') return '/';
    const parts = p.split('/').filter(Boolean);
    return parts.length === 0 ? '/' : ('/' + parts.join('/'));
  };

  const getParentPath = (p) => {
    if (!p || p === '/') return '/';
    const parts = p.split('/').filter(Boolean);
    if (parts.length <= 1) return '/';
    parts.pop();
    return '/' + parts.join('/');
  };

  const loadFiles = async (targetPath) => {
    const pathToLoad = cleanPath(targetPath);
    setLoading(true);
    setError('');
    try {
      const headers = await getHeaders();
      const res = await fetch(`${serverUrl}/api/files?path=${encodeURIComponent(pathToLoad)}`, { headers });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setFiles((data.items || []).sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      }));
      setCurrentPath(pathToLoad);
      setServerStatus('online');
    } catch (err) {
      console.error('Error loading files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (targetPath) => {
    setSearchQuery('');
    loadFiles(targetPath);
  };

  const navigateUp = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (currentPath === '/') return;
    const parent = getParentPath(currentPath);
    setSearchQuery('');
    loadFiles(parent);
  };

  const handleHeaderSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (name, isDir) => {
    if (isDir) return <Folder size={32} />;
    const ext = name.split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return <FileVideo size={32} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf'].includes(ext)) return <FileImage size={32} />;
    return <File size={32} />;
  };

  const handleFileClick = (item, explicitPath = null) => {
    if (item.isDir) {
      const currentClean = currentPath === '/' ? '' : cleanPath(currentPath);
      const folderPath = explicitPath || `${currentClean}/${item.name}`;
      navigateTo(folderPath);
      return;
    }
    const currentClean = currentPath === '/' ? '' : cleanPath(currentPath);
    const filePath = explicitPath || item.path || `${currentClean}/${item.name}`;
    if (isImage(item.name) || isVideo(item.name)) {
      const idx = activeMediaFiles.findIndex(f => f.path === filePath);
      if (idx !== -1) setPreviewIndex(idx);
    }
  };

  const goNext = useCallback(() => {
    setPreviewIndex(prev => (prev === null ? null : (prev + 1) % activeMediaFiles.length));
  }, [activeMediaFiles.length]);

  const goPrev = useCallback(() => {
    setPreviewIndex(prev => (prev === null ? null : (prev - 1 + activeMediaFiles.length) % activeMediaFiles.length));
  }, [activeMediaFiles.length]);

  const closeLightbox = useCallback(() => setPreviewIndex(null), []);

  // Keyboard navigation
  useEffect(() => {
    if (previewIndex === null) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewIndex, goNext, goPrev, closeLightbox]);

  // Toggle tag from lightbox (no event object needed)
  const toggleTagFromLightbox = async () => {
    if (!previewFile) return;
    const { item, path: filePath } = previewFile;
    const docId = `${user.uid}_${btoa(encodeURIComponent(filePath)).replace(/[\/\+]/g, '_').slice(0, 30)}`;
    const isTagged = tags[filePath];
    try {
      if (isTagged) {
        await deleteDoc(doc(db, 'fileTags', docId));
        setTags(prev => { const n = { ...prev }; delete n[filePath]; return n; });
        setTaggedList(prev => prev.filter(t => t.path !== filePath));
      } else {
        const newTag = {
          userId: user.uid,
          path: filePath,
          fileName: item.name || previewFile.name,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'fileTags', docId), newTag);
        setTags(prev => ({ ...prev, [filePath]: true }));
        setTaggedList(prev => [newTag, ...prev.filter(t => t.path !== filePath)]);
      }
    } catch (err) {
      console.error('Error toggling tag:', err);
      alert('Failed to save selection.');
    }
  };


  // Download Logic
  const handleDownload = async (item, e, customPath = null) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (item.isDir) return; // Can't download dir directly yet

    const filePath = customPath || item.path || (currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`);
    setTransfer({ type: 'download', progress: 0, file: item.name, speed: 'Starting...' });

    try {
      const token = await user.getIdToken();

      const res = await fetch(`${serverUrl}/api/files/download?path=${encodeURIComponent(filePath)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420'
        }
      });

      if (!res.ok) throw new Error('Download failed');

      const contentLength = res.headers.get('content-length');
      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = res.body.getReader();
      const chunks = [];
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        const now = Date.now();
        const duration = (now - startTime) / 1000;
        const speedBps = duration > 0 ? loaded / duration : 0;

        if (total) {
          setTransfer(prev => ({
            ...prev,
            progress: Math.round((loaded * 100) / total),
            speed: formatSize(speedBps) + '/s'
          }));
        }
      }

      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setTransfer(null);
    } catch (err) {
      console.error(err);
      alert('Download failed: ' + err.message);
      setTransfer(null);
    }
  };

  // Server Disabled by Admin State
  if (serverStatus === 'disabled') {
    return (
      <div className="files-page">
        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">Direct Access</h1>
            <p className="admin-header__subtitle">Akses dan kelola file server lokal secara langsung</p>
          </div>
        </div>
        <div className="admin-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: 'var(--color-accent)' }}>
            <AlertCircle size={26} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--color-text)' }}>
            File Server Sedang Dinonaktifkan
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
            {error || 'Layanan file server sedang dinonaktifkan sementara. Anda akan dapat mengaksesnya kembali setelah admin mengaktifkannya.'}
          </p>
          <button
            onClick={() => initData(currentPath)}
            disabled={initialLoading}
            className="admin-btn admin-btn--secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: initialLoading ? 0.7 : 1 }}
          >
            <RefreshCw size={14} className={initialLoading ? 'animate-spin' : ''} />
            <span>{initialLoading ? 'Memeriksa...' : 'Cek Server'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Server Offline State
  if (serverStatus === 'offline') {
    return (
      <div className="files-page">
        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">Direct Access</h1>
            <p className="admin-header__subtitle">Akses dan kelola file server lokal secara langsung</p>
          </div>
        </div>
        <div className="admin-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: '#ef4444' }}>
            <WifiOff size={26} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--color-text)' }}>
            Server Sedang Offline
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            {error || 'Tidak dapat terhubung ke server lokal. Admin mungkin sedang mematikan komputer atau server lokal tidak aktif.'}
          </p>
          <button
            onClick={() => initData(currentPath)}
            disabled={initialLoading}
            className="admin-btn admin-btn--primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: initialLoading ? 0.7 : 1 }}
          >
            <RefreshCw size={14} className={initialLoading ? 'animate-spin' : ''} />
            <span>{initialLoading ? 'Menghubungkan...' : 'Coba Hubungkan Ulang'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Online State
  return (
    <div className="files-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Direct Access</h1>
          <p className="admin-header__subtitle">Akses dan kelola file server lokal secara langsung</p>
        </div>
      </div>

      {/* Segmented Sub-Tabs */}
      <div className="afm-tabs-segmented">
        <button
          type="button"
          className={`afm-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Folder size={14} />
          <span>Semua File</span>
        </button>
        <button
          type="button"
          className={`afm-tab-btn ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => setActiveTab('starred')}
        >
          <Star size={14} fill={activeTab === 'starred' ? 'currentColor' : 'none'} />
          <span>Favorit / Tag</span>
          {taggedList.length > 0 && (
            <span className="afm-tab-badge">{taggedList.length}</span>
          )}
        </button>
      </div>

      <div className="afm-card animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
        {/* Top Bar: Compact Action Toolbar */}
        <div className="afm-topbar">
          <div className="afm-header-info" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {/* Status Pill */}
            <div className={`files-status-pill ${serverStatus}`}>
              <span className={`status-dot status-dot--${serverStatus}`} />
              <span>Online</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'starred') fetchTags();
                else loadFiles(currentPath);
              }}
              className="afm-icon-btn afm-refresh-btn"
              title="Segarkan data"
              disabled={loading}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Current Folder / Mode Badge */}
            <span className="afm-current-badge">
              <HardDrive size={13} className="text-accent" />
              <strong style={{ color: 'var(--color-text)' }}>
                {activeTab === 'starred' ? 'Favorit' : (currentPath.split('/').filter(Boolean).pop() || 'Home')}
              </strong>
              <span className="afm-count-pill">
                {activeTab === 'starred' ? `${filteredTaggedList.length} item` : `${filteredFiles.length} item`}
              </span>
            </span>
          </div>

          <div className="afm-actions-group">
            {/* Sort Controls */}
            <div className="files-sort-chip">
              <span className="files-sort-label">Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="files-sort-select"
              >
                <option value="name">Name</option>
                <option value="date">Date</option>
                {activeTab === 'files' && <option value="size">Size</option>}
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="files-sort-toggle-btn"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
              </button>
            </div>

            {/* View Toggle */}
            <div className="files-view-toggle">
              <button
                type="button"
                className={`files-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                className={`files-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation & Search Bar */}
        <div className="afm-nav-bar">
          {activeTab === 'files' ? (
            <div className="afm-path-wrapper">
              <button
                type="button"
                className="afm-icon-btn afm-nav-btn"
                disabled={currentPath === '/'}
                onClick={navigateUp}
                title="Ke Folder Induk"
              >
                <ArrowUp size={12} />
              </button>

              <div className="afm-crumbs-list">
                <button
                  type="button"
                  className={`afm-crumb-btn ${currentPath === '/' ? 'active' : ''}`}
                  onClick={() => navigateTo('/')}
                  title="Home (Root)"
                >
                  <Home size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                  Home
                </button>
                {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((part, idx, arr) => {
                  const pathToPart = '/' + arr.slice(0, idx + 1).join('/');
                  const isLast = idx === arr.length - 1;
                  return (
                    <span key={pathToPart} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', flexShrink: 0 }}>
                      <ChevronRight size={10} style={{ opacity: 0.4 }} />
                      <button
                        type="button"
                        className={`afm-crumb-btn ${isLast ? 'active' : ''}`}
                        onClick={() => {
                          if (!isLast) navigateTo(pathToPart);
                        }}
                        title={pathToPart}
                        style={{ cursor: isLast ? 'default' : 'pointer' }}
                      >
                        {part}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="afm-path-wrapper" style={{ padding: '0.35rem 0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-accent)' }}>
                <Star size={13} fill="currentColor" />
                <span>Daftar File Favorit / Berbintang yang Anda Pilih</span>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="afm-search-wrapper">
            <Search size={12} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="admin-input afm-search-input"
              placeholder={activeTab === 'starred' ? "Cari dalam file favorit..." : "Cari file..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Dropzone & File List */}
        <div className="afm-dropzone">
          {files.length === 0 && initialLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '0.45rem', color: 'var(--color-text-muted)' }}>
              <PixelLoader variant="Drive" size={3} gap={1} />
              <span style={{ fontSize: '0.8rem' }}>Memuat file...</span>
            </div>
          ) : activeTab === 'starred' ? (
            filteredTaggedList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '0.4rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                <Star size={32} style={{ opacity: 0.25, color: 'var(--color-accent)' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}>
                  {searchQuery ? `Tidak ada file favorit yang cocok dengan "${searchQuery}"` : 'Belum ada file favorit / pilihan'}
                </p>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                  Beri bintang (★) pada file di tab "Semua File" atau di Lightbox untuk menambahkannya ke sini.
                </span>
              </div>
            ) : viewMode === 'list' ? (
              <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                {filteredTaggedList.map((tag, idx) => {
                  const fileName = tag.fileName || tag.path.split('/').pop();
                  const folderPath = tag.path.substring(0, tag.path.lastIndexOf('/')) || '/';
                  const item = { name: fileName, path: tag.path, isDir: false };
                  const formattedDate = tag.updatedAt ? new Date(tag.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                  const typeLabel = isImage(fileName) ? 'Gambar' : isVideo(fileName) ? 'Video' : 'File';

                  return (
                    <div
                      key={tag.id || idx}
                      className="afm-row tagged"
                      onClick={() => handleFileClick(item, tag.path)}
                    >
                      <div className="afm-row-left">
                        {isImage(fileName) ? (
                          <div className="afm-row-thumb">
                            {authToken ? (
                              <AuthMedia
                                serverUrl={serverUrl}
                                filePath={tag.path}
                                authToken={authToken}
                                isVideo={false}
                                alt={fileName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <PixelLoader variant="Drive" size={2} gap={1} />
                            )}
                          </div>
                        ) : isVideo(fileName) ? (
                          <FileVideo size={18} style={{ color: '#c084fc', flexShrink: 0 }} />
                        ) : (
                          <FileText size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        )}

                        <div className="afm-row-meta">
                          <span className="afm-row-title" title={fileName}>
                            {fileName}
                          </span>
                          <div className="afm-row-subtext">
                            <span>{typeLabel}</span>
                            <span>• {folderPath}</span>
                            {tag.updatedAt && <span>• {formattedDate}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="afm-desktop-meta">
                        <span className="files-type-pill" style={{ fontSize: '0.7rem' }}>{folderPath}</span>
                      </div>

                      <div className="afm-row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="afm-icon-btn active text-accent"
                          onClick={(e) => toggleTag(item, e)}
                          title="Hapus bintang"
                          style={{ borderColor: 'rgba(212, 175, 55, 0.4)', background: 'rgba(212, 175, 55, 0.12)' }}
                        >
                          <Star size={13} fill="currentColor" className="text-accent" />
                        </button>
                        <button
                          type="button"
                          className="afm-icon-btn"
                          onClick={(e) => handleDownload(item, e, tag.path)}
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ maxHeight: '560px', overflowY: 'auto', padding: '0.65rem' }}>
                <div className="files-compact-grid">
                  {filteredTaggedList.map((tag, idx) => {
                    const fileName = tag.fileName || tag.path.split('/').pop();
                    const folderPath = tag.path.substring(0, tag.path.lastIndexOf('/')) || '/';
                    const item = { name: fileName, path: tag.path, isDir: false };

                    return (
                      <div
                        key={tag.id || idx}
                        className="files-grid-card files-grid-card--file tagged"
                        onClick={() => handleFileClick(item, tag.path)}
                      >
                        <div className="files-grid-card-thumb">
                          {isImage(fileName) && authToken ? (
                            <AuthMedia
                              serverUrl={serverUrl}
                              filePath={tag.path}
                              authToken={authToken}
                              isVideo={false}
                              alt={fileName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : isImage(fileName) ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <PixelLoader variant="Drive" size={4} gap={1.5} />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                              {getFileIcon(fileName, false)}
                            </div>
                          )}

                          <div className="files-grid-card-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="files-grid-icon-btn active"
                              onClick={(e) => toggleTag(item, e)}
                              title="Hapus bintang"
                            >
                              <Star size={13} fill="currentColor" className="text-accent" />
                            </button>
                            <button
                              type="button"
                              className="files-grid-icon-btn"
                              onClick={(e) => handleDownload(item, e, tag.path)}
                              title="Download"
                            >
                              <Download size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="files-grid-card-footer">
                          <span className="files-grid-card-name" title={fileName}>{fileName}</span>
                          <span className="files-grid-card-size">{folderPath}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : filteredFiles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '0.6rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 1.5rem' }}>
              <Folder size={36} style={{ opacity: 0.25 }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                {searchQuery ? `Tidak ada file yang cocok dengan "${searchQuery}"` : 'Folder ini kosong'}
              </p>
              {currentPath !== '/' && (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={navigateUp}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.35rem 0.85rem', marginTop: '0.4rem', cursor: 'pointer' }}
                >
                  <ArrowUp size={13} className="text-accent" />
                  <span>Kembali ke Folder Sebelumnya</span>
                </button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
              {currentPath !== '/' && (
                <div
                  className="afm-row is-dir"
                  onClick={navigateUp}
                  style={{ cursor: 'pointer', background: 'rgba(212, 175, 55, 0.04)' }}
                  title="Kembali ke folder sebelumnya"
                >
                  <div className="afm-row-left">
                    <Folder size={18} className="text-accent" style={{ flexShrink: 0 }} />
                    <div className="afm-row-meta">
                      <span className="afm-row-title" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>..</span>
                      <div className="afm-row-subtext"><span className="text-accent" style={{ fontWeight: 500 }}>Kembali ke folder sebelumnya</span></div>
                    </div>
                  </div>
                  <div className="afm-row-actions" style={{ pointerEvents: 'none' }}>
                    <ArrowUp size={14} className="text-accent" style={{ marginRight: '6px' }} />
                  </div>
                </div>
              )}

              {filteredFiles.map((item, idx) => {
                const currentClean = currentPath === '/' ? '' : cleanPath(currentPath);
                const filePath = `${currentClean}/${item.name}`;
                const isTagged = tags[filePath];
                const typeLabel = getFileTypeLabel(item);
                const formattedDate = formatDateModified(item.modifiedAt);
                const formattedSize = item.isDir ? 'Folder' : formatSize(item.size);

                return (
                  <div
                    key={item.name || idx}
                    className={`afm-row ${item.isDir ? 'is-dir' : ''} ${isTagged ? 'tagged' : ''}`}
                    onClick={() => handleFileClick(item, filePath)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="afm-row-left">
                      {item.isDir ? (
                        <Folder size={18} className="text-accent" style={{ flexShrink: 0 }} />
                      ) : isImage(item.name) ? (
                        <div className="afm-row-thumb">
                          {authToken ? (
                            <AuthMedia
                              serverUrl={serverUrl}
                              filePath={filePath}
                              authToken={authToken}
                              isVideo={false}
                              alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <PixelLoader variant="Drive" size={2} gap={1} />
                          )}
                        </div>
                      ) : isVideo(item.name) ? (
                        <FileVideo size={18} style={{ color: '#c084fc', flexShrink: 0 }} />
                      ) : (
                        <FileText size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      )}

                      <div className="afm-row-meta">
                        <span className="afm-row-title" title={item.name}>
                          {item.name}
                        </span>
                        <div className="afm-row-subtext">
                          <span>{formattedSize}</span>
                          {item.modifiedAt && <span>• {formattedDate}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="afm-desktop-meta">
                      <span className="files-type-pill">{typeLabel}</span>
                    </div>

                    <div className="afm-row-actions" onClick={(e) => { if (!item.isDir) e.stopPropagation(); }}>
                      {!item.isDir && (
                        <button
                          type="button"
                          className={`afm-icon-btn ${isTagged ? 'active text-accent' : ''}`}
                          onClick={(e) => toggleTag(item, e)}
                          title={isTagged ? 'Hapus bintang' : 'Tandai bintang'}
                          style={isTagged ? { borderColor: 'rgba(212, 175, 55, 0.4)', background: 'rgba(212, 175, 55, 0.12)' } : {}}
                        >
                          <Star size={13} fill={isTagged ? 'currentColor' : 'none'} className={isTagged ? 'text-accent' : 'text-muted'} />
                        </button>
                      )}

                      {!item.isDir && (
                        <button
                          type="button"
                          className="afm-icon-btn"
                          onClick={(e) => handleDownload(item, e)}
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      )}

                      {item.isDir && (
                        <ChevronRight size={14} className="text-muted" style={{ opacity: 0.5, marginRight: '4px', pointerEvents: 'none' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ maxHeight: '560px', overflowY: 'auto', padding: '0.65rem' }}>
              <div className="files-compact-grid">
                {currentPath !== '/' && (
                  <div
                    className="files-grid-card files-grid-card--folder"
                    onClick={navigateUp}
                    style={{ cursor: 'pointer', borderColor: 'rgba(212, 175, 55, 0.35)', background: 'rgba(212, 175, 55, 0.04)' }}
                    title="Kembali ke folder sebelumnya"
                  >
                    <Folder size={22} className="text-accent" />
                    <div className="files-grid-card-info">
                      <span className="files-grid-card-name" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>.. (Kembali)</span>
                      <span className="files-grid-card-date">Folder Sebelumnya</span>
                    </div>
                  </div>
                )}

                {filteredFiles.map((item, idx) => {
                  const currentClean = currentPath === '/' ? '' : cleanPath(currentPath);
                  const filePath = `${currentClean}/${item.name}`;
                  const isTagged = tags[filePath];

                  if (item.isDir) {
                    return (
                      <div
                        key={item.name || idx}
                        className="files-grid-card files-grid-card--folder"
                        onClick={() => handleFileClick(item, filePath)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Folder size={22} className="text-accent" style={{ flexShrink: 0 }} />
                        <div className="files-grid-card-info">
                          <span className="files-grid-card-name" title={item.name}>{item.name}</span>
                          <span className="files-grid-card-date">
                            {item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Folder'}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`files-grid-card files-grid-card--file ${isTagged ? 'tagged' : ''}`}
                      onClick={() => handleFileClick(item, filePath)}
                    >
                      <div className="files-grid-card-thumb">
                        {isImage(item.name) && authToken ? (
                          <AuthMedia
                            serverUrl={serverUrl}
                            filePath={filePath}
                            authToken={authToken}
                            isVideo={false}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : isImage(item.name) ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <PixelLoader variant="Drive" size={4} gap={1.5} />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                            {getFileIcon(item.name, item.isDir)}
                          </div>
                        )}

                        <div className="files-grid-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`files-grid-icon-btn ${isTagged ? 'active' : ''}`}
                            onClick={(e) => toggleTag(item, e)}
                            title="Bintang"
                          >
                            <Star size={13} fill={isTagged ? 'currentColor' : 'none'} className={isTagged ? 'text-accent' : 'text-muted'} />
                          </button>
                          <button
                            type="button"
                            className="files-grid-icon-btn"
                            onClick={(e) => handleDownload(item, e)}
                            title="Download"
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="files-grid-card-footer">
                        <span className="files-grid-card-name" title={item.name}>{item.name}</span>
                        <span className="files-grid-card-size">{formatSize(item.size)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Progress Overlay */}
      {transfer && (
        <div className="transfer-overlay">
          <div className="transfer-header">
            <span className="transfer-title">
              {transfer.type === 'upload' ? 'Uploading: ' : 'Downloading: '}
              {transfer.file}
            </span>
            <span className="text-accent">{transfer.progress}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${transfer.progress}%` }}></div>
          </div>
          <div className="transfer-stats">
            <span>{transfer.speed}</span>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewFile && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          {/* Close */}
          <button className="lightbox-close-btn" onClick={closeLightbox} title="Close (Esc)">
            <X size={22} />
          </button>

          {/* Counter */}
          <div className="lightbox-counter">
            {previewIndex + 1} / {activeMediaFiles.length}
          </div>

          {/* Prev Arrow */}
          {activeMediaFiles.length > 1 && (
            <button className="lightbox-nav-btn lightbox-nav-prev" onClick={(e) => { e.stopPropagation(); goPrev(); }} title="Previous">
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Media */}
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {previewFile.isVideo ? (
              <AuthMedia
                key={previewFile.path}
                serverUrl={serverUrl}
                filePath={previewFile.path}
                authToken={authToken}
                isVideo={true}
                controls
                autoPlay
                className="lightbox-media"
              />
            ) : (
              <AuthMedia
                key={previewFile.path}
                serverUrl={serverUrl}
                filePath={previewFile.path}
                authToken={authToken}
                isVideo={false}
                alt={previewFile.name}
                className="lightbox-media"
              />
            )}

            {/* Bottom bar: filename + tag button */}
            <div className="lightbox-bar">
              <span className="lightbox-filename">{previewFile.name}</span>
              <button
                className={`lightbox-tag-btn ${tags[previewFile.path] ? 'tagged' : ''}`}
                onClick={toggleTagFromLightbox}
                title={tags[previewFile.path] ? 'Untag this file' : 'Tag this file'}
              >
                <Star size={18} fill={tags[previewFile.path] ? 'currentColor' : 'none'} />
                {tags[previewFile.path] ? 'Dipilih' : 'Pilih'}
              </button>
            </div>
          </div>

          {/* Next Arrow */}
          {activeMediaFiles.length > 1 && (
            <button className="lightbox-nav-btn lightbox-nav-next" onClick={(e) => { e.stopPropagation(); goNext(); }} title="Next">
              <ChevronRightIcon size={28} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
