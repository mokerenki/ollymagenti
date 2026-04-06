/**
 * Folder Watcher Module
 * Monitors designated folders and automatically indexes new documents
 */

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const { queueDocument } = require('./documentQueue');
const db = require('./database');

// Active watchers
const activeWatchers = new Map();

// Default ignore patterns (files to skip)
const DEFAULT_IGNORE_PATTERNS = [
  /^~/,           // Temporary files starting with ~
  /\.tmp$/i,      // .tmp files
  /\.part$/i,     // .part files (incomplete downloads)
  /\.crdownload$/i, // Chrome incomplete downloads
  /\.bak$/i,      // Backup files
  /\.swp$/i,      // Vim swap files
  /^\..*/,        // Hidden files (Unix)
  /~$/,           // Files ending with ~ (backup copies)
];

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

// Debounce timers for files (prevents processing during write)
const debounceTimers = new Map();
const DEBOUNCE_MS = 2000; // Wait 2 seconds after last change

/**
 * Check if a file should be processed
 * @param {string} filePath - Full path to the file
 * @returns {boolean} True if file should be processed
 */
function shouldProcessFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  // Check extension
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Check ignore patterns
  for (const pattern of DEFAULT_IGNORE_PATTERNS) {
    if (pattern.test(fileName)) {
      console.log(`[Watcher] Ignored: ${fileName} (matched pattern ${pattern})`);
      return false;
    }
  }
  
  // Check file size (don't process empty or tiny files)
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 100) { // Less than 100 bytes
      console.log(`[Watcher] Ignored: ${fileName} (file too small: ${stats.size} bytes)`);
      return false;
    }
  } catch (error) {
    console.log(`[Watcher] Cannot stat file: ${fileName}`);
    return false;
  }
  
  return true;
}

/**
 * Process a new file (with debouncing)
 * @param {string} filePath - Path to the file
 * @param {string} watchPath - The watched folder path
 */
function handleNewFile(filePath, watchPath) {
  // Clear existing timer for this file
  if (debounceTimers.has(filePath)) {
    clearTimeout(debounceTimers.get(filePath));
  }
  
  // Set new timer
  const timer = setTimeout(async () => {
    debounceTimers.delete(filePath);
    
    if (!shouldProcessFile(filePath)) {
      return;
    }
    
    console.log(`[Watcher] New file detected: ${path.basename(filePath)}`);
    
    try {
      // Read file buffer
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      
      // Determine mimetype
      let mimetype = 'text/plain';
      if (fileExt === '.pdf') mimetype = 'application/pdf';
      if (fileExt === '.docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      // Create file object for queue
      const fileObj = {
        buffer: fileBuffer,
        originalname: fileName,
        mimetype: mimetype,
        size: fileBuffer.length
      };
      
      // Queue for processing
      const result = await queueDocument(fileObj, (progress) => {
        console.log(`[Watcher] ${fileName}: ${progress.message}`);
      });
      
      if (result.status === 'queued') {
        console.log(`[Watcher] ${fileName} queued for indexing (ID: ${result.docId})`);
      } else if (result.status === 'duplicate') {
        console.log(`[Watcher] ${fileName} already exists in knowledge base`);
      }
      
    } catch (error) {
      console.error(`[Watcher] Failed to process ${filePath}:`, error.message);
    }
  }, DEBOUNCE_MS);
  
  debounceTimers.set(filePath, timer);
}

/**
 * Add a folder to watch
 * @param {string} folderPath - Absolute path to the folder
 * @param {boolean} recursive - Watch subfolders (default: true)
 * @returns {Promise<boolean>} Success status
 */
async function addWatchedFolder(folderPath, recursive = true) {
  // Validate folder exists
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Folder does not exist: ${folderPath}`);
  }
  
  // Check if already watching
  if (activeWatchers.has(folderPath)) {
    console.log(`[Watcher] Already watching: ${folderPath}`);
    return false;
  }
  
  // Create watcher
  const watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't process existing files on start
    depth: recursive ? undefined : 0,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  
  // Set up event handlers
  watcher.on('add', (filePath) => {
    console.log(`[Watcher] File added: ${path.basename(filePath)}`);
    handleNewFile(filePath, folderPath);
  });
  
  watcher.on('error', (error) => {
    console.error(`[Watcher] Error in ${folderPath}:`, error);
  });
  
  // Store watcher
  activeWatchers.set(folderPath, { watcher, recursive });
  
  // Save to SQLite
  saveWatchedFolderToDB(folderPath, recursive);
  
  console.log(`[Watcher] Now watching: ${folderPath} (recursive: ${recursive})`);
  return true;
}

/**
 * Remove a watched folder
 * @param {string} folderPath - Absolute path to the folder
 * @returns {boolean} Success status
 */
function removeWatchedFolder(folderPath) {
  const watched = activeWatchers.get(folderPath);
  if (!watched) {
    console.log(`[Watcher] Not watching: ${folderPath}`);
    return false;
  }
  
  // Close the watcher
  watched.watcher.close();
  activeWatchers.delete(folderPath);
  
  // Remove from SQLite
  removeWatchedFolderFromDB(folderPath);
  
  console.log(`[Watcher] Stopped watching: ${folderPath}`);
  return true;
}

/**
 * Get all currently watched folders
 * @returns {Array} List of watched folders
 */
function getWatchedFolders() {
  const folders = [];
  for (const [path, data] of activeWatchers) {
    folders.push({
      path: path,
      recursive: data.recursive,
      active: true
    });
  }
  return folders;
}

/**
 * Save watched folder to SQLite
 */
function saveWatchedFolderToDB(folderPath, recursive) {
  const stmt = db.db.prepare(`
    INSERT OR REPLACE INTO watched_folders (path, recursive, added_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(folderPath, recursive ? 1 : 0);
}

/**
 * Remove watched folder from SQLite
 */
function removeWatchedFolderFromDB(folderPath) {
  const stmt = db.db.prepare('DELETE FROM watched_folders WHERE path = ?');
  stmt.run(folderPath);
}

/**
 * Load saved watched folders from SQLite and start watching
 */
async function loadWatchedFoldersFromDB() {
  // Create table if it doesn't exist
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS watched_folders (
      path TEXT PRIMARY KEY,
      recursive INTEGER DEFAULT 1,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const stmt = db.db.prepare('SELECT * FROM watched_folders');
  const folders = stmt.all();
  
  for (const folder of folders) {
    try {
      await addWatchedFolder(folder.path, folder.recursive === 1);
    } catch (error) {
      console.error(`[Watcher] Failed to restore watch on ${folder.path}:`, error.message);
    }
  }
  
  console.log(`[Watcher] Restored ${folders.length} watched folders from database`);
}

/**
 * Stop all watchers (on app shutdown)
 */
function stopAllWatchers() {
  for (const [path, data] of activeWatchers) {
    data.watcher.close();
    console.log(`[Watcher] Stopped: ${path}`);
  }
  activeWatchers.clear();
  
  // Clear all debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}

module.exports = {
  addWatchedFolder,
  removeWatchedFolder,
  getWatchedFolders,
  loadWatchedFoldersFromDB,
  stopAllWatchers
};