const { sequelize } = require('../config/database');
const Session = require('./Session');
const ActivityLog = require('./ActivityLog');
const OTPLog = require('./OTPLog');

// Define associations/relationships
Session.hasMany(ActivityLog, {
  foreignKey: 'sessionId',
  sourceKey: 'sessionId',
  as: 'activityLogs'
});

Session.hasMany(OTPLog, {
  foreignKey: 'sessionId',
  sourceKey: 'sessionId',
  as: 'otpLogs'
});

ActivityLog.belongsTo(Session, {
  foreignKey: 'sessionId',
  targetKey: 'sessionId',
  as: 'session'
});

OTPLog.belongsTo(Session, {
  foreignKey: 'sessionId',
  targetKey: 'sessionId',
  as: 'session'
});

// Export all models
module.exports = {
  sequelize,
  Session,
  ActivityLog,
  OTPLog
}; 