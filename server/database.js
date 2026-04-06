const Database = require('better-sqlite3');
const path = require('path');

// Create database file in the server folder
const db = new Database(path.join(__dirname, 'ollymagenti.db'));

// ============================================
// LAYER 1: Conversation and Message Tables
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    role TEXT CHECK(role IN ('user', 'assistant')),
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
`);

// ============================================
// LAYER 2: Document Management Tables
// ============================================

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_hash TEXT UNIQUE NOT NULL,
    file_size INTEGER,
    chunk_count INTEGER DEFAULT 0,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);
  CREATE INDEX IF NOT EXISTS idx_documents_indexed ON documents(indexed_at DESC);
`);
// Watched folders table (Layer 3)
db.exec(`
  CREATE TABLE IF NOT EXISTS watched_folders (
    path TEXT PRIMARY KEY,
    recursive INTEGER DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================
// LAYER 1: Conversation Helper Functions
// ============================================

function getAllConversations() {
  const stmt = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC');
  return stmt.all();
}

function getConversation(conversationId) {
  const convStmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  const conversation = convStmt.get(conversationId);
  
  if (!conversation) return null;
  
  const messagesStmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
  const messages = messagesStmt.all(conversationId);
  
  return { ...conversation, messages };
}

function createConversation(id, title, model) {
  const stmt = db.prepare('INSERT INTO conversations (id, title, model) VALUES (?, ?, ?)');
  stmt.run(id, title, model);
}

function updateConversationTitle(id, title) {
  const stmt = db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(title, id);
}

function updateConversationTimestamp(id) {
  const stmt = db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(id);
}

function addMessage(id, conversationId, role, content) {
  const stmt = db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)');
  stmt.run(id, conversationId, role, content);
  updateConversationTimestamp(conversationId);
}

function deleteConversation(id) {
  const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
  stmt.run(id);
}

// ============================================
// LAYER 2: Document Helper Functions
// ============================================

function addDocument(id, name, fileHash, fileSize) {
  const stmt = db.prepare('INSERT INTO documents (id, name, file_hash, file_size, chunk_count) VALUES (?, ?, ?, ?, 0)');
  stmt.run(id, name, fileHash, fileSize);
}

function getDocumentByHash(fileHash) {
  const stmt = db.prepare('SELECT * FROM documents WHERE file_hash = ?');
  return stmt.get(fileHash);
}

function getDocumentById(id) {
  const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
  return stmt.get(id);
}

function deleteDocumentRecord(id) {
  const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
  stmt.run(id);
}

function getAllDocuments() {
  const stmt = db.prepare('SELECT * FROM documents ORDER BY indexed_at DESC');
  return stmt.all();
}

function updateDocumentChunkCount(id, chunkCount) {
  const stmt = db.prepare('UPDATE documents SET chunk_count = ? WHERE id = ?');
  stmt.run(chunkCount, id);
}

function documentExistsByHash(fileHash) {
  const stmt = db.prepare('SELECT 1 FROM documents WHERE file_hash = ? LIMIT 1');
  return !!stmt.get(fileHash);
}

function getDocumentCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM documents');
  return stmt.get().count;
}

function getTotalChunkCount() {
  const stmt = db.prepare('SELECT SUM(chunk_count) as total FROM documents');
  return stmt.get().total || 0;
}

function deleteAllDocuments() {
  const stmt = db.prepare('DELETE FROM documents');
  stmt.run();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Database instance (for advanced operations)
  db,
  
  // Layer 1: Conversation functions
  getAllConversations,
  getConversation,
  createConversation,
  updateConversationTitle,
  updateConversationTimestamp,
  addMessage,
  deleteConversation,
  
  // Layer 2: Document functions
  addDocument,
  getDocumentByHash,
  getDocumentById,
  deleteDocumentRecord,
  getAllDocuments,
  updateDocumentChunkCount,
  documentExistsByHash,
  getDocumentCount,
  getTotalChunkCount,
  deleteAllDocuments
};