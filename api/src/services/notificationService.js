const nodemailer = require('nodemailer');
const axios = require('axios');
const { query } = require('../models/database');

// Email transporter setup (using SendGrid)
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  });
};

// Send notification through multiple channels
const sendNotification = async (userId, notification) => {
  try {
    // Get user preferences and contact info
    const userResult = await query(
      'SELECT email, full_name, preferences FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User not found: ${userId}`);
    }

    const user = userResult.rows[0];
    const preferences = user.preferences || {};

    // Create notification record
    const notificationResult = await query(`
      INSERT INTO notifications (user_id, type, title, message, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id
    `, [userId, notification.type, notification.title, notification.message]);

    const notificationId = notificationResult.rows[0].id;

    // Send through preferred channels
    const results = [];

    // Email notification (if enabled)
    if (preferences.email_notifications !== false) {
      try {
        await sendEmailNotification(user, notification);
        results.push({ channel: 'email', status: 'sent' });
        
        await query(
          'UPDATE notifications SET delivery_channel = $1, sent_at = NOW(), status = $2 WHERE id = $3',
          ['email', 'sent', notificationId]
        );
      } catch (error) {
        console.error('Email notification failed:', error);
        results.push({ channel: 'email', status: 'failed', error: error.message });
      }
    }

    // LINE notification (if LINE ID is available)
    if (preferences.line_user_id && preferences.line_notifications !== false) {
      try {
        await sendLINENotification(preferences.line_user_id, notification);
        results.push({ channel: 'line', status: 'sent' });
        
        await query(
          'UPDATE notifications SET delivery_channel = $1, sent_at = NOW(), status = $2 WHERE id = $3',
          ['line', 'sent', notificationId]
        );
      } catch (error) {
        console.error('LINE notification failed:', error);
        results.push({ channel: 'line', status: 'failed', error: error.message });
      }
    }

    // Telegram notification (if Telegram chat ID is available)
    if (preferences.telegram_chat_id && preferences.telegram_notifications !== false) {
      try {
        await sendTelegramNotification(preferences.telegram_chat_id, notification);
        results.push({ channel: 'telegram', status: 'sent' });
        
        await query(
          'UPDATE notifications SET delivery_channel = $1, sent_at = NOW(), status = $2 WHERE id = $3',
          ['telegram', 'sent', notificationId]
        );
      } catch (error) {
        console.error('Telegram notification failed:', error);
        results.push({ channel: 'telegram', status: 'failed', error: error.message });
      }
    }

    // If no successful delivery, mark as failed
    if (results.length === 0 || results.every(r => r.status === 'failed')) {
      await query(
        'UPDATE notifications SET status = $1 WHERE id = $2',
        ['failed', notificationId]
      );
    }

    console.log(`📬 Sent notification to user ${userId}: ${results.map(r => `${r.channel}:${r.status}`).join(', ')}`);

    return {
      notificationId,
      deliveryResults: results
    };

  } catch (error) {
    console.error('Send notification error:', error);
    throw error;
  }
};

// Send email notification
const sendEmailNotification = async (user, notification) => {
  try {
    const transporter = createEmailTransporter();
    
    const emailContent = generateEmailContent(notification);
    
    const mailOptions = {
      from: {
        name: 'RAMSC Study Assistant',
        address: process.env.FROM_EMAIL || 'noreply@ramsc.edu'
      },
      to: user.email,
      subject: notification.title,
      html: emailContent.html,
      text: emailContent.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${user.email}:`, info.messageId);

    return info;

  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

// Send LINE notification
const sendLINENotification = async (lineUserId, notification) => {
  try {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      throw new Error('LINE Channel Access Token not configured');
    }

    const message = {
      type: 'text',
      text: `${notification.title}\n\n${notification.message}`
    };

    // For rich notifications, use flex message
    if (notification.type === 'daily_pack_ready' && notification.data) {
      message.type = 'flex';
      message.altText = notification.title;
      message.contents = generateLINEFlexMessage(notification);
    }

    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineUserId,
        messages: [message]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`💬 LINE message sent to ${lineUserId}`);
    return response.data;

  } catch (error) {
    console.error('LINE notification error:', error);
    throw error;
  }
};

// Send Telegram notification
const sendTelegramNotification = async (chatId, notification) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('Telegram Bot Token not configured');
    }

    const message = `*${notification.title}*\n\n${notification.message}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      }
    );

    console.log(`🤖 Telegram message sent to ${chatId}`);
    return response.data;

  } catch (error) {
    console.error('Telegram notification error:', error);
    throw error;
  }
};

// Generate email content
const generateEmailContent = (notification) => {
  const baseHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2ED3E6, #7C3AED); color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
        .btn { display: inline-block; background: #2ED3E6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .stats { background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">🏥 RAMSC Study Assistant</h1>
        </div>
        <div class="content">
          <h2 style="color: #1e293b; margin-bottom: 20px;">${notification.title}</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #334155;">${notification.message}</p>
          ${generateNotificationSpecificContent(notification)}
        </div>
        <div class="footer">
          <p>Ramathibodi Medical Student's Council - Study Assistant</p>
          <p>To unsubscribe from these notifications, update your preferences in the dashboard.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${notification.title}

${notification.message}

---
RAMSC Study Assistant
Ramathibodi Medical Student's Council
  `;

  return {
    html: baseHTML,
    text: textContent
  };
};

// Generate notification-specific content
const generateNotificationSpecificContent = (notification) => {
  if (notification.type === 'daily_pack_ready' && notification.data) {
    return `
      <div class="stats">
        <h3>📊 Today's Study Pack Breakdown:</h3>
        <ul>
          <li><strong>${notification.data.dueItems}</strong> due reviews</li>
          <li><strong>${notification.data.weakTopicItems}</strong> weak topic reinforcement</li>
          <li><strong>${notification.data.newItems}</strong> new content</li>
        </ul>
        ${notification.data.weakTopics?.length > 0 ? 
          `<p><strong>Focus areas:</strong> ${notification.data.weakTopics.join(', ')}</p>` : 
          ''
        }
      </div>
      <div style="text-align: center;">
        <a href="#" class="btn">Start Studying Now 📚</a>
      </div>
    `;
  }

  if (notification.type === 'study_pack_ready' && notification.data) {
    return `
      <div class="stats">
        <h3>📚 New Study Pack Details:</h3>
        <ul>
          <li><strong>${notification.data.flashcardsCount}</strong> flashcards</li>
          <li><strong>${notification.data.mcqsCount}</strong> multiple choice questions</li>
          <li><strong>Topics:</strong> ${notification.data.topics?.join(', ')}</li>
        </ul>
      </div>
      <div style="text-align: center;">
        <a href="#" class="btn">View Study Pack 🎯</a>
      </div>
    `;
  }

  return '';
};

// Generate LINE Flex Message
const generateLINEFlexMessage = (notification) => {
  if (notification.type === 'daily_pack_ready') {
    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📚 Daily Study Pack',
            weight: 'bold',
            color: '#ffffff',
            size: 'lg'
          }
        ],
        backgroundColor: '#2ED3E6',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: notification.message,
            wrap: true,
            size: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `📝 ${notification.data.dueItems} due reviews`,
                size: 'sm',
                margin: 'sm'
              },
              {
                type: 'text',
                text: `🎯 ${notification.data.weakTopicItems} weak topics`,
                size: 'sm',
                margin: 'sm'
              },
              {
                type: 'text',
                text: `✨ ${notification.data.newItems} new content`,
                size: 'sm',
                margin: 'sm'
              }
            ],
            margin: 'lg'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'Start Studying',
              uri: 'https://ramsc.edu/study' // Replace with actual URL
            },
            style: 'primary',
            color: '#2ED3E6'
          }
        ]
      }
    };
  }

  return null;
};

// Get notification history for user
const getNotificationHistory = async (userId, limit = 50, offset = 0) => {
  try {
    const result = await query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return result.rows;

  } catch (error) {
    console.error('Get notification history error:', error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  sendEmailNotification,
  sendLINENotification,
  sendTelegramNotification,
  getNotificationHistory
};