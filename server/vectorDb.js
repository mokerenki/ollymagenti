const lancedb = require('vectordb');
const path = require('path');

// Database connection
let db = null;
let table = null;

// Vector dimension for nomic-embed-text (768)
const VECTOR_DIM = 768;

/**
 * Initialize the vector database
 * Creates the vectordb folder and documents table if they don't exist
 */
async function initVectorDB() {
  try {
    const dbPath = path.join(__dirname, '..', 'vectordb');
    db = await lancedb.connect(dbPath);
    
    const tableNames = await db.tableNames();
    
    if (!tableNames.includes('documents')) {
      // Create table with schema
      table = await db.createTable('documents', [
        {
          vector: Array(VECTOR_DIM).fill(0),
          text: '',
          source: '',
          chunkIndex: 0,
          docId: '',
          pageNumber: 0
        }
      ]);
      console.log('[VectorDB] Created new documents table');
    } else {
      table = await db.openTable('documents');
      console.log('[VectorDB] Opened existing documents table');
    }
    
    return true;
  } catch (error) {
    console.error('[VectorDB] Init failed:', error);
    return false;
  }
}

/**
 * Store a single chunk in the vector database
 */
async function storeChunk(vector, text, source, chunkIndex, docId, pageNumber = 0) {
  if (!table) {
    throw new Error('VectorDB not initialized. Call initVectorDB() first.');
  }
  
  // Validate vector dimension
  if (vector.length !== VECTOR_DIM) {
    throw new Error(`Vector dimension mismatch: expected ${VECTOR_DIM}, got ${vector.length}`);
  }
  
  await table.add([
    { vector, text, source, chunkIndex, docId, pageNumber }
  ]);
}

/**
 * Store multiple chunks in batch (faster for large documents)
 */
async function storeChunksBatch(chunks) {
  if (!table) {
    throw new Error('VectorDB not initialized. Call initVectorDB() first.');
  }
  
  if (chunks.length === 0) return;
  
  await table.add(chunks);
  console.log(`[VectorDB] Stored ${chunks.length} chunks in batch`);
}

/**
 * Search for similar chunks using a query vector
 * Returns chunks sorted by relevance (lowest distance first)
 */
async function searchSimilar(queryVector, limit = 5) {
  if (!table) {
    throw new Error('VectorDB not initialized');
  }
  
  const results = await table.search(queryVector)
    .limit(limit)
    .execute();
  
  // results come with a _distance field (lower = more similar)
  return results;
}

/**
 * Delete all chunks belonging to a specific document
 * Returns number of chunks deleted
 */
async function deleteDocumentChunks(docId) {
  if (!table) {
    throw new Error('VectorDB not initialized');
  }
  
  // Get all chunks
  const allChunks = await table.query().execute();
  const chunksToKeep = allChunks.filter(chunk => chunk.docId !== docId);
  const deletedCount = allChunks.length - chunksToKeep.length;
  
  if (deletedCount === 0) {
    console.log(`[VectorDB] No chunks found for docId: ${docId}`);
    return 0;
  }
  
  // Rebuild table without the deleted chunks
  await db.dropTable('documents');
  
  if (chunksToKeep.length === 0) {
    // Create empty table with same schema
    table = await db.createTable('documents', [
      { vector: Array(VECTOR_DIM).fill(0), text: '', source: '', chunkIndex: 0, docId: '', pageNumber: 0 }
    ]);
  } else {
    table = await db.createTable('documents', chunksToKeep);
  }
  
  console.log(`[VectorDB] Deleted ${deletedCount} chunks for docId: ${docId}`);
  return deletedCount;
}

/**
 * Get total number of chunks in the database
 */
async function getTotalChunks() {
  if (!table) return 0;
  const all = await table.query().execute();
  return all.length;
}

/**
 * Get all chunks for a specific document (for debugging)
 */
async function getDocumentChunks(docId) {
  if (!table) return [];
  const all = await table.query().execute();
  return all.filter(chunk => chunk.docId === docId);
}

/**
 * Find orphaned chunks (chunks whose docId doesn't exist in SQLite)
 * This is a cleanup utility
 */
async function findOrphanedChunks(validDocIds) {
  if (!table) return [];
  const all = await table.query().execute();
  return all.filter(chunk => !validDocIds.includes(chunk.docId));
}

module.exports = {
  initVectorDB,
  storeChunk,
  storeChunksBatch,
  searchSimilar,
  deleteDocumentChunks,
  getTotalChunks,
  getDocumentChunks,
  findOrphanedChunks,
  VECTOR_DIM
};