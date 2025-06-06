require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');

// Database
const { testConnection, syncDatabase } = require('./config/database');

// Routes
const sessionRoutes = require('./routes/sessionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const otpRoutes = require('./routes/otpRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Static files untuk dokumentasi
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/otp', otpRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const dbConnected = await testConnection();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbConnected ? 'connected' : 'disconnected',
      version: require('./package.json').version,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint dengan dokumentasi
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp OTP API',
    version: require('./package.json').version,
    description: 'REST API untuk WhatsApp OTP menggunakan Baileys dengan database integration',
    endpoints: {
      health: '/api/health',
      sessions: '/api/sessions',
      messages: '/api/messages',
      otp: '/api/otp',
      analytics: '/api/analytics',
      webhook: '/api/webhook',
      docs: '/docs'
    },
    database: {
      type: process.env.DB_TYPE || 'sqlite',
      status: 'Check /api/health for status'
    },
    features: [
      'Multi-session WhatsApp support',
      'OTP generation and verification',
      'Message logging and analytics',
      'Database persistence',
      'Activity tracking',
      'Error monitoring'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Error ${req.method} ${req.originalUrl}:`, error);
  
  // Multer file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File terlalu besar. Maksimal 50MB.'
    });
  }
  
  if (error.message && error.message.includes('tidak didukung')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: error.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
    availableEndpoints: {
      health: '/api/health',
      sessions: '/api/sessions',
      messages: '/api/messages',
      otp: '/api/otp',
      analytics: '/api/analytics',
      webhook: '/api/webhook'
    }
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Ensure required directories exist
    await fs.ensureDir('logs');
    await fs.ensureDir('sessions');
    await fs.ensureDir('uploads');
    await fs.ensureDir('qr-codes');
    await fs.ensureDir('database');

    logger.info('📁 Direktori yang diperlukan telah dibuat');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    // Sync database models
    const syncSuccess = await syncDatabase();
    if (!syncSuccess) {
      logger.error('❌ Database sync failed.');
      process.exit(1);
    }

    logger.info('✅ Database initialized successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 WhatsApp OTP API berjalan di port ${PORT}`);
      logger.info(`📚 Dokumentasi tersedia di http://localhost:${PORT}`);
      logger.info(`💾 Database: ${process.env.DB_TYPE || 'sqlite'}`);
      logger.info(`🔍 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`📊 Analytics: http://localhost:${PORT}/api/analytics/dashboard`);
    });

  } catch (error) {
    logger.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  // Close database connections
  const { sequelize } = require('./config/database');
  sequelize.close().then(() => {
    logger.info('Database connections closed');
    process.exit(0);
  }).catch((error) => {
    logger.error('Error closing database:', error);
    process.exit(1);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer(); 