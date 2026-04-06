const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });

// Track which model is currently loaded
let currentModel = null;
let isEmbeddingModelLoaded = false;

/**
 * Generate an embedding vector for a text string
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} Vector of 768 numbers
 */
async function generateEmbedding(text) {
  try {
    // Ensure embedding model is loaded
    await ensureEmbeddingModel();
    
    const response = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: text
    });
    
    return response.embedding;
  } catch (error) {
    console.error('[Embedding] Generation failed:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of text strings
 * @returns {Promise<number[][]>} Array of vectors
 */
async function generateEmbeddingsBatch(texts) {
  try {
    await ensureEmbeddingModel();
    
    const embeddings = [];
    for (let i = 0; i < texts.length; i++) {
      const response = await ollama.embeddings({
        model: 'nomic-embed-text',
        prompt: texts[i]
      });
      embeddings.push(response.embedding);
      
      // Log progress every 10 chunks
      if ((i + 1) % 10 === 0) {
        console.log(`[Embedding] Processed ${i + 1}/${texts.length} chunks`);
      }
    }
    
    return embeddings;
  } catch (error) {
    console.error('[Embedding] Batch generation failed:', error);
    throw error;
  }
}

/**
 * Ensure the embedding model is loaded in Ollama
 * This checks if we need to unload the chat model first
 */
async function ensureEmbeddingModel() {
  try {
    // Check if embedding model is already loaded
    const response = await ollama.ps(); // List running models
    
    const runningModels = response.models || [];
    const isRunning = runningModels.some(m => m.name.includes('nomic-embed-text'));
    
    if (!isRunning) {
      console.log('[Embedding] Loading nomic-embed-text model...');
      
      // Make a lightweight call to load the model
      await ollama.embeddings({
        model: 'nomic-embed-text',
        prompt: 'ping'
      });
      
      console.log('[Embedding] Model loaded and ready');
    }
    
    isEmbeddingModelLoaded = true;
    return true;
  } catch (error) {
    console.error('[Embedding] Failed to ensure model:', error);
    throw error;
  }
}

/**
 * Unload the embedding model to free memory for chat
 */
async function unloadEmbeddingModel() {
  try {
    // Ollama automatically manages model unloading
    // We just track state
    isEmbeddingModelLoaded = false;
    console.log('[Embedding] Model marked as unloaded');
    return true;
  } catch (error) {
    console.error('[Embedding] Failed to unload:', error);
    return false;
  }
}

/**
 * Check if embedding model is currently loaded
 */
function isModelLoaded() {
  return isEmbeddingModelLoaded;
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  ensureEmbeddingModel,
  unloadEmbeddingModel,
  isModelLoaded
};