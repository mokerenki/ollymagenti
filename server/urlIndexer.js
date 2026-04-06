/**
 * URL Indexing Module
 * Fetches web pages, extracts readable content, and indexes them
 */

const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { v4: uuidv4 } = require('uuid');
const { processDocument } = require('./chunker');
const { generateEmbeddingsBatch } = require('./embedding');
const { storeChunksBatch } = require('./vectorDb');
const db = require('./database');

/**
 * Fetch and extract readable content from a URL
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} Extracted content with title and text
 */
async function fetchAndExtract(url) {
  console.log(`[URLIndexer] Fetching: ${url}`);
  
  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
  
  // Fetch the page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 30000 // 30 second timeout
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Parse HTML and extract readable content
  const dom = new JSDOM(html);
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  
  if (!article || !article.textContent || article.textContent.trim().length < 100) {
    throw new Error('Could not extract readable content. The page may be paywalled, dynamic, or contain very little text.');
  }
  
  console.log(`[URLIndexer] Extracted: "${article.title}" (${article.textContent.length} chars)`);
  
  return {
    title: article.title || url,
    content: article.textContent,
    url: url,
    length: article.textContent.length
  };
}

/**
 * Index a URL into the knowledge base
 * @param {string} url - The URL to index
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Result with docId and status
 */
async function indexUrl(url, onProgress) {
  const docId = uuidv4();
  
  // Generate a hash from the URL for duplicate detection
  const crypto = require('crypto');
  const urlHash = crypto.createHash('sha256').update(url).digest('hex');
  
  // Check for duplicate
  const existing = db.getDocumentByHash(urlHash);
  if (existing) {
    return {
      status: 'duplicate',
      existingDoc: existing,
      message: 'This URL has already been indexed.'
    };
  }
  
  try {
    // Step 1: Fetch and extract
    if (onProgress) onProgress({ status: 'fetching', progress: 10, message: `Fetching ${url}...` });
    
    const article = await fetchAndExtract(url);
    
    // Step 2: Create a virtual file buffer from the extracted text
    if (onProgress) onProgress({ status: 'extracting', progress: 30, message: `Extracted: "${article.title}"` });
    
    const textBuffer = Buffer.from(article.content, 'utf-8');
    
    // Step 3: Process through chunking pipeline (reuse existing logic)
    if (onProgress) onProgress({ status: 'chunking', progress: 50, message: 'Chunking content...' });
    
    const processed = await processDocument(textBuffer, 'txt', {
      chunkSize: 800,
      overlap: 100
    });
    
    console.log(`[URLIndexer] Created ${processed.chunkCount} chunks from ${url}`);
    
    // Step 4: Generate embeddings
    if (onProgress) onProgress({ status: 'embedding', progress: 70, message: 'Generating embeddings...' });
    
    const chunkTexts = processed.chunks.map(chunk => chunk.text);
    const embeddings = await generateEmbeddingsBatch(chunkTexts);
    
    // Step 5: Store in vector database
    if (onProgress) onProgress({ status: 'storing', progress: 85, message: 'Storing in knowledge base...' });
    
    const vectorChunks = [];
    for (let i = 0; i < processed.chunks.length; i++) {
      vectorChunks.push({
        vector: embeddings[i],
        text: processed.chunks[i].text,
        source: article.title,
        chunkIndex: i,
        docId: docId,
        pageNumber: 0,
        url: url  // Store URL as metadata
      });
    }
    
    await storeChunksBatch(vectorChunks);
    
    // Step 6: Save to SQLite (as a document)
    const fileName = `[WEB] ${article.title.substring(0, 50)}`;
    db.addDocument(docId, fileName, urlHash, article.content.length);
    db.updateDocumentChunkCount(docId, processed.chunkCount);
    
    if (onProgress) onProgress({ status: 'complete', progress: 100, message: 'URL indexed successfully!' });
    
    console.log(`[URLIndexer] Indexed: ${url} (${processed.chunkCount} chunks)`);
    
    return {
      status: 'success',
      docId: docId,
      title: article.title,
      chunkCount: processed.chunkCount,
      message: 'URL indexed successfully'
    };
    
  } catch (error) {
    console.error(`[URLIndexer] Failed to index ${url}:`, error);
    throw error;
  }
}

/**
 * Index multiple URLs in batch
 * @param {string[]} urls - Array of URLs
 * @param {Function} onProgress - Progress callback per URL
 * @returns {Promise<Array>} Results for each URL
 */
async function indexUrlsBatch(urls, onProgress) {
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: urls.length,
        url: url,
        status: 'processing'
      });
    }
    
    try {
      const result = await indexUrl(url, (progress) => {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: urls.length,
            url: url,
            ...progress
          });
        }
      });
      results.push({ url, success: true, ...result });
    } catch (error) {
      results.push({ url, success: false, error: error.message });
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: urls.length,
          url: url,
          status: 'error',
          error: error.message
        });
      }
    }
  }
  
  return results;
}

module.exports = {
  fetchAndExtract,
  indexUrl,
  indexUrlsBatch
};