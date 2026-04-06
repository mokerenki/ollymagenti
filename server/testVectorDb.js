const { initVectorDB, storeChunk, searchSimilar, getTotalChunks, VECTOR_DIM } = require('./vectorDb');

// Generate a mock embedding (random numbers) for testing
function mockEmbedding(text) {
  // In production, this comes from Ollama's embedding model
  // For testing DB connectivity, we use random vectors
  const vector = Array(VECTOR_DIM);
  for (let i = 0; i < VECTOR_DIM; i++) {
    vector[i] = Math.random() - 0.5;
  }
  return vector;
}

async function test() {
  console.log('========================================');
  console.log('Testing VectorDB with LanceDB');
  console.log('========================================\n');
  
  // Initialize
  console.log('1. Initializing VectorDB...');
  await initVectorDB();
  console.log('   ✓ VectorDB initialized\n');
  
  // Store test chunks
  console.log('2. Storing test chunks...');
  await storeChunk(
    mockEmbedding('The sky is blue during the day'),
    'The sky is blue during the day',
    'test1.pdf',
    0,
    'doc_test_1',
    1
  );
  
  await storeChunk(
    mockEmbedding('Grass appears green in spring'),
    'Grass appears green in spring',
    'test1.pdf',
    1,
    'doc_test_1',
    1
  );
  
  await storeChunk(
    mockEmbedding('Fire emits heat and light'),
    'Fire emits heat and light',
    'test2.pdf',
    0,
    'doc_test_2',
    2
  );
  
  const totalChunks = await getTotalChunks();
  console.log(`   ✓ Stored 3 chunks. Total chunks in DB: ${totalChunks}\n`);
  
  // Search for similar
  console.log('3. Searching for "color of grass"...');
  const results = await searchSimilar(mockEmbedding('color of grass'), 2);
  console.log('   Top 2 results:');
  results.forEach((r, i) => {
    console.log(`   ${i + 1}. "${r.text.substring(0, 50)}..." (distance: ${r._distance.toFixed(4)})`);
  });
  console.log();
  
  // Test complete
  console.log('========================================');
  console.log('✓ VectorDB test complete!');
  console.log('  LanceDB is working correctly.');
  console.log('========================================');
}

test().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});