require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');
const os = require('os');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// Initialize Firebase Admin
const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4567;
const ROOT_DIR = path.resolve(process.env.ROOT_DIR || './SharedFiles');
const DEFAULT_ADMIN_PATH = process.env.ADMIN_DEFAULT_DIR || os.homedir() || '/Users/rachsindutama';

// Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, ngrok-skip-browser-warning, X-Target-Path');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 2000, // accommodate media thumbnails and rapid browsing
  message: 'Too many requests, please try again later.'
});
app.use('/api/', apiLimiter);

// Ensure root directory exists
if (!fs.existsSync(ROOT_DIR)) {
  fs.mkdirSync(ROOT_DIR, { recursive: true });
}

// Multer Storage Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const rawTarget = req.query.targetPath || req.headers['x-target-path'] || DEFAULT_ADMIN_PATH;
      const targetDir = path.resolve(rawTarget);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10GB per file
});

// ================= Authentication Middleware =================
const authenticateToken = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token; // Allow token in query string for image src
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    
    // Check if user is whitelisted
    const accessDoc = await db.collection('fileServerAccess').doc(req.user.uid).get();
    const accessData = accessDoc.data();
    if (!accessDoc.exists || !accessData?.allowed || !accessData?.mappedPath) {
      return res.status(403).json({ error: 'Forbidden: Access denied or path not mapped.' });
    }
    
    req.mappedPath = accessData.mappedPath;
    next();
  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// ================= Path Resolution Helper =================
const resolveUserPath = (mappedPath, requestedPath) => {
  const userRoot = path.resolve(mappedPath);
  if (!fs.existsSync(userRoot)) {
    throw new Error(`Mapped directory does not exist on server: ${mappedPath}`);
  }

  // Prevent path traversal
  const normalizedPath = path.normalize(requestedPath || '/').replace(/^(\.\.[\/\\])+/, '');
  const absolutePath = path.join(userRoot, normalizedPath);

  // Ensure absolutePath is still inside userRoot
  if (!absolutePath.startsWith(userRoot)) {
    throw new Error('Path traversal detected');
  }

  return { absolutePath, userRoot };
};

// ================= Routes =================

// Root route
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'Pratama Visual File Server' });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', time: new Date().toISOString() });
});

// ================= Admin-Only: Browse & CRUD filesystem =================
const authenticateAdmin = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    // Check if user is admin in Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin only' });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Admin stream helper (preview inline or download attachment)
const streamAdminFile = (filePath, res, req, isDownload = false) => {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    return res.status(400).json({ error: 'Cannot stream a directory' });
  }

  const ext = path.extname(filePath).toLowerCase();
  let contentType = 'application/octet-stream';
  if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.mov') contentType = 'video/quicktime';
  else if (ext === '.webm') contentType = 'video/webm';
  else if (ext === '.pdf') contentType = 'application/pdf';

  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Type', contentType);
  const disposition = isDownload ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(path.basename(filePath))}"`);

  const range = req.headers.range;
  if (range && contentType.startsWith('video/')) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    fs.createReadStream(filePath).pipe(res);
  }
};

// Admin List Files & Directories
app.get('/api/admin/files', authenticateAdmin, (req, res) => {
  try {
    const requestedPath = req.query.path || DEFAULT_ADMIN_PATH;
    const absPath = path.resolve(requestedPath);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(absPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden
      try {
        const itemFullPath = path.join(absPath, entry.name);
        const itemStat = fs.statSync(itemFullPath);
        const isDir = entry.isDirectory();
        items.push({
          name: entry.name,
          isDir,
          size: isDir ? 0 : itemStat.size,
          modifiedAt: itemStat.mtime,
          ext: isDir ? '' : path.extname(entry.name).toLowerCase()
        });
      } catch {
        // Skip inaccessible items
      }
    }

    // Sort: directories first, then alphabetical
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      currentPath: absPath,
      parentPath: path.dirname(absPath),
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Upload Files
app.post('/api/admin/upload', authenticateAdmin, upload.array('files'), (req, res) => {
  try {
    const uploaded = (req.files || []).map(f => f.originalname);
    res.json({ success: true, count: uploaded.length, uploaded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Create Directory (mkdir)
app.post('/api/admin/mkdir', authenticateAdmin, (req, res) => {
  try {
    const { targetPath, folderName } = req.body;
    if (!targetPath || !folderName) {
      return res.status(400).json({ error: 'targetPath and folderName are required' });
    }
    const cleanName = path.basename(folderName.trim());
    if (!cleanName || cleanName === '.' || cleanName === '..') {
      return res.status(400).json({ error: 'Invalid folder name' });
    }
    const fullNewPath = path.join(path.resolve(targetPath), cleanName);
    if (fs.existsSync(fullNewPath)) {
      return res.status(409).json({ error: 'Folder already exists' });
    }
    fs.mkdirSync(fullNewPath, { recursive: true });
    res.json({ success: true, path: fullNewPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Rename File or Folder
app.patch('/api/admin/rename', authenticateAdmin, (req, res) => {
  try {
    const { targetPath, oldName, newName } = req.body;
    if (!targetPath || !oldName || !newName) {
      return res.status(400).json({ error: 'targetPath, oldName, and newName are required' });
    }
    const cleanNew = path.basename(newName.trim());
    if (!cleanNew || cleanNew === '.' || cleanNew === '..') {
      return res.status(400).json({ error: 'Invalid new name' });
    }
    const oldPath = path.join(path.resolve(targetPath), oldName);
    const newPath = path.join(path.resolve(targetPath), cleanNew);
    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'Source file/folder not found' });
    }
    if (fs.existsSync(newPath)) {
      return res.status(409).json({ error: 'An item with that name already exists' });
    }
    fs.renameSync(oldPath, newPath);
    res.json({ success: true, oldName, newName: cleanNew });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete File or Folder
app.delete('/api/admin/delete', authenticateAdmin, (req, res) => {
  try {
    const { targetPath, name } = req.body;
    if (!targetPath || !name) {
      return res.status(400).json({ error: 'targetPath and name are required' });
    }
    const fullItemPath = path.join(path.resolve(targetPath), name);
    if (!fs.existsSync(fullItemPath)) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const stat = fs.statSync(fullItemPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullItemPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullItemPath);
    }
    res.json({ success: true, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Preview File
app.get('/api/admin/preview', authenticateAdmin, (req, res) => {
  try {
    const targetPath = req.query.path;
    if (!targetPath) return res.status(400).json({ error: 'path is required' });
    streamAdminFile(path.resolve(targetPath), res, req, false);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Download File
app.get('/api/admin/download', authenticateAdmin, (req, res) => {
  try {
    const targetPath = req.query.path;
    if (!targetPath) return res.status(400).json({ error: 'path is required' });
    streamAdminFile(path.resolve(targetPath), res, req, true);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Browse server filesystem (admin only) — lists only directories
app.get('/api/browse', authenticateAdmin, (req, res) => {
  try {
    const requestedPath = req.query.path || '/';
    const absPath = path.resolve(requestedPath);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(absPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    const items = [];
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden/system dirs
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          fullPath: path.join(absPath, entry.name),
        });
      }
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      currentPath: absPath,
      parentPath: path.dirname(absPath),
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin bulk action (copy/move tagged files)
app.post('/api/admin/bulk-action', authenticateAdmin, async (req, res) => {
  const { action, sourcePaths, destinationPath, overwrite } = req.body; // sourcePaths: array of absolute paths
  
  if (!['copy', 'move'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) return res.status(400).json({ error: 'No source files provided' });
  if (!destinationPath) return res.status(400).json({ error: 'No destination path provided' });
  
  const absDest = path.resolve(destinationPath);
  
  try {
    // Ensure destination exists
    if (!fs.existsSync(absDest)) {
      fs.mkdirSync(absDest, { recursive: true });
    }

    // Check for conflicts if not overwrite
    if (!overwrite) {
      const conflicts = [];
      for (const sp of sourcePaths) {
        const destFile = path.join(absDest, path.basename(sp));
        if (fs.existsSync(destFile)) {
          conflicts.push(path.basename(sp));
        }
      }
      if (conflicts.length > 0) {
        return res.status(409).json({ error: 'Conflict', conflicts });
      }
    }

    const fsPromises = require('fs').promises;
    const results = [];

    for (const sp of sourcePaths) {
      const srcAbs = path.resolve(sp);
      if (!fs.existsSync(srcAbs)) {
        results.push({ file: path.basename(sp), status: 'failed', reason: 'File not found' });
        continue;
      }

      const destFile = path.join(absDest, path.basename(sp));
      try {
        if (action === 'copy') {
          await fsPromises.copyFile(srcAbs, destFile);
        } else if (action === 'move') {
          try {
            await fsPromises.rename(srcAbs, destFile);
          } catch (renameErr) {
            if (renameErr.code === 'EXDEV') {
              // Fallback for cross-device move
              await fsPromises.copyFile(srcAbs, destFile);
              await fsPromises.unlink(srcAbs);
            } else {
              throw renameErr;
            }
          }
        }
        results.push({ file: path.basename(sp), status: 'success' });
      } catch (e) {
        results.push({ file: path.basename(sp), status: 'failed', reason: e.message || e.code || 'Unknown error' });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Files
app.get('/api/files', authenticateToken, (req, res) => {
  try {
    const { absolutePath } = resolveUserPath(req.mappedPath, req.query.path);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.raw', '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.mp4', '.mov', '.avi', '.mkv'];

    const items = fs.readdirSync(absolutePath).map(name => {
      // Skip hidden/system files
      if (name.startsWith('.')) return null;

      const itemPath = path.join(absolutePath, name);
      const itemStats = fs.statSync(itemPath);
      const isDir = itemStats.isDirectory();
      
      if (!isDir) {
        const ext = path.extname(name).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          return null; // Exclude non-media files
        }
      }

      return {
        name,
        isDir,
        size: itemStats.size,
        modifiedAt: itemStats.mtime,
      };
    }).filter(Boolean);

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download File (Stream)
app.get('/api/files/download', authenticateToken, (req, res) => {
  try {
    const { absolutePath } = resolveUserPath(req.mappedPath, req.query.path);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download a directory' });
    }

    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(absolutePath)}"`);

    const readStream = fs.createReadStream(absolutePath);
    readStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview File (Stream inline for img/video tags)
app.get('/api/files/preview', authenticateToken, (req, res) => {
  try {
    const { absolutePath } = resolveUserPath(req.mappedPath, req.query.path);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot preview a directory' });
    }

    // Determine content type
    const ext = path.extname(absolutePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.webm') contentType = 'video/webm';

    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(absolutePath)}"`);

    // Basic range support for video seeking
    const range = req.headers.range;
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(absolutePath, {start, end});
      const head = {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const readStream = fs.createReadStream(absolutePath);
      readStream.pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.listen(PORT, () => {
  console.log(`Local File Server running on port ${PORT}`);
  console.log(`Serving files from: ${ROOT_DIR}`);
});
