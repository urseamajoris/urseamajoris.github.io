const axios = require('axios');
const pdf = require('pdf-parse');
const fs = require('fs').promises;
const { query, withTransaction } = require('../models/database');
const { generateEmbeddings } = require('./embeddingService');

// Text cleaning and chunking utilities
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[^\w\s\-\.,'";:!?()]/g, '') // Remove special characters but keep punctuation
    .trim();
};

const splitIntoChunks = (text, maxTokens = 500) => {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = [];
  let currentTokenCount = 0;

  for (const word of words) {
    // Rough token estimation: ~0.75 tokens per word
    const wordTokens = Math.ceil(word.length * 0.75);
    
    if (currentTokenCount + wordTokens > maxTokens && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join(' '),
        tokenCount: currentTokenCount
      });
      currentChunk = [word];
      currentTokenCount = wordTokens;
    } else {
      currentChunk.push(word);
      currentTokenCount += wordTokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join(' '),
      tokenCount: currentTokenCount
    });
  }

  return chunks;
};

// Download PDF from URL
const downloadPDF = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('PDF download error:', error.message);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};

// Extract text from PDF buffer
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    const data = await pdf(pdfBuffer);
    
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
      metadata: data.metadata
    };
  } catch (error) {
    console.error('PDF extraction error:', error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

// Main upload processing function
const processUpload = async (sourceId, filePath, userId, fileBuffer = null) => {
  try {
    console.log(`📄 Starting processing for source: ${sourceId}`);

    // Step 1: Download or use provided PDF buffer
    let pdfBuffer;
    if (fileBuffer) {
      pdfBuffer = fileBuffer;
    } else if (filePath.startsWith('http')) {
      // Download from URL
      pdfBuffer = await downloadPDF(filePath);
    } else {
      // Read from local file
      pdfBuffer = await fs.readFile(filePath);
    }

    // Step 2: Extract text from PDF
    const extractionResult = await extractTextFromPDF(pdfBuffer);
    
    if (!extractionResult.text || extractionResult.text.trim().length === 0) {
      throw new Error('No text content found in PDF');
    }

    console.log(`📝 Extracted ${extractionResult.text.length} characters from ${extractionResult.numPages} pages`);

    // Step 3: Clean and chunk the text
    const cleanedText = cleanText(extractionResult.text);
    const chunks = splitIntoChunks(cleanedText, 500);
    
    console.log(`🔪 Split into ${chunks.length} chunks`);

    // Step 4: Generate embeddings for all chunks
    const embeddingResults = await generateEmbeddings(chunks.map(chunk => chunk.text));
    
    if (embeddingResults.length !== chunks.length) {
      throw new Error('Mismatch between chunks and embeddings');
    }

    // Step 5: Store chunks and embeddings in database
    await withTransaction(async (client) => {
      // Update source with page count and status
      await client.query(
        'UPDATE sources SET page_count = $1, upload_status = $2, processed_at = NOW() WHERE id = $3',
        [extractionResult.numPages, 'completed', sourceId]
      );

      // Insert all chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddingResults[i];

        await client.query(`
          INSERT INTO doc_chunks (source_id, chunk_text, chunk_index, token_count, embedding, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          sourceId,
          chunk.text,
          i,
          chunk.tokenCount,
          JSON.stringify(embedding), // Store as JSON array
          {
            page_range: null, // Could be enhanced to track page numbers
            extraction_info: {
              total_pages: extractionResult.numPages,
              pdf_info: extractionResult.info
            }
          }
        ]);
      }
    });

    console.log(`✅ Successfully processed source ${sourceId}: ${chunks.length} chunks stored`);

    // Clean up local file if it was uploaded directly
    if (!filePath.startsWith('http') && fileBuffer) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn('Could not delete temporary file:', error.message);
      }
    }

    return {
      sourceId,
      chunksCount: chunks.length,
      pagesCount: extractionResult.numPages,
      status: 'completed'
    };

  } catch (error) {
    console.error(`❌ Processing failed for source ${sourceId}:`, error);

    // Update source status to failed
    try {
      await query(
        'UPDATE sources SET upload_status = $1 WHERE id = $2',
        ['failed', sourceId]
      );
    } catch (updateError) {
      console.error('Failed to update source status:', updateError);
    }

    throw error;
  }
};

// Get processed chunks for a source
const getSourceChunks = async (sourceId, userId, limit = 50, offset = 0) => {
  try {
    const result = await query(`
      SELECT dc.*, s.title as source_title
      FROM doc_chunks dc
      JOIN sources s ON dc.source_id = s.id
      WHERE dc.source_id = $1 AND s.user_id = $2
      ORDER BY dc.chunk_index
      LIMIT $3 OFFSET $4
    `, [sourceId, userId, limit, offset]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching source chunks:', error);
    throw error;
  }
};

// Search chunks by similarity
const searchChunks = async (userId, query, limit = 10) => {
  try {
    // Generate embedding for search query
    const queryEmbeddings = await generateEmbeddings([query]);
    const queryEmbedding = queryEmbeddings[0];

    // Perform vector similarity search
    const result = await query(`
      SELECT dc.*, s.title as source_title,
             1 - (dc.embedding <-> $1::vector) as similarity
      FROM doc_chunks dc
      JOIN sources s ON dc.source_id = s.id
      WHERE s.user_id = $2
      ORDER BY dc.embedding <-> $1::vector
      LIMIT $3
    `, [JSON.stringify(queryEmbedding), userId, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error searching chunks:', error);
    throw error;
  }
};

module.exports = {
  processUpload,
  getSourceChunks,
  searchChunks,
  cleanText,
  splitIntoChunks,
  extractTextFromPDF
};