const cron = require('node-cron');
const { query } = require('../models/database');
const { getItemsDue, getWeakTopics, recalculateRollingAccuracy } = require('./sm2Algorithm');
const { autoGenerateStudyPacks } = require('./studyPackGenerator');
const { sendNotification } = require('./notificationService');

// Start the scheduler with various automated tasks
const startScheduler = () => {
  console.log('🕐 Starting RAMSC Info Services Scheduler...');

  // Daily study pack delivery at 07:00 Asia/Bangkok
  cron.schedule('0 7 * * *', async () => {
    console.log('📅 Running daily study pack delivery...');
    await runDailyScheduler();
  }, {
    timezone: process.env.SCHEDULER_TIMEZONE || 'Asia/Bangkok'
  });

  // Auto-generate study packs for new content (every 4 hours)
  cron.schedule('0 */4 * * *', async () => {
    console.log('🤖 Running auto study pack generation...');
    await autoGenerateStudyPacks();
  });

  // Update topic performance analytics (daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('📊 Updating topic performance analytics...');
    await updateAllTopicPerformance();
  });

  // Weekly report generation (Sundays at 08:00)
  cron.schedule('0 8 * * 0', async () => {
    console.log('📈 Generating weekly reports...');
    await generateWeeklyReports();
  });

  console.log('✅ Scheduler started successfully');
};

// Main daily scheduler function
const runDailyScheduler = async () => {
  try {
    // Get all active users
    const usersResult = await query(
      'SELECT id, email, full_name, preferences FROM users'
    );

    console.log(`🎯 Processing daily packs for ${usersResult.rows.length} users`);

    for (const user of usersResult.rows) {
      try {
        await generateDailyPack(user.id);
        console.log(`✅ Generated daily pack for user ${user.id}`);
      } catch (error) {
        console.error(`❌ Failed daily pack for user ${user.id}:`, error);
      }
    }

    console.log('🎉 Daily scheduler run completed');

  } catch (error) {
    console.error('❌ Daily scheduler error:', error);
  }
};

// Generate daily study pack for a user
const generateDailyPack = async (userId, forceGeneration = false) => {
  try {
    console.log(`📚 Generating daily pack for user ${userId}`);

    // Check if daily pack already generated today (unless forced)
    if (!forceGeneration) {
      const existingPackResult = await query(`
        SELECT id FROM study_sessions 
        WHERE user_id = $1 
        AND session_type = 'daily' 
        AND DATE(started_at) = CURRENT_DATE
        AND status != 'completed'
      `, [userId]);

      if (existingPackResult.rows.length > 0) {
        console.log(`📅 Daily pack already exists for user ${userId}`);
        return { message: 'Daily pack already generated today' };
      }
    }

    // Step 1: Get items due today (60% of pack)
    const dueItems = await getItemsDue(userId, 'both', 20);
    const dueFlashcards = dueItems.filter(item => item.item_type === 'flashcard').slice(0, 12);
    const dueMCQs = dueItems.filter(item => item.item_type === 'mcq').slice(0, 8);

    // Step 2: Get weak topics items (25% of pack)
    const weakTopics = await getWeakTopics(userId, 5);
    let weakTopicItems = [];
    
    if (weakTopics.length > 0) {
      const weakTopicNames = weakTopics.map(topic => topic.topic);
      const weakTopicQuery = await query(`
        (SELECT f.*, 'flashcard' as item_type FROM flashcards f
         JOIN study_sets s ON f.study_set_id = s.id
         WHERE s.user_id = $1 AND s.topics && $2
         ORDER BY f.difficulty DESC, RANDOM()
         LIMIT 5)
        UNION ALL
        (SELECT m.*, 'mcq' as item_type FROM mcqs m
         JOIN study_sets s ON m.study_set_id = s.id
         WHERE s.user_id = $1 AND s.topics && $2
         ORDER BY m.difficulty DESC, RANDOM()
         LIMIT 3)
      `, [userId, weakTopicNames]);
      
      weakTopicItems = weakTopicQuery.rows;
    }

    // Step 3: Get new items (15% of pack)
    const newItemsQuery = await query(`
      (SELECT f.*, 'flashcard' as item_type FROM flashcards f
       JOIN study_sets s ON f.study_set_id = s.id
       WHERE s.user_id = $1 AND f.review_count = 0
       ORDER BY f.created_at DESC, RANDOM()
       LIMIT 3)
      UNION ALL
      (SELECT m.*, 'mcq' as item_type FROM mcqs m
       JOIN study_sets s ON m.study_set_id = s.id
       WHERE s.user_id = $1 AND m.review_count = 0
       ORDER BY m.created_at DESC, RANDOM()
       LIMIT 2)
    `, [userId]);

    const newItems = newItemsQuery.rows;

    // Combine all items
    const allItems = [
      ...dueFlashcards,
      ...dueMCQs,
      ...weakTopicItems,
      ...newItems
    ];

    // Remove duplicates
    const uniqueItems = allItems.reduce((acc, item) => {
      if (!acc.find(existing => existing.id === item.id && existing.item_type === item.item_type)) {
        acc.push(item);
      }
      return acc;
    }, []);

    // Limit to 20-30 items total
    const finalItems = uniqueItems.slice(0, 25);

    if (finalItems.length === 0) {
      console.log(`📭 No items available for daily pack for user ${userId}`);
      return { message: 'No study items available today' };
    }

    // Create study session record
    const sessionResult = await query(`
      INSERT INTO study_sessions (user_id, session_type, items_total)
      VALUES ($1, 'daily', $2)
      RETURNING *
    `, [userId, finalItems.length]);

    const session = sessionResult.rows[0];

    // Send notification
    await sendNotification(userId, {
      type: 'daily_pack_ready',
      title: '📚 Your Daily Study Pack is Ready!',
      message: `${finalItems.length} items waiting for you. ${dueFlashcards.length + dueMCQs.length} due reviews, ${weakTopicItems.length} weak topics, ${newItems.length} new content.`,
      data: {
        sessionId: session.id,
        totalItems: finalItems.length,
        dueItems: dueFlashcards.length + dueMCQs.length,
        weakTopicItems: weakTopicItems.length,
        newItems: newItems.length,
        weakTopics: weakTopics.map(t => t.topic)
      }
    });

    console.log(`✅ Daily pack generated for user ${userId}: ${finalItems.length} items`);

    return {
      sessionId: session.id,
      totalItems: finalItems.length,
      breakdown: {
        dueFlashcards: dueFlashcards.length,
        dueMCQs: dueMCQs.length,
        weakTopicItems: weakTopicItems.length,
        newItems: newItems.length
      },
      weakTopics: weakTopics.map(t => ({
        topic: t.topic,
        accuracy: t.accuracy_7day
      })),
      items: finalItems.slice(0, 10) // Return first 10 items immediately
    };

  } catch (error) {
    console.error(`❌ Daily pack generation error for user ${userId}:`, error);
    throw error;
  }
};

// Update topic performance for all users
const updateAllTopicPerformance = async () => {
  try {
    console.log('📊 Starting topic performance update for all users...');

    const usersResult = await query('SELECT DISTINCT user_id FROM user_responses');
    
    for (const userRow of usersResult.rows) {
      try {
        await recalculateRollingAccuracy(userRow.user_id);
        console.log(`✅ Updated topic performance for user ${userRow.user_id}`);
      } catch (error) {
        console.error(`❌ Failed to update topic performance for user ${userRow.user_id}:`, error);
      }
    }

    console.log('🎯 Topic performance update completed');

  } catch (error) {
    console.error('❌ Topic performance update error:', error);
  }
};

// Generate weekly reports
const generateWeeklyReports = async () => {
  try {
    console.log('📈 Generating weekly reports...');

    const usersResult = await query(
      'SELECT id, email, full_name FROM users'
    );

    for (const user of usersResult.rows) {
      try {
        const weeklyStats = await generateUserWeeklyReport(user.id);
        
        if (weeklyStats.totalResponses > 0) {
          await sendNotification(user.id, {
            type: 'weekly_report',
            title: '📊 Your Weekly Study Report',
            message: `This week: ${weeklyStats.totalResponses} items completed, ${weeklyStats.accuracy}% accuracy, ${weeklyStats.activeDays} active days.`,
            data: weeklyStats
          });
        }

        console.log(`📈 Generated weekly report for user ${user.id}`);

      } catch (error) {
        console.error(`❌ Failed weekly report for user ${user.id}:`, error);
      }
    }

    console.log('✅ Weekly reports generation completed');

  } catch (error) {
    console.error('❌ Weekly reports error:', error);
  }
};

// Generate individual user weekly report
const generateUserWeeklyReport = async (userId) => {
  try {
    const { getStudyStats } = require('./sm2Algorithm');
    const weeklyStats = await getStudyStats(userId, 7);

    // Get streak information
    const streakResult = await query(`
      SELECT COUNT(DISTINCT DATE(created_at)) as study_streak
      FROM user_responses
      WHERE user_id = $1 
      AND created_at >= (
        SELECT MAX(date_with_no_activity) FROM (
          SELECT date_series.date as date_with_no_activity
          FROM generate_series(
            CURRENT_DATE - INTERVAL '30 days',
            CURRENT_DATE,
            '1 day'::interval
          ) date_series(date)
          WHERE NOT EXISTS (
            SELECT 1 FROM user_responses ur
            WHERE ur.user_id = $1 
            AND DATE(ur.created_at) = date_series.date
          )
          ORDER BY date_series.date DESC
          LIMIT 1
        ) last_gap
      )
    `, [userId]);

    const streak = streakResult.rows[0]?.study_streak || 0;

    // Get top performing topics
    const topTopicsResult = await query(`
      SELECT topic, accuracy_7day, total_attempts
      FROM topic_performance
      WHERE user_id = $1 AND total_attempts >= 3
      ORDER BY accuracy_7day DESC
      LIMIT 3
    `, [userId]);

    return {
      ...weeklyStats,
      studyStreak: streak,
      topTopics: topTopicsResult.rows
    };

  } catch (error) {
    console.error('Generate user weekly report error:', error);
    throw error;
  }
};

// Get scheduler statistics
const getSchedulerStats = async (userId) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(CASE WHEN session_type = 'daily' THEN 1 END) as daily_sessions,
        COUNT(CASE WHEN session_type = 'daily' AND status = 'completed' THEN 1 END) as completed_daily_sessions,
        AVG(CASE WHEN session_type = 'daily' AND status = 'completed' 
            THEN items_correct::float / items_total END) * 100 as avg_daily_accuracy,
        MAX(started_at) as last_daily_session
      FROM study_sessions
      WHERE user_id = $1 AND started_at > NOW() - INTERVAL '30 days'
    `, [userId]);

    return stats.rows[0] || {
      daily_sessions: 0,
      completed_daily_sessions: 0,
      avg_daily_accuracy: 0,
      last_daily_session: null
    };

  } catch (error) {
    console.error('Get scheduler stats error:', error);
    throw error;
  }
};

module.exports = {
  startScheduler,
  runDailyScheduler,
  generateDailyPack,
  updateAllTopicPerformance,
  generateWeeklyReports,
  getSchedulerStats
};