const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { generateStudyPack, getStudyPacks, getStudyPackDetails } = require('../services/studyPackGenerator');
const { query } = require('../models/database');

const router = express.Router();

// Flow 2: Generate Study Pack
// Manually trigger study pack generation
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { topics = [], sourceIds = [], difficulty = 2 } = req.body;

    if (topics.length === 0 && sourceIds.length === 0) {
      return res.status(400).json({
        error: 'Either topics or sourceIds must be provided'
      });
    }

    const result = await generateStudyPack(req.userId, {
      topics,
      sourceIds,
      difficulty,
      manualGeneration: true
    });

    res.json({
      message: 'Study pack generated successfully',
      studyPack: result
    });

  } catch (error) {
    console.error('Study pack generation error:', error);
    res.status(500).json({
      error: 'Failed to generate study pack'
    });
  }
});

// Get user's study packs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'active' } = req.query;
    
    const studyPacks = await getStudyPacks(req.userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    res.json(studyPacks);

  } catch (error) {
    console.error('Study packs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch study packs'
    });
  }
});

// Get specific study pack details
router.get('/:studyPackId', authenticateToken, async (req, res) => {
  try {
    const { studyPackId } = req.params;
    const { includeItems = false } = req.query;

    const studyPack = await getStudyPackDetails(
      studyPackId, 
      req.userId,
      includeItems === 'true'
    );

    if (!studyPack) {
      return res.status(404).json({
        error: 'Study pack not found'
      });
    }

    res.json(studyPack);

  } catch (error) {
    console.error('Study pack details error:', error);
    res.status(500).json({
      error: 'Failed to fetch study pack details'
    });
  }
});

// Get flashcards for a study pack
router.get('/:studyPackId/flashcards', authenticateToken, async (req, res) => {
  try {
    const { studyPackId } = req.params;
    const { dueOnly = false, limit = 50 } = req.query;

    let whereClause = 'WHERE f.study_set_id = $1';
    const params = [studyPackId];

    if (dueOnly === 'true') {
      whereClause += ' AND f.due_at <= NOW()';
    }

    // Verify user owns this study pack
    const ownerCheck = await query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studyPackId, req.userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Study pack not found'
      });
    }

    const result = await query(`
      SELECT f.*, 
             CASE WHEN f.due_at <= NOW() THEN true ELSE false END as is_due
      FROM flashcards f
      ${whereClause}
      ORDER BY f.due_at ASC, f.difficulty DESC
      LIMIT $${params.length + 1}
    `, [...params, parseInt(limit)]);

    res.json({
      flashcards: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Flashcards fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch flashcards'
    });
  }
});

// Get MCQs for a study pack
router.get('/:studyPackId/mcqs', authenticateToken, async (req, res) => {
  try {
    const { studyPackId } = req.params;
    const { dueOnly = false, limit = 50 } = req.query;

    let whereClause = 'WHERE m.study_set_id = $1';
    const params = [studyPackId];

    if (dueOnly === 'true') {
      whereClause += ' AND m.due_at <= NOW()';
    }

    // Verify user owns this study pack
    const ownerCheck = await query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studyPackId, req.userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Study pack not found'
      });
    }

    const result = await query(`
      SELECT m.*,
             CASE WHEN m.due_at <= NOW() THEN true ELSE false END as is_due
      FROM mcqs m
      ${whereClause}
      ORDER BY m.due_at ASC, m.difficulty DESC
      LIMIT $${params.length + 1}
    `, [...params, parseInt(limit)]);

    res.json({
      mcqs: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('MCQs fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch MCQs'
    });
  }
});

// Submit response to flashcard/MCQ
router.post('/response', authenticateToken, async (req, res) => {
  try {
    const {
      itemId,
      itemType, // 'flashcard' or 'mcq'
      isCorrect,
      easeRating, // 1-4 for SM-2
      responseTimeMs,
      sessionId
    } = req.body;

    if (!itemId || !itemType || typeof isCorrect !== 'boolean') {
      return res.status(400).json({
        error: 'itemId, itemType, and isCorrect are required'
      });
    }

    // Verify the item belongs to the user
    const tableName = itemType === 'flashcard' ? 'flashcards' : 'mcqs';
    const ownerCheck = await query(`
      SELECT i.id FROM ${tableName} i
      JOIN study_sets s ON i.study_set_id = s.id
      WHERE i.id = $1 AND s.user_id = $2
    `, [itemId, req.userId]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Item not found or access denied'
      });
    }

    // Record the response
    await query(`
      INSERT INTO user_responses (user_id, item_id, item_type, response_correct, response_time_ms, ease_rating, session_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [req.userId, itemId, itemType, isCorrect, responseTimeMs, easeRating, sessionId]);

    // Update SM-2 algorithm values
    const { updateSM2Algorithm } = require('../services/sm2Algorithm');
    await updateSM2Algorithm(itemId, itemType, isCorrect, easeRating || 3);

    res.json({
      message: 'Response recorded successfully',
      itemId,
      isCorrect
    });

  } catch (error) {
    console.error('Response submission error:', error);
    res.status(500).json({
      error: 'Failed to record response'
    });
  }
});

// Delete study pack
router.delete('/:studyPackId', authenticateToken, async (req, res) => {
  try {
    const { studyPackId } = req.params;

    // Verify ownership and delete
    const result = await query(
      'DELETE FROM study_sets WHERE id = $1 AND user_id = $2 RETURNING id',
      [studyPackId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Study pack not found'
      });
    }

    res.json({
      message: 'Study pack deleted successfully',
      studyPackId
    });

  } catch (error) {
    console.error('Study pack deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete study pack'
    });
  }
});

module.exports = router;