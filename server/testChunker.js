const fs = require('fs');
const path = require('path');
const { processDocument } = require('./chunker');

// Create a test text file
const testText = `
# Welcome to OllyMagenti

This is a test document for the chunking pipeline.

## Section 1: What is RAG?

RAG stands for Retrieval-Augmented Generation. It's a technique that combines information retrieval with language generation.

The system first retrieves relevant documents from a knowledge base, then uses those documents as context for generating an answer.

## Section 2: Why Local Matters

Running everything locally means your data never leaves your computer. No cloud API calls. No third-party access.

This is especially important for sensitive documents like contracts, financial records, or personal notes.

## Section 3: Chunking Strategy

Good chunking preserves semantic boundaries. We split by paragraphs first, then by sentences if needed.

Overlapping chunks ensure that information that falls on chunk boundaries isn't lost.

The optimal chunk size is typically 500-1000 characters, which is about 100-200 words.

## Conclusion

This test document should be split into multiple chunks. Each chunk should be coherent and meaningful on its own.
`;

// Create a temporary test file
const testFilePath = path.join(__dirname, 'test_document.txt');
fs.writeFileSync(testFilePath, testText, 'utf-8');

async function test() {
  console.log('========================================');
  console.log('Testing Document Chunking Pipeline');
  console.log('========================================\n');
  
  // Read the test file
  const fileBuffer = fs.readFileSync(testFilePath);
  
  console.log('1. Processing test document...');
  const result = await processDocument(fileBuffer, 'txt', {
    chunkSize: 500,
    overlap: 50
  });
  
  console.log(`   ✓ Original length: ${result.originalLength} characters`);
  console.log(`   ✓ Cleaned length: ${result.cleanedLength} characters`);
  console.log(`   ✓ Chunk count: ${result.chunkCount}\n`);
  
  console.log('2. Preview of cleaned text:');
  console.log(`   "${result.preview}..."\n`);
  
  console.log('3. Chunks created:');
  result.chunks.forEach((chunk, i) => {
    console.log(`\n   --- Chunk ${i + 1} ---`);
    console.log(`   ${chunk.text.substring(0, 150)}...`);
    console.log(`   (Length: ${chunk.text.length} chars, Paragraphs: ${chunk.startParagraph}-${chunk.endParagraph})`);
  });
  
  console.log('\n========================================');
  console.log('✓ Chunking test complete!');
  console.log('========================================');
  
  // Clean up test file
  fs.unlinkSync(testFilePath);
}

test().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});