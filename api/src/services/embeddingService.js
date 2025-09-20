const axios = require('axios');

// Generate embeddings using OpenAI API
const generateEmbeddings = async (texts) => {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Invalid input: texts must be a non-empty array');
    }

    const response = await axios.post(
      process.env.EMBEDDINGS_API_URL,
      {
        input: texts,
        model: process.env.EMBEDDINGS_MODEL || 'text-embedding-ada-002'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (!response.data || !response.data.data) {
      throw new Error('Invalid response from embeddings API');
    }

    // Extract embeddings from response
    const embeddings = response.data.data.map(item => item.embedding);
    
    console.log(`🔢 Generated ${embeddings.length} embeddings`);
    return embeddings;

  } catch (error) {
    if (error.response) {
      console.error('Embeddings API error:', error.response.status, error.response.data);
      throw new Error(`Embeddings API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
    } else if (error.request) {
      console.error('Embeddings API network error:', error.message);
      throw new Error('Network error connecting to embeddings API');
    } else {
      console.error('Embeddings service error:', error.message);
      throw error;
    }
  }
};

// Generate single embedding
const generateSingleEmbedding = async (text) => {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
};

// Batch process embeddings with rate limiting
const batchGenerateEmbeddings = async (texts, batchSize = 100, delayMs = 1000) => {
  const results = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    
    try {
      const batchEmbeddings = await generateEmbeddings(batch);
      results.push(...batchEmbeddings);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < texts.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Failed to process batch starting at index ${i}:`, error);
      throw error;
    }
  }
  
  return results;
};

// Calculate cosine similarity between two embeddings
const cosineSimilarity = (embedding1, embedding2) => {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return similarity;
};

// Find most similar embeddings
const findSimilarEmbeddings = (queryEmbedding, candidateEmbeddings, topK = 10) => {
  const similarities = candidateEmbeddings.map((embedding, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, embedding.embedding || embedding),
    ...embedding
  }));
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
};

module.exports = {
  generateEmbeddings,
  generateSingleEmbedding,
  batchGenerateEmbeddings,
  cosineSimilarity,
  findSimilarEmbeddings
};