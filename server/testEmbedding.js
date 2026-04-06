const { generateEmbedding, ensureEmbeddingModel } = require('./embedding');

async function test() {
  console.log('========================================');
  console.log('Testing Embedding Model');
  console.log('========================================\n');
  
  console.log('1. Loading embedding model...');
  await ensureEmbeddingModel();
  console.log('   ✓ Model loaded\n');
  
  console.log('2. Generating embedding for test text...');
  const testText = 'This is a test document about artificial intelligence.';
  const embedding = await generateEmbedding(testText);
  console.log(`   ✓ Generated embedding with ${embedding.length} dimensions\n`);
  
  console.log('3. First 10 values of embedding:');
  console.log(`   [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]\n`);
  
  console.log('========================================');
  console.log('✓ Embedding model test complete!');
  console.log('========================================');
}

test().catch(error => {
  console.error('Test failed:', error);
  console.error('Make sure Ollama is running and nomic-embed-text is installed:');
  console.error('  ollama pull nomic-embed-text');
  process.exit(1);
});