/**
 * Document Chunking Utility
 * Splits documents into overlapping chunks for vector storage
 * Handles long paragraphs by splitting them into smaller pieces
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Maximum characters per chunk for embedding (well under nomic-embed-text's 8192 token limit)
// Using 2000 characters as a safe limit (approximately 500 tokens)
const MAX_CHUNK_SIZE = 2000;
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;

/**
 * Split a long paragraph into smaller chunks by sentences
 * @param {string} paragraph - Long paragraph to split
 * @param {number} maxSize - Maximum size per chunk
 * @returns {Array} Array of smaller paragraph chunks
 */
function splitLongParagraph(paragraph, maxSize = MAX_CHUNK_SIZE) {
  if (paragraph.length <= maxSize) {
    return [paragraph];
  }
  
  // Split by sentences (period, question mark, exclamation followed by space or newline)
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If a single sentence is longer than maxSize, split it by clauses (commas, semicolons)
    if (sentence.length > maxSize) {
      // Split by commas and semicolons as a fallback
      const clauses = sentence.split(/(?<=[,;])\s+/);
      for (const clause of clauses) {
        if (currentChunk.length + clause.length + 1 <= maxSize) {
          currentChunk += (currentChunk ? ' ' : '') + clause;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = clause;
        }
      }
    } else if (currentChunk.length + sentence.length + 1 <= maxSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Split text into chunks by paragraphs, with long paragraph splitting
 * @param {string} text - The text to chunk
 * @param {number} chunkSize - Target chunk size in characters (default: 800)
 * @param {number} overlap - Overlap between chunks in characters (default: 100)
 * @returns {Array} Array of chunk objects with text and metadata
 */
function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  // Step 1: Split by double newlines to get paragraphs
  let paragraphs = text.split(/\n\s*\n/);
  
  // Step 2: Further split by single newlines for better granularity
  const expandedParagraphs = [];
  for (const para of paragraphs) {
    if (para.includes('\n')) {
      const subParagraphs = para.split('\n');
      for (const sub of subParagraphs) {
        if (sub.trim()) {
          expandedParagraphs.push(sub.trim());
        }
      }
    } else if (para.trim()) {
      expandedParagraphs.push(para.trim());
    }
  }
  
  paragraphs = expandedParagraphs;
  
  // Step 3: Split any paragraphs that are too long
  const safeParagraphs = [];
  for (const para of paragraphs) {
    const splitParas = splitLongParagraph(para, chunkSize);
    safeParagraphs.push(...splitParas);
  }
  
  // Step 4: Build chunks by combining safe paragraphs
  const chunks = [];
  let currentChunk = '';
  let currentIndex = 0;
  
  for (let i = 0; i < safeParagraphs.length; i++) {
    const paragraph = safeParagraphs[i];
    if (!paragraph) continue;
    
    const paragraphWithNewline = currentChunk.length > 0 ? '\n\n' + paragraph : paragraph;
    const newLength = currentChunk.length + paragraphWithNewline.length;
    
    if (newLength > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        startParagraph: currentIndex,
        endParagraph: i - 1
      });
      
      // Apply overlap: keep last N characters from previous chunk
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + paragraph;
        currentIndex = i;
      } else {
        currentChunk = paragraph;
        currentIndex = i;
      }
    } else {
      // Add paragraph to current chunk
      currentChunk += paragraphWithNewline;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunks.length,
      startParagraph: currentIndex,
      endParagraph: safeParagraphs.length - 1
    });
  }
  
  // Final safety check: ensure no single chunk exceeds MAX_CHUNK_SIZE
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.text.length > MAX_CHUNK_SIZE) {
      // Force-split any remaining oversized chunks
      const forcedChunks = splitLongParagraph(chunk.text, MAX_CHUNK_SIZE);
      for (let i = 0; i < forcedChunks.length; i++) {
        finalChunks.push({
          text: forcedChunks[i],
          index: finalChunks.length,
          startParagraph: chunk.startParagraph,
          endParagraph: chunk.endParagraph
        });
      }
    } else {
      finalChunks.push(chunk);
    }
  }
  
  return finalChunks;
}

/**
 * Clean extracted text while preserving structure
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove form feed characters (page breaks)
  cleaned = cleaned.replace(/\f/g, '\n\n');
  
  // Remove page number patterns
  cleaned = cleaned.replace(/Page \d+ of \d+/gi, '');
  cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
  
  // Remove common PDF artifacts
  cleaned = cleaned.replace(/�/g, '');
  
  // Normalize multiple spaces to single space (but preserve newlines)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Remove excessive newlines (more than 2 becomes 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove lines that are likely headers/footers (short, repeated patterns)
  const lines = cleaned.split('\n');
  const lineFrequency = new Map();
  
  // First pass: count line frequency
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 100) {
      lineFrequency.set(trimmed, (lineFrequency.get(trimmed) || 0) + 1);
    }
  }
  
  // Second pass: filter out lines that appear more than 5 times
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length > 5 && trimmed.length < 100) {
      const count = lineFrequency.get(trimmed) || 0;
      return count < 5;
    }
    return true;
  });
  
  cleaned = filteredLines.join('\n');
  
  // Trim whitespace from start and end
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Extract text from PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('[PDF Extract] Error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX buffer
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('[DOCX Extract] Error:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Extract text from TXT buffer
 * @param {Buffer} buffer - TXT file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromTXT(buffer) {
  return buffer.toString('utf-8');
}

/**
 * Process a document: extract text, clean, chunk
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileType - 'pdf', 'docx', or 'txt'
 * @param {Object} options - Chunking options
 * @returns {Promise<Object>} Processed document with chunks
 */
async function processDocument(fileBuffer, fileType, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_OVERLAP;
  
  console.log(`[Chunker] Processing ${fileType} file, ${fileBuffer.length} bytes`);
  
  // Step 1: Extract text based on file type
  let rawText = '';
  
  switch (fileType.toLowerCase()) {
    case 'pdf':
      rawText = await extractFromPDF(fileBuffer);
      break;
    case 'docx':
      rawText = await extractFromDOCX(fileBuffer);
      break;
    case 'txt':
      rawText = await extractFromTXT(fileBuffer);
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
  
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('No text could be extracted from this document. It may be scanned or image-based.');
  }
  
  console.log(`[Chunker] Extracted ${rawText.length} characters of raw text`);
  
  // Step 2: Clean the text (preserves structure)
  const cleanedText = cleanText(rawText);
  
  if (cleanedText.length === 0) {
    throw new Error('Text cleaning produced empty result.');
  }
  
  console.log(`[Chunker] Cleaned to ${cleanedText.length} characters`);
  
  // Step 3: Chunk the text
  const chunks = chunkText(cleanedText, chunkSize, overlap);
  
  if (chunks.length === 0) {
    throw new Error('No chunks could be created from this document.');
  }
  
  console.log(`[Chunker] Created ${chunks.length} chunks`);
  
  // Log chunk sizes for debugging
  const chunkSizes = chunks.map(c => c.text.length);
  console.log(`[Chunker] Chunk sizes: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${Math.round(chunkSizes.reduce((a,b)=>a+b,0)/chunkSizes.length)}`);
  
  return {
    originalLength: rawText.length,
    cleanedLength: cleanedText.length,
    chunkCount: chunks.length,
    chunks: chunks,
    preview: cleanedText.substring(0, 500)
  };
}

module.exports = {
  chunkText,
  cleanText,
  processDocument,
  extractFromPDF,
  extractFromDOCX,
  extractFromTXT,
  MAX_CHUNK_SIZE,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP
};