const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { processUpload } = require('../services/uploadProcessor');
const { query } = require('../models/database');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Flow 1: Upload → Parse → Index
// Webhook endpoint for upload completion
router.post('/upload-complete', authenticateToken, async (req, res) => {
  try {
    const { fileUrl, fileName, fileSize, tags = [] } = req.body;
    
    if (!fileUrl || !fileName) {
      return res.status(400).json({
        error: 'fileUrl and fileName are required'
      });
    }

    // Create source record
    const sourceResult = await query(`
      INSERT INTO sources (user_id, title, file_path, file_type, file_size, tags, upload_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.userId,
      fileName,
      fileUrl,
      'pdf',
      fileSize || 0,
      tags,
      'processing'
    ]);

    const source = sourceResult.rows[0];

    // Start async processing
    processUpload(source.id, fileUrl, req.userId)
      .then(() => {
        console.log(`✅ Successfully processed upload: ${source.id}`);
      })
      .catch((error) => {
        console.error(`❌ Failed to process upload ${source.id}:`, error);
        // Update status to failed
        query(
          'UPDATE sources SET upload_status = $1 WHERE id = $2',
          ['failed', source.id]
        );
      });

    res.status(202).json({
      message: 'Upload received and processing started',
      sourceId: source.id,
      status: 'processing'
    });

  } catch (error) {
    console.error('Upload completion error:', error);
    res.status(500).json({
      error: 'Failed to process upload completion'
    });
  }
});

// Direct file upload endpoint
router.post('/file', authenticateToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No PDF file provided'
      });
    }

    const { title, tags } = req.body;
    const fileName = title || req.file.originalname;
    const parsedTags = tags ? JSON.parse(tags) : [];

    // Create source record
    const sourceResult = await query(`
      INSERT INTO sources (user_id, title, file_path, file_type, file_size, tags, upload_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.userId,
      fileName,
      req.file.path,
      'pdf',
      req.file.size,
      parsedTags,
      'processing'
    ]);

    const source = sourceResult.rows[0];

    // Process the uploaded file
    processUpload(source.id, req.file.path, req.userId, req.file.buffer)
      .then(() => {
        console.log(`✅ Successfully processed direct upload: ${source.id}`);
      })
      .catch((error) => {
        console.error(`❌ Failed to process direct upload ${source.id}:`, error);
        query(
          'UPDATE sources SET upload_status = $1 WHERE id = $2',
          ['failed', source.id]
        );
      });

    res.status(202).json({
      message: 'File uploaded and processing started',
      sourceId: source.id,
      fileName: fileName,
      fileSize: req.file.size,
      status: 'processing'
    });

  } catch (error) {
    console.error('Direct upload error:', error);
    res.status(500).json({
      error: 'Failed to process file upload'
    });
  }
});

// Get upload status
router.get('/status/:sourceId', authenticateToken, async (req, res) => {
  try {
    const { sourceId } = req.params;

    const result = await query(`
      SELECT s.*, 
             COUNT(dc.id) as chunk_count
      FROM sources s
      LEFT JOIN doc_chunks dc ON s.id = dc.source_id
      WHERE s.id = $1 AND s.user_id = $2
      GROUP BY s.id
    `, [sourceId, req.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Source not found'
      });
    }

    const source = result.rows[0];
    res.json({
      sourceId: source.id,
      title: source.title,
      status: source.upload_status,
      chunkCount: parseInt(source.chunk_count),
      processedAt: source.processed_at,
      createdAt: source.created_at
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to get upload status'
    });
  }
});

// List user's uploaded sources
router.get('/sources', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const params = [req.userId];

    if (status) {
      whereClause += ' AND upload_status = $2';
      params.push(status);
    }

    const result = await query(`
      SELECT s.*, 
             COUNT(dc.id) as chunk_count
      FROM sources s
      LEFT JOIN doc_chunks dc ON s.id = dc.source_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const countResult = await query(`
      SELECT COUNT(*) as total FROM sources ${whereClause}
    `, params);

    res.json({
      sources: result.rows.map(row => ({
        ...row,
        chunk_count: parseInt(row.chunk_count)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Sources list error:', error);
    res.status(500).json({
      error: 'Failed to fetch sources'
    });
  }
});

module.exports = router;