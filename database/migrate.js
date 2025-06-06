require('dotenv').config();
const { testConnection, syncDatabase, logger } = require('../config/database');
const { Session, ActivityLog, OTPLog } = require('../models');

const migrate = async () => {
  try {
    logger.info('🔧 Starting database migration...');
    
    // Test connection
    const connectionOk = await testConnection();
    if (!connectionOk) {
      logger.error('❌ Database connection failed. Migration aborted.');
      process.exit(1);
    }
    
    // Sync database
    const force = process.argv.includes('--force');
    if (force) {
      logger.warn('⚠️  Force mode enabled. All existing data will be lost!');
    }
    
    const syncOk = await syncDatabase(force);
    if (!syncOk) {
      logger.error('❌ Database sync failed.');
      process.exit(1);
    }
    
    logger.info('✅ Database migration completed successfully!');
    
    // Show table info
    logger.info('📋 Created tables:');
    logger.info('  - sessions (Session management)');
    logger.info('  - activity_logs (API activity tracking)');
    logger.info('  - otp_logs (OTP tracking)');
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  migrate();
}

module.exports = migrate; 