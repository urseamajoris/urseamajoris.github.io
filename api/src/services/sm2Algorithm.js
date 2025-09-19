const { query } = require('../models/database');

// SM-2 Spaced Repetition Algorithm Implementation
// Based on: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

const updateSM2Algorithm = async (itemId, itemType, isCorrect, easeRating) => {
  try {
    const tableName = itemType === 'flashcard' ? 'flashcards' : 'mcqs';
    
    // Get current SM-2 values
    const currentResult = await query(
      `SELECT difficulty, interval_days, ease_factor, review_count FROM ${tableName} WHERE id = $1`,
      [itemId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error(`${itemType} not found: ${itemId}`);
    }

    const current = currentResult.rows[0];
    const newValues = calculateSM2(
      current.difficulty,
      current.interval_days,
      current.ease_factor,
      current.review_count,
      isCorrect,
      easeRating
    );

    // Calculate next due date
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + newValues.interval);

    // Update the item with new SM-2 values
    await query(`
      UPDATE ${tableName} 
      SET difficulty = $1, 
          interval_days = $2, 
          ease_factor = $3, 
          due_at = $4,
          last_reviewed = NOW(),
          review_count = review_count + 1
      WHERE id = $5
    `, [
      newValues.difficulty,
      newValues.interval,
      newValues.easeFactor,
      nextDueDate,
      itemId
    ]);

    console.log(`📅 Updated SM-2 for ${itemType} ${itemId}: interval=${newValues.interval} days, ease=${newValues.easeFactor}`);

    return {
      itemId,
      itemType,
      nextDueDate,
      interval: newValues.interval,
      difficulty: newValues.difficulty,
      easeFactor: newValues.easeFactor
    };

  } catch (error) {
    console.error('SM-2 update error:', error);
    throw error;
  }
};

// Core SM-2 calculation
const calculateSM2 = (difficulty, intervalDays, easeFactor, reviewCount, isCorrect, easeRating) => {
  let newDifficulty = difficulty;
  let newInterval = intervalDays;
  let newEaseFactor = easeFactor;

  if (isCorrect) {
    // Correct response
    if (reviewCount === 0) {
      newInterval = 1;
    } else if (reviewCount === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * easeFactor);
    }

    // Update ease factor based on ease rating (1-4 scale)
    // 1 = Again (hardest), 2 = Hard, 3 = Good, 4 = Easy
    newEaseFactor = easeFactor + (0.1 - (5 - easeRating) * (0.08 + (5 - easeRating) * 0.02));
    
    // Ensure ease factor doesn't go below 1.3
    if (newEaseFactor < 1.3) {
      newEaseFactor = 1.3;
    }

    // Decrease difficulty (learning is working)
    if (newDifficulty > 0) {
      newDifficulty = Math.max(0, newDifficulty - 1);
    }

  } else {
    // Incorrect response - reset interval and increase difficulty
    newInterval = 1;
    newDifficulty = Math.min(5, newDifficulty + 1);
    
    // Don't modify ease factor for incorrect responses
    // (some implementations reduce it, but we'll keep it stable)
  }

  return {
    difficulty: newDifficulty,
    interval: newInterval,
    easeFactor: Math.round(newEaseFactor * 100) / 100 // Round to 2 decimal places
  };
};

// Get items due for review
const getItemsDue = async (userId, itemType = 'both', limit = 100) => {
  try {
    let query_text = '';
    let params = [userId];

    if (itemType === 'flashcard') {
      query_text = `
        SELECT f.*, 'flashcard' as item_type, s.title as study_set_title
        FROM flashcards f
        JOIN study_sets s ON f.study_set_id = s.id
        WHERE s.user_id = $1 AND f.due_at <= NOW()
        ORDER BY f.due_at ASC, f.difficulty DESC
        LIMIT $2
      `;
      params.push(limit);
    } else if (itemType === 'mcq') {
      query_text = `
        SELECT m.*, 'mcq' as item_type, s.title as study_set_title
        FROM mcqs m
        JOIN study_sets s ON m.study_set_id = s.id
        WHERE s.user_id = $1 AND m.due_at <= NOW()
        ORDER BY m.due_at ASC, m.difficulty DESC
        LIMIT $2
      `;
      params.push(limit);
    } else {
      // Both types
      query_text = `
        (SELECT f.*, 'flashcard' as item_type, s.title as study_set_title,
                f.due_at as sort_due_at, f.difficulty as sort_difficulty
         FROM flashcards f
         JOIN study_sets s ON f.study_set_id = s.id
         WHERE s.user_id = $1 AND f.due_at <= NOW())
        UNION ALL
        (SELECT m.*, 'mcq' as item_type, s.title as study_set_title,
                m.due_at as sort_due_at, m.difficulty as sort_difficulty
         FROM mcqs m
         JOIN study_sets s ON m.study_set_id = s.id
         WHERE s.user_id = $1 AND m.due_at <= NOW())
        ORDER BY sort_due_at ASC, sort_difficulty DESC
        LIMIT $2
      `;
      params.push(limit);
    }

    const result = await query(query_text, params);
    return result.rows;

  } catch (error) {
    console.error('Get items due error:', error);
    throw error;
  }
};

// Get user's weak topics (topics with low accuracy in last 7 days)
const getWeakTopics = async (userId, limit = 10, minAttempts = 3) => {
  try {
    const result = await query(`
      SELECT tp.topic, 
             tp.accuracy_7day,
             tp.total_attempts,
             tp.correct_attempts,
             tp.last_calculated
      FROM topic_performance tp
      WHERE tp.user_id = $1 
      AND tp.total_attempts >= $2
      AND tp.accuracy_7day < 70.0
      ORDER BY tp.accuracy_7day ASC, tp.total_attempts DESC
      LIMIT $3
    `, [userId, minAttempts, limit]);

    return result.rows;

  } catch (error) {
    console.error('Get weak topics error:', error);
    throw error;
  }
};

// Update topic performance based on user responses
const updateTopicPerformance = async (userId, topics, isCorrect) => {
  try {
    for (const topic of topics) {
      // Upsert topic performance
      await query(`
        INSERT INTO topic_performance (user_id, topic, total_attempts, correct_attempts)
        VALUES ($1, $2, 1, $3)
        ON CONFLICT (user_id, topic)
        DO UPDATE SET
          total_attempts = topic_performance.total_attempts + 1,
          correct_attempts = topic_performance.correct_attempts + $3,
          last_calculated = NOW()
      `, [userId, topic, isCorrect ? 1 : 0]);
    }

    // Recalculate 7-day rolling accuracy
    await recalculateRollingAccuracy(userId, topics);

  } catch (error) {
    console.error('Update topic performance error:', error);
    throw error;
  }
};

// Recalculate rolling 7-day accuracy for topics
const recalculateRollingAccuracy = async (userId, topics = null) => {
  try {
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];

    if (topics && topics.length > 0) {
      whereClause += ' AND topic = ANY($2)';
      params.push(topics);
    }

    // Calculate accuracy from responses in the last 7 days
    const accuracyResults = await query(`
      SELECT 
        topic,
        COUNT(*) as recent_attempts,
        SUM(CASE WHEN response_correct THEN 1 ELSE 0 END) as recent_correct
      FROM (
        SELECT 
          unnest(ss.topics) as topic,
          ur.response_correct
        FROM user_responses ur
        JOIN flashcards f ON ur.item_id = f.id AND ur.item_type = 'flashcard'
        JOIN study_sets ss ON f.study_set_id = ss.id
        WHERE ur.user_id = $1 AND ur.created_at > NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        SELECT 
          unnest(ss.topics) as topic,
          ur.response_correct
        FROM user_responses ur
        JOIN mcqs m ON ur.item_id = m.id AND ur.item_type = 'mcq'
        JOIN study_sets ss ON m.study_set_id = ss.id
        WHERE ur.user_id = $1 AND ur.created_at > NOW() - INTERVAL '7 days'
      ) topic_responses
      GROUP BY topic
    `, [userId]);

    // Update topic performance with new 7-day accuracy
    for (const row of accuracyResults.rows) {
      const accuracy = row.recent_attempts > 0 
        ? (row.recent_correct / row.recent_attempts) * 100 
        : 0;

      await query(`
        UPDATE topic_performance 
        SET accuracy_7day = $1, last_calculated = NOW()
        WHERE user_id = $2 AND topic = $3
      `, [accuracy, userId, row.topic]);
    }

    console.log(`📊 Updated 7-day accuracy for ${accuracyResults.rows.length} topics`);

  } catch (error) {
    console.error('Recalculate rolling accuracy error:', error);
    throw error;
  }
};

// Get study session statistics
const getStudyStats = async (userId, days = 7) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_responses,
        SUM(CASE WHEN response_correct THEN 1 ELSE 0 END) as correct_responses,
        AVG(response_time_ms) as avg_response_time,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM user_responses
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
    `, [userId]);

    const stats = result.rows[0];
    const accuracy = stats.total_responses > 0 
      ? (stats.correct_responses / stats.total_responses) * 100 
      : 0;

    return {
      totalResponses: parseInt(stats.total_responses),
      correctResponses: parseInt(stats.correct_responses),
      accuracy: Math.round(accuracy * 100) / 100,
      avgResponseTime: Math.round(stats.avg_response_time || 0),
      activeDays: parseInt(stats.active_days),
      period: `${days} days`
    };

  } catch (error) {
    console.error('Get study stats error:', error);
    throw error;
  }
};

module.exports = {
  updateSM2Algorithm,
  calculateSM2,
  getItemsDue,
  getWeakTopics,
  updateTopicPerformance,
  recalculateRollingAccuracy,
  getStudyStats
};