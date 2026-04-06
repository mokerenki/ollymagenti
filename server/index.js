const express = require('express');
const cors = require('cors');
const { Ollama } = require('ollama');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { initVectorDB } = require('./vectorDb');
const multer = require('multer');
const { queueDocument, replaceDocument, getQueueStatus } = require('./documentQueue');
const { getAllDocuments, deleteDocumentRecord, getDocumentById } = require('./database');
const { deleteDocumentChunks } = require('./vectorDb');
const { addWatchedFolder, removeWatchedFolder, getWatchedFolders, loadWatchedFoldersFromDB, stopAllWatchers } = require('./folderWatcher');

const app = express();
const PORT = 3000;

const ollama = new Ollama({ host: 'http://localhost:11434' });

app.use(cors());
app.use(express.json());

// ============================================
// LAYER 1: Health Check
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OllyMagenti server is running' });
});

// ============================================
// LAYER 1: Conversation Endpoints
// ============================================

// Get all conversations
app.get('/api/conversations', (req, res) => {
  try {
    const conversations = db.getAllConversations();
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single conversation with messages
app.get('/api/conversations/:id', (req, res) => {
  try {
    const conversation = db.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new conversation
app.post('/api/conversations', (req, res) => {
  try {
    const { title, model } = req.body;
    const id = uuidv4();
    db.createConversation(id, title || 'New Chat', model);
    res.json({ id, title: title || 'New Chat', model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a conversation
app.delete('/api/conversations/:id', (req, res) => {
  try {
    db.deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint with RAG (Retrieval-Augmented Generation)
app.post('/api/chat', async (req, res) => {
  const { messages, model, conversationId, useRag = true } = req.body;
  
  if (!messages || !model) {
    return res.status(400).json({ error: 'Messages and model are required' });
  }

  // If no conversationId, create a new conversation
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    currentConversationId = uuidv4();
    db.createConversation(currentConversationId, 'New Chat', model);
    generateConversationTitle(currentConversationId, messages[0]?.content || 'Chat', model);
  }

  // Save user message to database
  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage.role === 'user') {
    db.addMessage(uuidv4(), currentConversationId, 'user', lastUserMessage.content);
  }

  // ============================================
  // RAG: Retrieve relevant document chunks
  // ============================================
  
  let ragContext = '';
  let sources = [];
  
  if (useRag) {
    try {
      // Get the last user query
      const userQuery = lastUserMessage.content;
      
      // Generate embedding for the query
      const { generateEmbedding } = require('./embedding');
      const { searchSimilar } = require('./vectorDb');
      
      const queryVector = await generateEmbedding(userQuery);
      
      // Search for relevant chunks
      const searchResults = await searchSimilar(queryVector, 5);
      
      if (searchResults && searchResults.length > 0) {
        // Build context from retrieved chunks
        const uniqueSources = new Set();
        const contextChunks = [];
        
        for (const result of searchResults) {
          if (result.text && result.text.trim().length > 0) {
            contextChunks.push(result.text);
            uniqueSources.add(result.source);
            sources.push({
              source: result.source,
              chunkIndex: result.chunkIndex,
              relevance: result._distance
            });
          }
        }
        
        if (contextChunks.length > 0) {
          ragContext = `\n\nHere is relevant information from the user's documents that may help answer the question:\n\n`;
          contextChunks.forEach((chunk, i) => {
            ragContext += `[Document ${i + 1}]: ${chunk}\n\n`;
          });
          ragContext += `Please use the information above to answer the user's question. If the information doesn't contain the answer, say so honestly. Always cite which document the information came from.\n`;
        }
      }
    } catch (ragError) {
      console.error('RAG retrieval failed:', ragError);
      // Continue without RAG context
    }
  }

  // ============================================
  // Build enhanced prompt with RAG context
  // ============================================
  
  let enhancedMessages = [...messages];
  
  if (ragContext) {
    // Add RAG context to the last user message
    const lastMessage = enhancedMessages[enhancedMessages.length - 1];
    if (lastMessage.role === 'user') {
      lastMessage.content = `${lastMessage.content}\n\n${ragContext}`;
    }
  }

  try {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    const stream = await ollama.chat({
      model: model,
      messages: enhancedMessages,
      stream: true,
    });
    
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk.message.content;
      res.write(chunk.message.content);
    }
    
    // Add sources to the response if any were used
    if (sources.length > 0) {
      const uniqueSources = [...new Set(sources.map(s => s.source))];
      const sourceLine = `\n\n---\n📚 **Sources:** ${uniqueSources.join(', ')}`;
      fullResponse += sourceLine;
      res.write(sourceLine);
    }
    
    // Save assistant response to database
    db.addMessage(uuidv4(), currentConversationId, 'assistant', fullResponse);
    
    res.end();
  } catch (error) {
    console.error('Ollama error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Generate a smart title for a conversation
async function generateConversationTitle(conversationId, firstMessage, model) {
  try {
    const titlePrompt = `Generate a very short title (3-6 words) for a conversation that starts with this message: "${firstMessage.substring(0, 200)}". Respond with ONLY the title, nothing else. No quotes. No explanation.`;
    
    const response = await ollama.chat({
      model: model,
      messages: [{ role: 'user', content: titlePrompt }],
      stream: false,
    });
    
    let title = response.message.content.trim();
    title = title.replace(/^["']|["']$/g, '').substring(0, 50);
    
    if (title && title !== 'New Chat') {
      db.updateConversationTitle(conversationId, title);
    }
  } catch (error) {
    console.error('Title generation failed:', error);
  }
}

// Get available models
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LAYER 2: Document Management Endpoints
// ============================================

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.'));
    }
  }
});

// Upload a document
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log('[Upload] Received file:', req.file.originalname, req.file.size, 'bytes');
    
    const result = await queueDocument(req.file, (progress) => {
      console.log(`[Upload] ${req.file.originalname}: ${progress.message}`);
    });
    
    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all indexed documents
app.get('/api/documents', (req, res) => {
  try {
    const documents = getAllDocuments();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    const doc = getDocumentById(docId);
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Delete from vector DB first
    await deleteDocumentChunks(docId);
    
    // Then delete from SQLite
    deleteDocumentRecord(docId);
    
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Replace a document (upload new version)
app.post('/api/documents/:id/replace', upload.single('file'), async (req, res) => {
  try {
    const docId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const result = await replaceDocument(docId, req.file, (progress) => {
      console.log(`[Replace] ${req.file.name}: ${progress.message}`);
    });
    
    res.json(result);
  } catch (error) {
    console.error('Replace error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue status
app.get('/api/documents/queue/status', (req, res) => {
  res.json(getQueueStatus());
});

// ============================================
// Initialize Vector DB on startup
// ============================================

initVectorDB().then(() => {
  console.log('[Server] VectorDB initialized');
  
  // Load watched folders from database (Layer 3)
  loadWatchedFoldersFromDB().catch(err => {
    console.error('[Server] Failed to load watched folders:', err);
  });
  
}).catch(err => {
  console.error('[Server] VectorDB init failed:', err);
});

// ============================================
// LAYER 2: RAG Search Endpoint
// ============================================

const { generateEmbedding } = require('./embedding');
const { searchSimilar } = require('./vectorDb');

// Search documents for relevant chunks
app.post('/api/search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Generate embedding for the query
    const queryVector = await generateEmbedding(query);
    
    // Search vector database
    const results = await searchSimilar(queryVector, limit);
    
    // Format results with source info
    const formattedResults = results.map(result => ({
      text: result.text,
      source: result.source,
      chunkIndex: result.chunkIndex,
      docId: result.docId,
      relevance: result._distance
    }));
    
    res.json({ results: formattedResults });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Start Server
// ============================================
// ===========================================
// LAYER 3: Folder Watcher Endpoints
// ============================================

// Get all watched folders
app.get('/api/watched-folders', (req, res) => {
  try {
    const folders = getWatchedFolders();
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a watched folder
app.post('/api/watched-folders', async (req, res) => {
  try {
    const { path, recursive = true } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Folder path is required' });
    }
    
    await addWatchedFolder(path, recursive);
    res.json({ success: true, message: `Now watching: ${path}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a watched folder
app.delete('/api/watched-folders', async (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Folder path is required' });
    }
    
    removeWatchedFolder(path);
    res.json({ success: true, message: `Stopped watching: ${path}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ============================================
// LAYER 3: URL Indexing Endpoints
// ============================================

const { indexUrl, indexUrlsBatch } = require('./urlIndexer');

// Index a single URL
app.post('/api/index-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const result = await indexUrl(url, (progress) => {
      console.log(`[URL] ${url}: ${progress.message}`);
    });
    
    res.json(result);
  } catch (error) {
    console.error('URL indexing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index multiple URLs (batch)
app.post('/api/index-urls-batch', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Array of URLs is required' });
    }
    
    // Process in background, send immediate response
    const results = await indexUrlsBatch(urls, (progress) => {
      console.log(`[URL Batch] ${progress.current}/${progress.total}: ${progress.url} - ${progress.status}`);
    });
    
    res.json({ results });
  } catch (error) {
    console.error('Batch URL indexing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LAYER 3: Backup & Restore Endpoints
// ============================================

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');

// Create backup of all data
app.get('/api/backup', async (req, res) => {
  try {
    const backupId = `ollymagenti-backup-${Date.now()}.zip`;
    const backupPath = path.join(__dirname, '..', 'temp', backupId);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    // Create zip file
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`[Backup] Created ${backupId} (${archive.pointer()} bytes)`);
      res.download(backupPath, backupId, (err) => {
        if (err) console.error('[Backup] Download error:', err);
        // Clean up temp file after download
        fs.unlinkSync(backupPath);
      });
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    
    // Add database
    const dbPath = path.join(__dirname, 'ollymagenti.db');
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'ollymagenti.db' });
    }
    
    // Add vector database
    const vectorPath = path.join(__dirname, '..', 'vectordb');
    if (fs.existsSync(vectorPath)) {
      archive.directory(vectorPath, 'vectordb');
    }
    
    // Add settings (watched folders are already in SQLite)
    
    await archive.finalize();
    
  } catch (error) {
    console.error('[Backup] Failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore from backup
app.post('/api/restore', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    
    const tempDir = path.join(__dirname, '..', 'temp', `restore-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Extract zip
    const extractPath = tempDir;
    await new Promise((resolve, reject) => {
      const extractor = unzipper.Extract({ path: extractPath });
      extractor.on('close', resolve);
      extractor.on('error', reject);
      
      const readable = require('stream').Readable.from(req.file.buffer);
      readable.pipe(extractor);
    });
    
    // Validate extracted files
    const dbBackup = path.join(extractPath, 'ollymagenti.db');
    const vectorBackup = path.join(extractPath, 'vectordb');
    
    if (!fs.existsSync(dbBackup)) {
      throw new Error('Invalid backup: missing database file');
    }
    
    // Stop current watchers
    if (typeof stopAllWatchers === 'function') {
      stopAllWatchers();
    }
    
    // Backup current data before restore (just in case)
    const preRestoreBackup = path.join(tempDir, 'pre-restore-backup');
    fs.mkdirSync(preRestoreBackup);
    const currentDb = path.join(__dirname, 'ollymagenti.db');
    const currentVector = path.join(__dirname, '..', 'vectordb');
    
    if (fs.existsSync(currentDb)) {
      fs.copyFileSync(currentDb, path.join(preRestoreBackup, 'ollymagenti.db.pre'));
    }
    if (fs.existsSync(currentVector)) {
      // Copy vector directory
      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyRecursive(currentVector, path.join(preRestoreBackup, 'vectordb.pre'));
    }
    
    // Restore database
    fs.copyFileSync(dbBackup, currentDb);
    
    // Restore vector database
    if (fs.existsSync(vectorBackup)) {
      // Remove current vector DB
      if (fs.existsSync(currentVector)) {
        fs.rmSync(currentVector, { recursive: true, force: true });
      }
      
      // Copy backup vector DB
      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyRecursive(vectorBackup, currentVector);
    }
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('[Restore] Backup restored successfully');
    res.json({ success: true, message: 'Backup restored. Please restart the application.' });
    
  } catch (error) {
    console.error('[Restore] Failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`OllyMagenti server running at http://localhost:${PORT}`);
});
// Graceful shutdown (Layer 3)
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  if (typeof stopAllWatchers === 'function') {
    stopAllWatchers();
  }
  process.exit(0);
});