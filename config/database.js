require('dotenv').config();
const { Sequelize } = require('sequelize');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [DB ${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database.log' })
  ]
});

// Database configuration berdasarkan environment
let sequelize;

const dbType = process.env.DB_TYPE || 'sqlite';

if (dbType === 'mysql') {
  // MySQL Configuration
  sequelize = new Sequelize(
    process.env.DB_MYSQL_DATABASE || 'whatsapp_otp_api',
    process.env.DB_MYSQL_USERNAME || 'root',
    process.env.DB_MYSQL_PASSWORD || '',
    {
      host: process.env.DB_MYSQL_HOST || 'localhost',
      port: process.env.DB_MYSQL_PORT || 3306,
      dialect: 'mysql',
      logging: (msg) => logger.info(msg),
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        timestamps: true
      }
    }
  );
  
  logger.info(`Using MySQL database: ${process.env.DB_MYSQL_DATABASE}`);
} else {
  // SQLite Configuration (default)
  const fs = require('fs-extra');
  const path = require('path');
  
  const dbPath = process.env.DB_SQLITE_PATH || './database/whatsapp_api.db';
  const dbDir = path.dirname(dbPath);
  
  // Ensure database directory exists
  fs.ensureDirSync(dbDir);
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: (msg) => logger.info(msg),
    define: {
      timestamps: true
    }
  });
  
  logger.info(`Using SQLite database: ${dbPath}`);
}

// Test koneksi database
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
};

// Sync database dengan models
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
    logger.info(`Database synchronized${force ? ' (forced)' : ''}`);
    return true;
  } catch (error) {
    logger.error('Database sync failed:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  logger
}; 