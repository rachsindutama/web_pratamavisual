import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Folder, HardDrive, Download, Eye, Trash2, Edit3,
  FolderPlus, UploadCloud, RefreshCw, ArrowUp, Search,
  X, AlertCircle, FileImage, FileVideo, FileText, ChevronRight, Edit2
} from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const isImage = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
};

const isVideo = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
};

export default function AdminFileManager({ serverUrl, initialPath, addToast, serverStatus }) {
  const { user } = useAuth();
  const defaultDir = '/Users/rachsindutama';
  const [currentPath, setCurrentPath] = useState(initialPath || defaultDir);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(initialPath || defaultDir);
  const [parentPath, setParentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authToken, setAuthToken] = useState('');

  // Drag & drop and upload states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  // Modals
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameItem, setRenameItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteItem, setDeleteItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  const getValidToken = useCallback(async (forceRefresh = false) => {
    if (!user) return '';
    try {
      const freshToken = await user.getIdToken(forceRefresh);
      setAuthToken(freshToken);
      return freshToken;
    } catch (err) {
      console.error('Failed to get user ID token:', err);
      return '';
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getValidToken();
    // Auto-refresh token every 30 mins so preview/download tokens stay fresh
    const interval = setInterval(() => {
      getValidToken(true);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, getValidToken]);

  useEffect(() => {
    if (initialPath) {
      setCurrentPath(initialPath);
      setPathInput(initialPath);
    }
  }, [initialPath]);

  const loadFiles = useCallback(async (targetPath) => {
    if (!serverUrl || serverStatus !== 'online') return;
    setLoading(true);
    try {
      let token = await getValidToken(false);
      const pathToSend = targetPath || defaultDir;
      const url = `${serverUrl}/api/admin/files?path=${encodeURIComponent(pathToSend)}`;
      let res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      // If token expired (HTTP 401), force-refresh token and retry once silently
      if (res.status === 401 && user) {
        token = await getValidToken(true);
        res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true'
          }
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const resolved = data.currentPath || pathToSend;
      setCurrentPath(resolved);
      setPathInput(resolved);
      setParentPath(data.parentPath || '');
      setItems(data.items || []);
      setIsEditingPath(false);
    } catch (err) {
      addToast(`Gagal memuat folder: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [serverUrl, serverStatus, getValidToken, user, addToast, defaultDir]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (serverStatus === 'online' && !hasInitialized.current) {
      hasInitialized.current = true;
      loadFiles(currentPath);
    }
  }, [serverStatus, loadFiles, currentPath]);

  // If initialPath prop changes externally
  const prevInitialPath = useRef(initialPath);
  useEffect(() => {
    if (initialPath && initialPath !== prevInitialPath.current) {
      prevInitialPath.current = initialPath;
      loadFiles(initialPath);
    }
  }, [initialPath, loadFiles]);

  // Upload handler
  const handleUploadFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;
    if (!currentPath) {
      addToast('Pilih folder terlebih dahulu!', 'warning');
      return;
    }

    const token = await getValidToken(false);
    const formData = new FormData();
    for (let i = 0; i < filesList.length; i++) {
      formData.append('files', filesList[i]);
    }

    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${serverUrl}/api/admin/upload?targetPath=${encodeURIComponent(currentPath)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-Target-Path', currentPath);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status === 200) {
        addToast(`Sukses upload ${filesList.length} file!`, 'success');
        loadFiles(currentPath);
      } else {
        let msg = 'Upload gagal';
        try {
          const resp = JSON.parse(xhr.responseText);
          msg = resp.error || msg;
        } catch {
          // ignore parse error
        }
        addToast(msg, 'error');
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      addToast('Koneksi terputus saat upload.', 'error');
    };

    xhr.send(formData);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      let token = await getValidToken(false);
      let res = await fetch(`${serverUrl}/api/admin/mkdir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          targetPath: currentPath,
          folderName: newFolderName.trim()
        })
      });

      if (res.status === 401 && user) {
        token = await getValidToken(true);
        res = await fetch(`${serverUrl}/api/admin/mkdir`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            targetPath: currentPath,
            folderName: newFolderName.trim()
          })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat folder');

      addToast(`Folder "${newFolderName}" dibuat!`, 'success');
      setNewFolderOpen(false);
      setNewFolderName('');
      loadFiles(currentPath);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameItem || !renameValue.trim() || renameValue === renameItem.oldName) {
      setRenameItem(null);
      return;
    }
    try {
      let token = await getValidToken(false);
      let res = await fetch(`${serverUrl}/api/admin/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          targetPath: currentPath,
          oldName: renameItem.oldName,
          newName: renameValue.trim()
        })
      });

      if (res.status === 401 && user) {
        token = await getValidToken(true);
        res = await fetch(`${serverUrl}/api/admin/rename`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            targetPath: currentPath,
            oldName: renameItem.oldName,
            newName: renameValue.trim()
          })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal ganti nama');

      addToast(`Diubah ke "${renameValue.trim()}"`, 'success');
      setRenameItem(null);
      setRenameValue('');
      loadFiles(currentPath);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      let token = await getValidToken(false);
      let res = await fetch(`${serverUrl}/api/admin/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          targetPath: currentPath,
          name: deleteItem.name
        })
      });

      if (res.status === 401 && user) {
        token = await getValidToken(true);
        res = await fetch(`${serverUrl}/api/admin/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            targetPath: currentPath,
            name: deleteItem.name
          })
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');

      addToast(`"${deleteItem.name}" berhasil dihapus`, 'success');
      setDeleteItem(null);
      loadFiles(currentPath);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDownload = async (item) => {
    const itemPath = `${currentPath}/${item.name}`;
    const freshToken = await getValidToken(false);
    const dlUrl = `${serverUrl}/api/admin/download?path=${encodeURIComponent(itemPath)}&token=${encodeURIComponent(freshToken || authToken)}`;
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Build breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="afm-card animate-fade-in">

      {/* Top Bar: Compact Action Toolbar */}
      <div className="afm-topbar">
        <div className="afm-header-info">
          <span className="afm-current-badge">
            <HardDrive size={13} className="text-accent" />
            <strong style={{ color: 'var(--color-text)' }}>{currentPath.split('/').filter(Boolean).pop() || 'Root'}</strong>
            <span className="afm-count-pill">{filteredItems.length} item</span>
          </span>
        </div>

        <div className="afm-actions-group">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) {
                handleUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            className="admin-btn admin-btn--primary afm-cmd-btn"
            disabled={loading || uploadProgress !== null || serverStatus !== 'online'}
            onClick={() => fileInputRef.current?.click()}
            title="Upload File"
          >
            <UploadCloud size={13} />
            <span>Upload</span>
          </button>

          <button
            type="button"
            className="admin-btn admin-btn--secondary afm-cmd-btn"
            disabled={loading || serverStatus !== 'online'}
            onClick={() => {
              setNewFolderName('');
              setNewFolderOpen(true);
            }}
            title="Buat Folder Baru"
          >
            <FolderPlus size={13} />
            <span>Folder Baru</span>
          </button>

          <button
            type="button"
            className="afm-icon-btn afm-refresh-btn"
            onClick={() => loadFiles(currentPath)}
            title="Segarkan Folder"
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <RefreshCw size={12} className="animate-spin text-accent" />
              Mengunggah file...
            </span>
            <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{uploadProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {/* Navigation & Search Bar */}
      <div className="afm-nav-bar">
        {/* Path Bar */}
        <div className="afm-path-wrapper">
          <button
            type="button"
            className="afm-icon-btn afm-nav-btn"
            disabled={!parentPath || parentPath === currentPath}
            onClick={() => loadFiles(parentPath)}
            title="Ke Folder Induk"
          >
            <ArrowUp size={12} />
          </button>

          {isEditingPath ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadFiles(pathInput.trim());
              }}
              style={{ display: 'flex', flex: 1, gap: '0.25rem', minWidth: 0 }}
            >
              <input
                type="text"
                className="admin-input"
                style={{ flex: 1, fontSize: '0.78rem', padding: '0.2rem 0.5rem', height: '28px', minWidth: 0 }}
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="admin-btn admin-btn--secondary" style={{ padding: '0 0.5rem', height: '28px', fontSize: '0.75rem', flexShrink: 0, textTransform: 'none' }}>
                Go
              </button>
              <button
                type="button"
                className="afm-icon-btn afm-nav-btn"
                onClick={() => setIsEditingPath(false)}
              >
                <X size={12} />
              </button>
            </form>
          ) : (
            <>
              <div className="afm-crumbs-list">
                <button
                  type="button"
                  className="afm-crumb-btn"
                  onClick={() => loadFiles('/')}
                  title="Root"
                >
                  /
                </button>
                {pathParts.map((part, idx) => {
                  const pathToPart = '/' + pathParts.slice(0, idx + 1).join('/');
                  const isLast = idx === pathParts.length - 1;
                  return (
                    <span key={pathToPart} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', flexShrink: 0 }}>
                      <ChevronRight size={10} style={{ opacity: 0.4 }} />
                      <button
                        type="button"
                        className={`afm-crumb-btn ${isLast ? 'active' : ''}`}
                        onClick={() => loadFiles(pathToPart)}
                        title={pathToPart}
                      >
                        {part}
                      </button>
                    </span>
                  );
                })}
              </div>

              <button
                type="button"
                className="afm-icon-btn afm-nav-btn"
                onClick={() => {
                  setPathInput(currentPath);
                  setIsEditingPath(true);
                }}
                title="Ketik Path Manual"
              >
                <Edit3 size={11} />
              </button>
            </>
          )}
        </div>

        {/* Search */}
        <div className="afm-search-wrapper">
          <Search size={12} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="admin-input afm-search-input"
            placeholder="Cari file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* File Dropzone & List */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`afm-dropzone ${isDragging ? 'afm-dropzone--active' : ''}`}
        style={{ position: 'relative', minHeight: '260px' }}
      >
        {/* Sleek Top Progress Bar when loading */}
        {loading && (
          <div className="afm-top-loader">
            <div className="afm-top-loader-bar" />
          </div>
        )}

        {isDragging && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10, 10, 10, 0.88)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            color: 'var(--color-accent)',
            pointerEvents: 'none'
          }}>
            <UploadCloud size={36} className="animate-bounce" />
            <h4 style={{ margin: '0.4rem 0 0', fontSize: '0.9rem' }}>Lepaskan file untuk mengunggah</h4>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
              ke: {currentPath}
            </p>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '0.45rem', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={20} className="animate-spin text-accent" />
            <span style={{ fontSize: '0.8rem' }}>Memuat direktori...</span>
          </div>
        ) : filteredItems.length === 0 && !loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '0.4rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.25rem' }}>
            <Folder size={32} style={{ opacity: 0.25 }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              {searchQuery ? `Tidak ada file yang cocok dengan "${searchQuery}"` : 'Folder ini kosong'}
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>
              Tarik file ke sini atau klik Upload di atas
            </p>
          </div>
        ) : (
          <div style={{
            maxHeight: '520px',
            overflowY: 'auto',
            opacity: loading ? 0.55 : 1,
            pointerEvents: loading ? 'none' : 'auto',
            transition: 'opacity 0.15s ease'
          }}>
            {filteredItems.map((item) => {
              const itemPath = `${currentPath}/${item.name}`;
              return (
                <div
                  key={item.name}
                  className="afm-row"
                  onClick={() => {
                    if (item.isDir) loadFiles(itemPath);
                  }}
                >
                  {/* Left: Icon + Title & Subtitle */}
                  <div className="afm-row-left">
                    {item.isDir ? (
                      <Folder size={18} className="text-accent" style={{ flexShrink: 0 }} />
                    ) : isImage(item.name) ? (
                      <FileImage size={18} style={{ color: '#38bdf8', flexShrink: 0 }} />
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
                        <span>{item.isDir ? 'Folder' : formatBytes(item.size)}</span>
                        {item.modifiedAt && (
                          <span className="afm-row-date">• {new Date(item.modifiedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="afm-row-actions" onClick={(e) => e.stopPropagation()}>
                    {!item.isDir && (isImage(item.name) || isVideo(item.name)) && (
                      <button
                        type="button"
                        className="afm-icon-btn"
                        title="Preview"
                        onClick={async () => {
                          await getValidToken(false);
                          setPreviewItem({
                            name: item.name,
                            path: itemPath,
                            isVideo: isVideo(item.name)
                          });
                        }}
                      >
                        <Eye size={12} />
                      </button>
                    )}

                    {!item.isDir && (
                      <button
                        type="button"
                        className="afm-icon-btn"
                        title="Download"
                        onClick={() => handleDownload(item)}
                      >
                        <Download size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="afm-icon-btn"
                      title="Ganti Nama"
                      onClick={() => {
                        setRenameItem({ oldName: item.name });
                        setRenameValue(item.name);
                      }}
                    >
                      <Edit3 size={12} />
                    </button>

                    <button
                      type="button"
                      className="afm-icon-btn afm-icon-btn--danger"
                      title="Hapus"
                      onClick={() => setDeleteItem(item)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {newFolderOpen && (
        <div className="folder-picker-overlay" onClick={() => setNewFolderOpen(false)}>
          <div className="afm-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <FolderPlus size={18} className="text-accent" />
              Folder Baru
            </h3>
            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--color-text-muted)' }}>
                  Nama Folder:
                </label>
                <input
                  type="text"
                  className="admin-input"
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Contoh: Photos-Wedding"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setNewFolderOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={!newFolderName.trim()}>
                  Buat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameItem && (
        <div className="folder-picker-overlay" onClick={() => setRenameItem(null)}>
          <div className="afm-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Edit3 size={18} className="text-accent" />
              Ganti Nama
            </h3>
            <form onSubmit={handleRename}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--color-text-muted)' }}>
                  Nama Baru:
                </label>
                <input
                  type="text"
                  className="admin-input"
                  style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setRenameItem(null)}>
                  Batal
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={!renameValue.trim()}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteItem && (
        <div className="folder-picker-overlay" onClick={() => setDeleteItem(null)}>
          <div className="afm-modal-box" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '1.75rem' }}>
            <AlertCircle size={40} className="text-danger" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>Hapus {deleteItem.isDir ? 'Folder' : 'File'}?</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              Yakin ingin menghapus <strong>"{deleteItem.name}"</strong>?
              {deleteItem.isDir && <><br /><span style={{ color: '#ef4444', fontSize: '0.78rem' }}>Semua isi folder ini akan terhapus!</span></>}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setDeleteItem(null)}>
                Batal
              </button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={handleDelete}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="folder-picker-overlay" onClick={() => setPreviewItem(null)} style={{ zIndex: 1200 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0d0d0d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              maxWidth: '92vw',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontWeight: 500, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewItem.name}</span>
              <button
                type="button"
                className="afm-icon-btn"
                style={{ width: '28px', height: '28px' }}
                onClick={() => setPreviewItem(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', minHeight: '260px', maxHeight: '72vh', overflow: 'auto' }}>
              {previewItem.isVideo ? (
                <video
                  src={`${serverUrl}/api/admin/preview?path=${encodeURIComponent(previewItem.path)}&token=${encodeURIComponent(authToken)}`}
                  controls
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: '6px' }}
                />
              ) : (
                <img
                  src={`${serverUrl}/api/admin/preview?path=${encodeURIComponent(previewItem.path)}&token=${encodeURIComponent(authToken)}`}
                  alt={previewItem.name}
                  style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '6px' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
