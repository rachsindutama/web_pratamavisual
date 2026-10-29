import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { doc, collection, getDocs, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import {
  Server, Save, RefreshCw, Wifi, WifiOff,
  Shield, ShieldOff, FolderOpen, Folder,
  ChevronRight, ArrowUp, X, Check,
  Tag, Star, CheckSquare, Square, HardDrive,
  Copy, AlertCircle, CheckCircle, XCircle, Info, Trash2, Users
} from 'lucide-react';
import AdminFileManager from '../../components/admin/AdminFileManager';
import '../../styles/files.css';

// ==================== Toast Notification System ====================
function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ToastContainer = () => (
    <div className="fs-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`fs-toast fs-toast--${t.type}`}>
          <div className="fs-toast-icon">
            {t.type === 'success' && <CheckCircle size={18} />}
            {t.type === 'error' && <XCircle size={18} />}
            {t.type === 'warning' && <AlertCircle size={18} />}
            {t.type === 'info' && <Info size={18} />}
          </div>
          <span className="fs-toast-msg">{t.message}</span>
          <button className="fs-toast-close" onClick={() => removeToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );

  return { addToast, removeToast, ToastContainer };
}

// ==================== Confirm Modal ====================
function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = 'Yes', cancelText = 'Cancel', type = 'warning' }) {
  return (
    <div className="folder-picker-overlay" onClick={onCancel} style={{ zIndex: 1100 }}>
      <div className="folder-picker-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <AlertCircle size={48} className={type === 'danger' ? 'text-danger' : 'text-warning'} style={{ margin: '0 auto' }} />
        </div>
        <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
        <p className="text-muted" style={{ marginBottom: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="admin-btn admin-btn--secondary" onClick={onCancel}>{cancelText}</button>
          <button className={`admin-btn admin-btn--${type === 'danger' ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

// ==================== View Tags Modal ====================
function ViewTagsModal({ userId, userName, mappedDir, serverUrl, user, onClose, addToast }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'fileTags'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const tagsData = [];
      snap.forEach(doc => tagsData.push({ id: doc.id, ...doc.data() }));
      setTags(tagsData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      setSelectedPaths({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTags(); }, [userId]);

  const toggleSelection = (path) => {
    setSelectedPaths(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleAll = () => {
    const allSelected = tags.every(t => selectedPaths[t.path]);
    const nextState = {};
    if (!allSelected) tags.forEach(t => nextState[t.path] = true);
    setSelectedPaths(nextState);
  };

  const getSelectedCount = () => Object.values(selectedPaths).filter(Boolean).length;
  const isAllSelected = tags.length > 0 && tags.every(t => selectedPaths[t.path]);
  const isSomeSelected = tags.some(t => selectedPaths[t.path]) && !isAllSelected;

  const startAction = (actionType) => {
    if (!serverUrl) { addToast('File server URL is not configured!', 'error'); return; }
    if (!mappedDir) { addToast('This client does not have a mapped directory!', 'error'); return; }
    setPendingAction(actionType);
    setShowFolderPicker(true);
  };

  const removeTags = async () => {
    const selectedTags = tags.filter(t => selectedPaths[t.path]);
    if (selectedTags.length === 0) return;

    setConfirmDialog({
      title: 'Hapus Tags?',
      message: `Hapus ${selectedTags.length} tag dari database? File aslinya tidak akan terhapus.`,
      type: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setIsProcessing(true);
          for (const tag of selectedTags) {
            await deleteDoc(doc(db, 'fileTags', tag.id));
          }
          addToast(`${selectedTags.length} tag berhasil dihapus.`, 'success');
          fetchTags();
        } catch (err) {
          console.error(err);
          addToast('Error: Gagal menghapus tag.', 'error');
        } finally {
          setIsProcessing(false);
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const executeBulkAction = async (destinationPath, overwrite = false) => {
    const selectedRelativePaths = tags.filter(t => selectedPaths[t.path]).map(t => t.path);
    const sourcePaths = selectedRelativePaths.map(p => {
      const pClean = p.startsWith('/') ? p : `/${p}`;
      return `${mappedDir}${pClean}`;
    });

    try {
      setIsProcessing(true);
      const token = await user.getIdToken();
      const response = await fetch(`${serverUrl}/api/admin/bulk-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ action: pendingAction, sourcePaths, destinationPath, overwrite })
      });

      if (response.status === 409) {
        const data = await response.json();
        const confText = data.conflicts.slice(0, 3).join(', ');
        const more = data.conflicts.length > 3 ? ` and ${data.conflicts.length - 3} more` : '';
        setConfirmDialog({
          title: 'File Conflict',
          message: `Konflik! File sudah ada di folder tujuan:\n${confText}${more}\n\nLanjutkan dengan overwrite (timpa)?`,
          type: 'warning',
          confirmText: 'Overwrite',
          cancelText: 'Batal',
          onConfirm: () => {
            setConfirmDialog(null);
            executeBulkAction(destinationPath, true);
          },
          onCancel: () => {
            setConfirmDialog(null);
            addToast('Proses dibatalkan.', 'warning');
            setIsProcessing(false);
            setShowFolderPicker(false);
            setPendingAction(null);
          }
        });
        return;
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed');
      }

      const result = await response.json();
      const successCount = result.results.filter(r => r.status === 'success').length;
      const failedItems = result.results.filter(r => r.status === 'failed');

      if (failedItems.length === 0) {
        addToast(`${pendingAction === 'copy' ? 'Copied' : 'Moved'} ${successCount} file(s) successfully!`, 'success');
      } else {
        addToast(`${successCount} OK, ${failedItems.length} failed: ${failedItems.map(f => f.file).join(', ')}`, 'warning', 8000);
      }

      setShowFolderPicker(false);
      setPendingAction(null);
    } catch (err) {
      console.error(err);
      addToast('Error: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="folder-picker-overlay" onClick={onClose}>
        <div className="folder-picker-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
          <div className="folder-picker-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Tag size={20} className="text-accent" />
              <h3 style={{ margin: 0 }}>Tagged Files by {userName}</h3>
            </div>
            <button className="folder-picker-close" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Toolbar */}
          {!loading && tags.length > 0 && (
            <div className="fs-tags-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={toggleAll} className="fs-select-all-btn">
                  {isAllSelected ? <CheckSquare size={16} className="text-accent" /> :
                    isSomeSelected ? <CheckSquare size={16} style={{ opacity: 0.5 }} /> :
                      <Square size={16} />}
                  <span>Select All</span>
                </button>
                <span className="fs-selected-count">{getSelectedCount()} selected</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                <button
                  disabled={getSelectedCount() === 0 || isProcessing}
                  onClick={removeTags}
                  className="admin-btn admin-btn--danger fs-icon-btn"
                  title="Hapus tag terpilih"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  disabled={getSelectedCount() === 0 || isProcessing}
                  onClick={() => startAction('copy')}
                  className="admin-btn admin-btn--secondary fs-icon-btn"
                  title="Copy ke folder…"
                >
                  <Copy size={16} />
                </button>
                <button
                  disabled={getSelectedCount() === 0 || isProcessing}
                  onClick={() => startAction('move')}
                  className="admin-btn admin-btn--primary fs-icon-btn"
                  title="Pindahkan ke folder…"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="folder-picker-list" style={{ padding: '0.75rem', maxHeight: '55vh' }}>
            {loading ? (
              <div className="folder-picker-empty">
                <RefreshCw size={24} className="animate-spin text-accent" />
                <span>Loading…</span>
              </div>
            ) : tags.length === 0 ? (
              <div className="folder-picker-empty">
                <Star size={24} className="text-muted" />
                <span>No files tagged by this client yet.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {tags.map((t, idx) => {
                  const isSelected = !!selectedPaths[t.path];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSelection(t.path)}
                      className={`fs-tag-item ${isSelected ? 'fs-tag-item--selected' : ''}`}
                    >
                      <div className="fs-tag-check">
                        {isSelected ? <CheckSquare size={18} className="text-accent" /> : <Square size={18} />}
                      </div>
                      <div className="fs-tag-info">
                        <div className="fs-tag-name">
                          <Star size={12} className="text-accent" fill="currentColor" />
                          {t.fileName}
                        </div>
                        <div className="fs-tag-meta">
                          {t.path} · {new Date(t.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showFolderPicker && (
        <FolderPickerModal
          title={`${pendingAction === 'copy' ? 'Copy' : 'Move'} ${getSelectedCount()} file(s) to…`}
          serverUrl={serverUrl}
          user={user}
          onSelect={(destPath) => executeBulkAction(destPath)}
          onClose={() => setShowFolderPicker(false)}
          isLoading={isProcessing}
          actionLabel={pendingAction === 'copy' ? 'Copy Here' : 'Move Here'}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          type={confirmDialog.type}
        />
      )}
    </>
  );
}

// ==================== Folder Picker Modal ====================
function FolderPickerModal({ title = 'Choose Folder', actionLabel = 'Select This Folder', isLoading = false, serverUrl, user, onSelect, onClose }) {
  const [currentPath, setCurrentPath] = useState('/');
  const [parentPath, setParentPath] = useState('/');
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const browse = async (dirPath) => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `${serverUrl}/api/browse?path=${encodeURIComponent(dirPath)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': '69420'
          },
          signal: AbortSignal.timeout(5000)
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to browse');
      }
      const data = await res.json();
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setFolders(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverUrl) browse('/');
  }, [serverUrl]);

  return (
    <div className="folder-picker-overlay" onClick={onClose} style={{ zIndex: 2500 }}>
      <div className="folder-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="folder-picker-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FolderOpen size={20} className="text-accent" />
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="folder-picker-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="folder-picker-pathbar">
          <button
            className="folder-picker-up-btn"
            onClick={() => browse(parentPath)}
            disabled={currentPath === parentPath}
            title="Go Up"
          >
            <ArrowUp size={16} />
          </button>
          <div className="folder-picker-pathtext">{currentPath}</div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1.25rem', color: '#ef4444', fontSize: '0.85rem' }}>
            ⚠ {error}
          </div>
        )}

        <div className="folder-picker-list">
          {loading ? (
            <div className="folder-picker-empty">
              <RefreshCw size={24} className="animate-spin text-accent" />
              <span>Loading…</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="folder-picker-empty">
              <Folder size={24} className="text-muted" />
              <span>No subfolders found</span>
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.fullPath}
                className="folder-picker-item"
                onDoubleClick={() => browse(folder.fullPath)}
              >
                <Folder size={18} className="text-accent" />
                <span className="folder-picker-item-name">{folder.name}</span>
                <button
                  className="folder-picker-open-btn"
                  onClick={() => browse(folder.fullPath)}
                  title="Open folder"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="folder-picker-footer">
          <div className="folder-picker-selected">
            <FolderOpen size={16} className="text-accent" />
            <span>{currentPath}</span>
          </div>
          <button
            className="admin-btn admin-btn--primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
            onClick={() => onSelect(currentPath)}
            disabled={isLoading || loading}
          >
            {isLoading ? (
              <><RefreshCw size={16} className="animate-spin" /> Processing…</>
            ) : (
              <><Check size={16} /> {actionLabel}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Main Component ====================
export default function ManageFileServer() {
  const { settings } = useSiteSettings();
  const { user } = useAuth();
  const [serverUrl, setServerUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('unknown');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [users, setUsers] = useState([]);
  const [accessList, setAccessList] = useState({});
  const [pathInputs, setPathInputs] = useState({});
  const [folderPickerFor, setFolderPickerFor] = useState(null);
  const [viewTagsFor, setViewTagsFor] = useState(null);
  const [activeTab, setActiveTab] = useState('manager'); // 'manager' | 'clients'
  const [managerPath, setManagerPath] = useState('/Users/rachsindutama');

  const { addToast, ToastContainer } = useToast();

  const checkStatus = useCallback(async (urlToCheck) => {
    const url = urlToCheck || serverUrl;
    if (!url) return setStatus('unknown');
    setStatus('checking');
    try {
      const res = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'ngrok-skip-browser-warning': '69420'
        }
      });
      if (res.ok) setStatus('online');
      else setStatus('offline');
    } catch { setStatus('offline'); }
  }, [serverUrl]);

  useEffect(() => {
    if (settings) {
      if (settings.localFileServerUrl !== undefined) {
        setServerUrl(settings.localFileServerUrl);
        checkStatus(settings.localFileServerUrl);
      }
      if (settings.fileServerEnabled !== undefined) {
        setIsEnabled(Boolean(settings.fileServerEnabled));
      }
    }
  }, [settings, checkStatus]);

  // Handle ON/OFF Toggle with mandatory pre-flight health check before ON
  const handleToggleServer = async () => {
    if (isToggling) return;

    const targetUrl = (serverUrl || settings?.localFileServerUrl || '').trim();
    const adminDocId = user?.uid || import.meta.env.VITE_DEFAULT_ADMIN_ID;

    if (!isEnabled) {
      // Trying to switch ON -> Server MUST be verified ALIVE/ONLINE first!
      if (!targetUrl) {
        addToast('URL Server belum diatur! Masukkan dan simpan URL server terlebih dahulu.', 'warning');
        return;
      }

      setIsToggling(true);
      setStatus('checking');
      addToast('Memeriksa apakah server lokal sedang MENYALA...', 'info', 3000);

      try {
        const cleanUrl = targetUrl.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/api/health`, {
          signal: AbortSignal.timeout(5000),
          headers: {
            'ngrok-skip-browser-warning': '69420'
          }
        });

        if (!res.ok) {
          throw new Error(`Server tidak merespons (HTTP ${res.status})`);
        }

        const data = await res.json().catch(() => ({}));
        if (data.status !== 'online') {
          throw new Error('Server belum siap atau status tidak online');
        }

        // Server is 100% ONLINE! Allow switching to ON and save to DB
        setStatus('online');
        if (adminDocId) {
          await setDoc(doc(db, 'siteSettings', adminDocId), {
            fileServerEnabled: true
          }, { merge: true });
        }
        setIsEnabled(true);
        addToast('Server terkonfirmasi NYALA! File Server berhasil diaktifkan.', 'success');
      } catch (err) {
        console.error('File Server health check failed:', err);
        setStatus('offline');
        setIsEnabled(false);
        addToast(`Gagal mengaktifkan! Komputer / Server lokal sedang MATI (${err.message}). Pastikan server & tunnel sudah menyala terlebih dahulu!`, 'error', 7000);
      } finally {
        setIsToggling(false);
      }
    } else {
      // Switching OFF
      setIsToggling(true);
      try {
        if (adminDocId) {
          await setDoc(doc(db, 'siteSettings', adminDocId), {
            fileServerEnabled: false
          }, { merge: true });
        }
        setIsEnabled(false);
        addToast('File Server dinonaktifkan. Akses klien dimatikan.', 'info');
      } catch (err) {
        console.error('Failed to disable file server:', err);
        addToast(`Gagal menonaktifkan server: ${err.message}`, 'error');
      } finally {
        setIsToggling(false);
      }
    }
  };

  useEffect(() => {
    if (!serverUrl) return;
    const interval = setInterval(() => {
      checkStatus(serverUrl);
    }, 20000);
    return () => clearInterval(interval);
  }, [serverUrl, checkStatus]);

  useEffect(() => {
    document.title = `File Server — ${settings?.brandName || ''}`;
  }, [settings]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const usersData = [];
      snap.forEach(doc => { usersData.push({ id: doc.id, ...doc.data() }); });
      setUsers(usersData);
    };
    fetchUsers();

    const unsub = onSnapshot(collection(db, 'fileServerAccess'), (snap) => {
      const accessData = {};
      const paths = {};
      snap.forEach(doc => {
        accessData[doc.id] = doc.data();
        paths[doc.id] = doc.data().mappedPath || '';
      });
      setAccessList(accessData);
      setPathInputs(prev => ({ ...paths, ...prev }));
    });

    return () => unsub();
  }, []);

  const handleSaveUrl = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'siteSettings', user.uid), { localFileServerUrl: serverUrl }, { merge: true });
      addToast('Server URL saved successfully!', 'success');
      checkStatus(serverUrl);
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAccess = async (userId, isCurrentlyAllowed) => {
    try {
      const mappedPath = pathInputs[userId] || '';
      if (!isCurrentlyAllowed && !mappedPath) {
        addToast('Choose a mapped folder first before granting access.', 'warning');
        return;
      }
      await setDoc(doc(db, 'fileServerAccess', userId), {
        allowed: !isCurrentlyAllowed,
        mappedPath,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      addToast(isCurrentlyAllowed ? 'Access revoked.' : 'Access granted!', 'success');
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  };

  const savePath = async (userId) => {
    try {
      await setDoc(doc(db, 'fileServerAccess', userId), {
        mappedPath: pathInputs[userId] || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      addToast('Path saved!', 'success');
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  };

  const handleFolderSelected = (selectedPath) => {
    if (folderPickerFor) {
      setPathInputs(prev => ({ ...prev, [folderPickerFor]: selectedPath }));
    }
    setFolderPickerFor(null);
  };

  return (
    <div className="admin-page animate-fade-in">
      <ToastContainer />

      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">File Server</h1>
          <p className="admin-header__subtitle">Manage local file server connection and client access.</p>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr', gap: '0.75rem' }}>

        {/* Compact Server Connection Card */}
        <div className="admin-card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Server size={15} className="text-accent" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Server Connection</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {/* TOGGLE AKTIF / NONAKTIF */}
              <div
                className={`fs-toggle-wrapper ${isEnabled ? 'fs-toggle-wrapper--active' : ''} ${isToggling ? 'fs-toggle-wrapper--checking' : ''}`}
                title={isEnabled ? "File Server Aktif (Klik untuk menonaktifkan)" : "File Server Nonaktif (Klik untuk mengaktifkan)"}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  disabled={isToggling}
                  onClick={handleToggleServer}
                  className={`fs-toggle-switch ${isEnabled ? 'fs-toggle-switch--on' : ''}`}
                >
                  <span className="fs-toggle-handle">
                    {isToggling && <RefreshCw size={8} className="animate-spin text-dark" />}
                  </span>
                </button>
                <span className="fs-toggle-label">
                  {isToggling ? 'Memeriksa…' : (isEnabled ? 'Aktif' : 'Nonaktif')}
                </span>
              </div>

              {/* Status Badge */}
              <span className={`fs-status-badge fs-status-badge--${status}`} style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}>
                {status === 'online' && <Wifi size={11} />}
                {status === 'offline' && <WifiOff size={11} />}
                {status === 'checking' && <RefreshCw size={11} className="animate-spin" />}
                {status === 'unknown' ? 'Unknown' : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>

              {/* Refresh Check Button */}
              <button
                type="button"
                onClick={() => checkStatus()}
                className="afm-icon-btn"
                style={{ width: '26px', height: '26px', borderRadius: '5px' }}
                title="Cek Koneksi"
              >
                <RefreshCw size={11} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveUrl} className="admin-form" style={{ margin: 0 }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://files.pratamavisual.com"
                className="admin-input"
                style={{ flex: 1, height: '32px', fontSize: '0.78rem', padding: '0 0.65rem', minWidth: 0 }}
              />
              <button
                type="submit"
                disabled={isSaving}
                className="admin-btn admin-btn--primary"
                style={{ height: '32px', padding: '0 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'none', borderRadius: '6px' }}
              >
                {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Save</span>
              </button>
            </div>
          </form>

          {/* Status Notices */}
          {!isEnabled && status === 'online' ? (
            <div className="fs-banner fs-banner--info">
              <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>File Server Aktif (Akses Nonaktif):</strong> File server dan tunnel terdeteksi aktif, namun akses klien saat ini sedang dinonaktifkan (Nonaktif). <strong>Aktifkan</strong> untuk membuka akses klien.
              </div>
            </div>
          ) : !isEnabled ? (
            <div className="fs-banner fs-banner--disabled">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>File Server Nonaktif:</strong> Layanan file server sedang dimatikan. Klien tidak dapat melihat atau mengunduh file.
              </div>
            </div>
          ) : status === 'offline' ? (
            <div className="fs-banner fs-banner--warning">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Peringatan Offline:</strong> File Server diset Aktif, tetapi PC lokal / Server tunnel terdeteksi Offline. Pastikan komputer dan tunnel cloudflared tetap menyala agar file dapat diakses oleh klien.
              </div>
            </div>
          ) : null}
        </div>

        {/* Compact Segmented Sub-Tabs */}
        <div className="afm-tabs-segmented">
          <button
            type="button"
            onClick={() => setActiveTab('manager')}
            className={`afm-tab-btn ${activeTab === 'manager' ? 'active' : ''}`}
          >
            <HardDrive size={13} />
            <span>File Explorer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`afm-tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          >
            <Users size={13} />
            <span>Client Access</span>
            <span className="afm-tab-badge">{users.length}</span>
          </button>
        </div>

        {activeTab === 'manager' ? (
          <AdminFileManager
            serverUrl={serverUrl}
            initialPath={managerPath}
            addToast={addToast}
            serverStatus={status}
          />
        ) : (
          /* Client Access Card */
          <div className="admin-card animate-fade-in">
            <div className="admin-card-header">
              <h3>Client Access & Mapping</h3>
            </div>
            <div className="admin-card-content" style={{ padding: 0 }}>
              <div className="fs-client-list">
                {users.map(u => {
                  const accessData = accessList[u.id] || {};
                  const isAllowed = accessData.allowed || false;
                  const currentMapped = pathInputs[u.id] ?? '';
                  return (
                    <div key={u.id} className={`fs-client-row ${isAllowed ? 'fs-client-row--allowed' : ''}`}>
                      {/* Top: user info + status */}
                      <div className="fs-client-top">
                        <div className="fs-client-user">
                          <div className="fs-client-avatar">
                            {(u.displayName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="fs-client-name">{u.displayName || 'No Name'}</div>
                            <div className="fs-client-email">{u.email}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span className={`fs-access-pill ${isAllowed ? 'fs-access-pill--allowed' : ''}`}>
                            {isAllowed ? <Shield size={13} /> : <ShieldOff size={13} />}
                            {isAllowed ? 'Allowed' : 'Denied'}
                          </span>
                          <button
                            onClick={() => toggleAccess(u.id, isAllowed)}
                            className={`admin-btn ${isAllowed ? 'admin-btn--danger' : 'admin-btn--primary'} fs-action-btn-sm`}
                          >
                            {isAllowed ? 'Revoke' : 'Grant'}
                          </button>
                        </div>
                      </div>

                      {/* Bottom: folder mapping + actions */}
                      <div className="fs-client-bottom">
                        <div className="fs-mapped-path" title={currentMapped || 'No folder selected'}>
                          <Folder size={14} className={currentMapped ? 'text-accent' : 'text-muted'} />
                          <span>{currentMapped || 'No folder selected'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap' }}>
                          {currentMapped && (
                            <button
                              type="button"
                              onClick={() => {
                                setManagerPath(currentMapped);
                                setActiveTab('manager');
                              }}
                              className="admin-btn admin-btn--secondary fs-action-btn-sm"
                              title="Buka dan kelola file folder ini"
                            >
                              <Folder size={13} className="text-accent" /> Kelola File
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (status !== 'online') {
                                checkStatus();
                                addToast('Server must be online to browse folders.', 'warning');
                                return;
                              }
                              setFolderPickerFor(u.id);
                            }}
                            className="admin-btn admin-btn--secondary fs-action-btn-sm"
                            title="Browse folders"
                          >
                            <FolderOpen size={13} /> Browse
                          </button>
                          {currentMapped && (
                            <button
                              onClick={() => savePath(u.id)}
                              className="admin-btn admin-btn--secondary fs-action-btn-sm"
                              title="Save Path"
                            >
                              <Save size={13} /> Save
                            </button>
                          )}
                          <button
                            onClick={() => setViewTagsFor({ userId: u.id, userName: u.displayName || 'No Name', mappedDir: currentMapped })}
                            className="admin-btn admin-btn--secondary fs-action-btn-sm"
                            title="View Tagged Files"
                          >
                            <Tag size={13} /> Tags
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Folder Picker Modal */}
      {folderPickerFor && (
        <FolderPickerModal
          serverUrl={serverUrl}
          user={user}
          onSelect={handleFolderSelected}
          onClose={() => setFolderPickerFor(null)}
        />
      )}

      {/* View Tags Modal */}
      {viewTagsFor && (
        <ViewTagsModal
          userId={viewTagsFor.userId}
          userName={viewTagsFor.userName}
          mappedDir={viewTagsFor.mappedDir}
          serverUrl={serverUrl}
          user={user}
          addToast={addToast}
          onClose={() => setViewTagsFor(null)}
        />
      )}
    </div>
  );
}
