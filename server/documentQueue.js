const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { processDocument } = require('./chunker');
const { generateEmbeddingsBatch } = require('./embedding');
const { storeChunksBatch, deleteDocumentChunks } = require('./vectorDb');
const db = require('./database');

// Queue state
let processingQueue = [];
let isProcessing = false;
let statusListeners = [];

/**
 * Add a document to the processing queue
 * @param {Object} file - File object with buffer, originalname, mimetype
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Processing result
 */
async function queueDocument(file, onProgress) {
  // Validate file object
  if (!file || !file.buffer || !file.originalname) {
    console.error('[Queue] Invalid file object:', file);
    throw new Error('Invalid file object: missing buffer or originalname');
  }
  
  const docId = uuidv4();
  const fileHash = await computeFileHash(file.buffer);
  
  // Check for duplicate
  const existing = db.getDocumentByHash(fileHash);
  if (existing) {
    return {
      status: 'duplicate',
      existingDoc: existing,
      message: 'This document already exists. Use replace to update it.'
    };
  }
  
  // Add to queue
  const job = {
    id: docId,
    file: {
      buffer: file.buffer,
      name: file.originalname,
      type: file.mimetype,
      size: file.buffer.length
    },
    fileHash,
    status: 'queued',
    progress: 0,
    onProgress,
    createdAt: Date.now()
  };
  
  processingQueue.push(job);
  
  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
  
  return {
    status: 'queued',
    docId,
    message: 'Document added to processing queue'
  };
}

/**
 * Process documents in the queue sequentially
 */
async function processQueue() {
  if (isProcessing) return;
  if (processingQueue.length === 0) return;
  
  isProcessing = true;
  
  while (processingQueue.length > 0) {
    const job = processingQueue.shift();
    
    try {
      await processDocumentJob(job);
    } catch (error) {
      console.error(`[Queue] Job ${job.id} failed:`, error);
      if (job.onProgress) {
        job.onProgress({ status: 'error', error: error.message });
      }
    }
  }
  
  isProcessing = false;
}

/**
 * Process a single document job
 */
async function processDocumentJob(job) {
  const { file, fileHash, id: docId, onProgress } = job;
  
  // Validate file object
  if (!file || !file.buffer || !file.name) {
    throw new Error(`Invalid job data: missing file properties. Job: ${JSON.stringify(job)}`);
  }
  
  console.log(`[Queue] Processing: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  
  // Update status: extracting text
  if (onProgress) onProgress({ status: 'extracting', progress: 10, message: 'Reading document...' });
  
  // Determine file type from name
  const extension = file.name.split('.').pop().toLowerCase();
  let fileType = 'txt';
  if (extension === 'pdf') fileType = 'pdf';
  if (extension === 'docx') fileType = 'docx';
  
  console.log(`[Queue] File type detected: ${fileType}`);
  
  // Process document (extract, clean, chunk)
  const processed = await processDocument(file.buffer, fileType, {
    chunkSize: 800,
    overlap: 100
  });
  
  console.log(`[Queue] Created ${processed.chunkCount} chunks from ${file.name}`);
  
  if (onProgress) onProgress({ status: 'chunking', progress: 30, message: `Created ${processed.chunkCount} chunks...` });
  
  // Generate embeddings for each chunk
  if (onProgress) onProgress({ status: 'embedding', progress: 50, message: 'Generating embeddings...' });
  
  const chunkTexts = processed.chunks.map(chunk => chunk.text);
  const embeddings = await generateEmbeddingsBatch(chunkTexts);
  
  console.log(`[Queue] Generated ${embeddings.length} embeddings`);
  
  if (onProgress) onProgress({ status: 'storing', progress: 80, message: 'Storing in knowledge base...' });
  
  // Prepare chunks for vector database
  const vectorChunks = [];
  for (let i = 0; i < processed.chunks.length; i++) {
    vectorChunks.push({
      vector: embeddings[i],
      text: processed.chunks[i].text,
      source: file.name,
      chunkIndex: i,
      docId: docId,
      pageNumber: 0
    });
  }
  
  // Store in vector database
  await storeChunksBatch(vectorChunks);
  
  // Save to SQLite
  db.addDocument(docId, file.name, fileHash, file.size);
  db.updateDocumentChunkCount(docId, processed.chunkCount);
  
  if (onProgress) onProgress({ status: 'complete', progress: 100, message: 'Document indexed successfully!' });
  
  console.log(`[Queue] Document indexed: ${file.name} (${processed.chunkCount} chunks, ${file.size} bytes)`);
}

/**
 * Compute file hash for duplicate detection
 */
async function computeFileHash(buffer) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Replace an existing document with a new version
 */
async function replaceDocument(docId, file, onProgress) {
  // Get existing document
  const existingDoc = db.getDocumentById(docId);
  if (!existingDoc) {
    throw new Error('Document not found');
  }
  
  // Delete old chunks from vector DB
  if (onProgress) onProgress({ status: 'deleting', progress: 10, message: 'Removing old version...' });
  await deleteDocumentChunks(docId);
  
  // Delete from SQLite
  db.deleteDocumentRecord(docId);
  
  // Queue the new version
  return queueDocument(file, onProgress);
}

/**
 * Get queue status
 */
function getQueueStatus() {
  return {
    isProcessing,
    queueLength: processingQueue.length,
    currentJob: isProcessing && processingQueue.length > 0 ? processingQueue[0]?.id : null
  };
}

module.exports = {
  queueDocument,
  replaceDocument,
  getQueueStatus
};