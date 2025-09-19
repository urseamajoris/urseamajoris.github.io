const { query, withTransaction } = require('../models/database');
const { searchChunks } = require('./uploadProcessor');
const { generateAIContent } = require('./aiService');
const { sendNotification } = require('./notificationService');

// RAG retrieval for study content
const retrieveRelevantContent = async (userId, topics, sourceIds = [], topK = 10) => {
  try {
    let relevantChunks = [];

    // If specific sources are provided, limit search to those
    if (sourceIds.length > 0) {
      for (const topic of topics) {
        const chunks = await query(`
          SELECT dc.*, s.title as source_title,
                 1 - (dc.embedding <-> $1::vector) as similarity
          FROM doc_chunks dc
          JOIN sources s ON dc.source_id = s.id
          WHERE s.user_id = $2 AND s.id = ANY($3)
          ORDER BY dc.embedding <-> $1::vector
          LIMIT $4
        `, [
          JSON.stringify(await require('./embeddingService').generateSingleEmbedding(topic)),
          userId,
          sourceIds,
          topK
        ]);
        relevantChunks.push(...chunks.rows);
      }
    } else {
      // Search across all user's content
      for (const topic of topics) {
        const chunks = await searchChunks(userId, topic, topK);
        relevantChunks.push(...chunks);
      }
    }

    // Remove duplicates and sort by similarity
    const uniqueChunks = relevantChunks
      .reduce((acc, chunk) => {
        if (!acc.find(c => c.id === chunk.id)) {
          acc.push(chunk);
        }
        return acc;
      }, [])
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return uniqueChunks.slice(0, topK * topics.length);

  } catch (error) {
    console.error('RAG retrieval error:', error);
    throw error;
  }
};

// Generate study pack
const generateStudyPack = async (userId, options = {}) => {
  const {
    topics = [],
    sourceIds = [],
    difficulty = 2,
    manualGeneration = false,
    maxFlashcards = 20,
    maxMCQs = 15
  } = options;

  try {
    console.log(`📚 Generating study pack for user ${userId}, topics: ${topics.join(', ')}`);

    // Step 1: Retrieve relevant content using RAG
    const relevantContent = await retrieveRelevantContent(userId, topics, sourceIds, 10);

    if (relevantContent.length === 0) {
      throw new Error('No relevant content found for the specified topics');
    }

    console.log(`📖 Retrieved ${relevantContent.length} relevant chunks`);

    // Step 2: Create study set record
    const studySetResult = await query(`
      INSERT INTO study_sets (user_id, title, description, topics, difficulty_level)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      userId,
      `Study Pack: ${topics.join(', ')}`,
      `Generated study materials for ${topics.join(', ')}`,
      topics,
      difficulty
    ]);

    const studySet = studySetResult.rows[0];

    // Step 3: Generate AI content
    const contentText = relevantContent.map(chunk => chunk.chunk_text).join('\n\n');
    
    const [summary, flashcardsData, mcqsData] = await Promise.all([
      generateAIContent('summary', contentText, topics),
      generateAIContent('flashcards', contentText, topics, { count: maxFlashcards }),
      generateAIContent('mcqs', contentText, topics, { count: maxMCQs })
    ]);

    console.log(`🤖 Generated AI content: ${flashcardsData.length} flashcards, ${mcqsData.length} MCQs`);

    // Step 4: Store generated content
    await withTransaction(async (client) => {
      // Store flashcards
      for (const flashcard of flashcardsData) {
        await client.query(`
          INSERT INTO flashcards (study_set_id, front_text, back_text, difficulty, due_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          studySet.id,
          flashcard.front,
          flashcard.back,
          difficulty
        ]);
      }

      // Store MCQs
      for (const mcq of mcqsData) {
        await client.query(`
          INSERT INTO mcqs (study_set_id, question_text, correct_answer, distractors, explanation, difficulty, due_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          studySet.id,
          mcq.question,
          mcq.correct_answer,
          mcq.distractors,
          mcq.explanation,
          difficulty
        ]);
      }
    });

    // Step 5: Send notification if not manual generation
    if (!manualGeneration) {
      await sendNotification(userId, {
        type: 'study_pack_ready',
        title: 'New Study Pack Ready! 📚',
        message: `Your study pack for ${topics.join(', ')} is ready with ${flashcardsData.length} flashcards and ${mcqsData.length} questions.`,
        data: {
          studySetId: studySet.id,
          topics,
          flashcardsCount: flashcardsData.length,
          mcqsCount: mcqsData.length
        }
      });
    }

    return {
      id: studySet.id,
      title: studySet.title,
      topics: studySet.topics,
      difficulty: studySet.difficulty_level,
      summary,
      flashcardsCount: flashcardsData.length,
      mcqsCount: mcqsData.length,
      generatedAt: studySet.generated_at
    };

  } catch (error) {
    console.error('Study pack generation error:', error);
    throw error;
  }
};

// Get user's study packs
const getStudyPacks = async (userId, options = {}) => {
  const { page = 1, limit = 10, status = 'active' } = options;
  const offset = (page - 1) * limit;

  try {
    const result = await query(`
      SELECT ss.*,
             COUNT(DISTINCT f.id) as flashcards_count,
             COUNT(DISTINCT m.id) as mcqs_count,
             COUNT(DISTINCT CASE WHEN f.due_at <= NOW() THEN f.id END) as due_flashcards,
             COUNT(DISTINCT CASE WHEN m.due_at <= NOW() THEN m.id END) as due_mcqs
      FROM study_sets ss
      LEFT JOIN flashcards f ON ss.id = f.study_set_id
      LEFT JOIN mcqs m ON ss.id = m.study_set_id
      WHERE ss.user_id = $1 AND ss.status = $2
      GROUP BY ss.id
      ORDER BY ss.generated_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, status, limit, offset]);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM study_sets WHERE user_id = $1 AND status = $2',
      [userId, status]
    );

    return {
      studyPacks: result.rows.map(row => ({
        ...row,
        flashcards_count: parseInt(row.flashcards_count),
        mcqs_count: parseInt(row.mcqs_count),
        due_flashcards: parseInt(row.due_flashcards),
        due_mcqs: parseInt(row.due_mcqs)
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    };

  } catch (error) {
    console.error('Get study packs error:', error);
    throw error;
  }
};

// Get study pack details
const getStudyPackDetails = async (studyPackId, userId, includeItems = false) => {
  try {
    const result = await query(`
      SELECT ss.*,
             COUNT(DISTINCT f.id) as flashcards_count,
             COUNT(DISTINCT m.id) as mcqs_count,
             COUNT(DISTINCT CASE WHEN f.due_at <= NOW() THEN f.id END) as due_flashcards,
             COUNT(DISTINCT CASE WHEN m.due_at <= NOW() THEN m.id END) as due_mcqs
      FROM study_sets ss
      LEFT JOIN flashcards f ON ss.id = f.study_set_id
      LEFT JOIN mcqs m ON ss.id = m.study_set_id
      WHERE ss.id = $1 AND ss.user_id = $2
      GROUP BY ss.id
    `, [studyPackId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const studyPack = result.rows[0];
    const response = {
      ...studyPack,
      flashcards_count: parseInt(studyPack.flashcards_count),
      mcqs_count: parseInt(studyPack.mcqs_count),
      due_flashcards: parseInt(studyPack.due_flashcards),
      due_mcqs: parseInt(studyPack.due_mcqs)
    };

    if (includeItems) {
      // Fetch actual items
      const [flashcards, mcqs] = await Promise.all([
        query(
          'SELECT * FROM flashcards WHERE study_set_id = $1 ORDER BY due_at, difficulty',
          [studyPackId]
        ),
        query(
          'SELECT * FROM mcqs WHERE study_set_id = $1 ORDER BY due_at, difficulty',
          [studyPackId]
        )
      ]);

      response.flashcards = flashcards.rows;
      response.mcqs = mcqs.rows;
    }

    return response;

  } catch (error) {
    console.error('Get study pack details error:', error);
    throw error;
  }
};

// Auto-generate study packs for users with new content
const autoGenerateStudyPacks = async () => {
  try {
    console.log('🤖 Starting automatic study pack generation...');

    // Find users with new/changed sources
    const usersWithNewContent = await query(`
      SELECT DISTINCT s.user_id, u.preferences
      FROM sources s
      JOIN users u ON s.user_id = u.id
      WHERE s.processed_at > NOW() - INTERVAL '24 hours'
      AND s.upload_status = 'completed'
    `);

    console.log(`Found ${usersWithNewContent.rows.length} users with new content`);

    for (const userRow of usersWithNewContent.rows) {
      const { user_id, preferences } = userRow;
      
      try {
        // Extract topics from user preferences or recent content
        const topics = preferences?.preferred_topics || ['medicine', 'anatomy', 'physiology'];
        
        await generateStudyPack(user_id, {
          topics,
          difficulty: preferences?.difficulty_level || 2,
          manualGeneration: false
        });

        console.log(`✅ Generated study pack for user ${user_id}`);

      } catch (error) {
        console.error(`❌ Failed to generate study pack for user ${user_id}:`, error);
      }
    }

    console.log('🎯 Automatic study pack generation completed');

  } catch (error) {
    console.error('Auto-generation error:', error);
    throw error;
  }
};

module.exports = {
  generateStudyPack,
  getStudyPacks,
  getStudyPackDetails,
  autoGenerateStudyPacks,
  retrieveRelevantContent
};