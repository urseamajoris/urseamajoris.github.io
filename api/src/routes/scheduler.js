const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { generateDailyPack, getSchedulerStats } = require('../services/scheduler');
const { getItemsDue, getWeakTopics, getStudyStats } = require('../services/sm2Algorithm');

const router = express.Router();

// Flow 3: Adaptive Scheduler
// Get today's study items
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const dailyPack = await generateDailyPack(req.userId);
    
    res.json({
      message: 'Daily study pack generated',
      pack: dailyPack
    });

  } catch (error) {
    console.error('Daily pack generation error:', error);
    res.status(500).json({
      error: 'Failed to generate daily study pack'
    });
  }
});

// Get items due for review
router.get('/due', authenticateToken, async (req, res) => {
  try {
    const { type = 'both', limit = 50 } = req.query;
    
    const dueItems = await getItemsDue(req.userId, type, parseInt(limit));
    
    res.json({
      dueItems,
      count: dueItems.length,
      type
    });

  } catch (error) {
    console.error('Due items fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch due items'
    });
  }
});

// Get weak topics
router.get('/weak-topics', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, minAttempts = 3 } = req.query;
    
    const weakTopics = await getWeakTopics(
      req.userId, 
      parseInt(limit), 
      parseInt(minAttempts)
    );
    
    res.json({
      weakTopics,
      count: weakTopics.length
    });

  } catch (error) {
    console.error('Weak topics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch weak topics'
    });
  }
});

// Get study statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const stats = await getStudyStats(req.userId, parseInt(days));
    
    res.json(stats);

  } catch (error) {
    console.error('Study stats fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch study statistics'
    });
  }
});

// Get scheduler configuration and stats
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const schedulerStats = await getSchedulerStats(req.userId);
    
    res.json({
      schedulerStats,
      timezone: process.env.SCHEDULER_TIMEZONE || 'Asia/Bangkok',
      dailyScheduleTime: process.env.DAILY_SCHEDULE_TIME || '07:00'
    });

  } catch (error) {
    console.error('Scheduler config fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch scheduler configuration'
    });
  }
});

// Manually trigger daily pack generation for user
router.post('/trigger-daily', authenticateToken, async (req, res) => {
  try {
    const dailyPack = await generateDailyPack(req.userId, true); // Force generation
    
    res.json({
      message: 'Daily pack generated successfully',
      pack: dailyPack,
      triggered: 'manual'
    });

  } catch (error) {
    console.error('Manual daily pack trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger daily pack generation'
    });
  }
});

// Get upcoming schedule preview
router.get('/preview', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const preview = [];
    
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Get items due on this date
      const dueItems = await getItemsDue(req.userId, 'both', 100);
      const itemsForDate = dueItems.filter(item => {
        const dueDate = new Date(item.due_at);
        return dueDate.toDateString() === date.toDateString();
      });
      
      preview.push({
        date: date.toISOString().split('T')[0],
        itemCount: itemsForDate.length,
        flashcards: itemsForDate.filter(item => item.item_type === 'flashcard').length,
        mcqs: itemsForDate.filter(item => item.item_type === 'mcq').length
      });
    }
    
    res.json({
      preview,
      days: parseInt(days)
    });

  } catch (error) {
    console.error('Schedule preview error:', error);
    res.status(500).json({
      error: 'Failed to generate schedule preview'
    });
  }
});

module.exports = router;