const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');

// Import routes
const sessionRoutes = require('./routes/sessionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create required directories
const ensureDirectories = async () => {
  const directories = ['sessions', 'uploads', 'logs', 'qr-codes'];
  for (const dir of directories) {
    await fs.ensureDir(dir);
  }
};

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/webhook', webhookRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Documentation endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp OTP API',
    description: 'REST API untuk mengirim OTP melalui WhatsApp menggunakan Baileys',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      sessions: {
        create: 'POST /api/sessions/create',
        list: 'GET /api/sessions',
        status: 'GET /api/sessions/:sessionId/status',
        qr: 'GET /api/sessions/:sessionId/qr',
        logout: 'DELETE /api/sessions/:sessionId'
      },
      messages: {
        text: 'POST /api/messages/:sessionId/text',
        otp: 'POST /api/messages/:sessionId/otp',
        image: 'POST /api/messages/:sessionId/image',
        video: 'POST /api/messages/:sessionId/video',
        audio: 'POST /api/messages/:sessionId/audio',
        document: 'POST /api/messages/:sessionId/document',
        location: 'POST /api/messages/:sessionId/location',
        button: 'POST /api/messages/:sessionId/button',
        list: 'POST /api/messages/:sessionId/list'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'Endpoint tidak ditemukan'
  });
});

// Start server
const startServer = async () => {
  try {
    await ensureDirectories();
    
    app.listen(PORT, () => {
      logger.info(`🚀 WhatsApp OTP API berjalan di port ${PORT}`);
      logger.info(`📚 Dokumentasi tersedia di http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
  }
};

startServer();

module.exports = app; 