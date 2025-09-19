const express = require('express');
const bcrypt = require('bcrypt');
const { generateToken, verifyToken } = require('../middleware/auth');
const { query } = require('../models/database');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, studentId, yearOfStudy } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Email, password, and full name are required'
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await query(`
      INSERT INTO users (email, password_hash, full_name, student_id, year_of_study, preferences)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, full_name, student_id, year_of_study, created_at
    `, [
      email,
      hashedPassword,
      fullName,
      studentId || null,
      yearOfStudy || null,
      {
        email_notifications: true,
        preferred_topics: ['medicine', 'anatomy', 'physiology'],
        difficulty_level: 2
      }
    ]);

    const user = userResult.rows[0];
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        studentId: user.student_id,
        yearOfStudy: user.year_of_study
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Failed to register user'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const userResult = await query(
      'SELECT id, email, password_hash, full_name, student_id, year_of_study FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        studentId: user.student_id,
        yearOfStudy: user.year_of_study
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Failed to login'
    });
  }
});

// Validate token
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    // Get user details
    const userResult = await query(
      'SELECT id, email, full_name, student_id, year_of_study, preferences FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        studentId: user.student_id,
        yearOfStudy: user.year_of_study,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      error: 'Failed to validate token'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    // Generate new token
    const newToken = generateToken(decoded.userId, decoded.email);

    res.json({
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh token'
    });
  }
});

module.exports = router;