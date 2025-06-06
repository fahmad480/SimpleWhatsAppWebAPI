const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true
  },
  action: {
    type: DataTypes.ENUM(
      'session_create',
      'session_delete', 
      'session_restart',
      'qr_generate',
      'qr_scan',
      'connection_open',
      'connection_close',
      'message_send',
      'message_receive',
      'otp_send',
      'file_upload',
      'api_call'
    ),
    allowNull: false,
    index: true
  },
  messageType: {
    type: DataTypes.ENUM(
      'text', 
      'image', 
      'video', 
      'audio', 
      'document', 
      'location', 
      'button', 
      'list', 
      'otp'
    ),
    allowNull: true
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    index: true
  },
  messageId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('success', 'error', 'pending'),
    defaultValue: 'pending',
    index: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requestData: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  responseData: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duration in milliseconds'
  }
}, {
  tableName: 'activity_logs',
  indexes: [
    {
      fields: ['sessionId']
    },
    {
      fields: ['action']
    },
    {
      fields: ['status']
    },
    {
      fields: ['phoneNumber']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['sessionId', 'action']
    },
    {
      fields: ['phoneNumber', 'messageType']
    }
  ]
});

// Static methods
ActivityLog.logActivity = async function(data) {
  try {
    return await ActivityLog.create({
      sessionId: data.sessionId,
      action: data.action,
      messageType: data.messageType || null,
      phoneNumber: data.phoneNumber || null,
      messageId: data.messageId || null,
      status: data.status || 'success',
      details: data.details || null,
      errorMessage: data.errorMessage || null,
      requestData: data.requestData ? JSON.stringify(data.requestData) : null,
      responseData: data.responseData ? JSON.stringify(data.responseData) : null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      duration: data.duration || null
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    return null;
  }
};

ActivityLog.getSessionLogs = async function(sessionId, limit = 100) {
  return await ActivityLog.findAll({
    where: { sessionId },
    order: [['createdAt', 'DESC']],
    limit
  });
};

ActivityLog.getMessageStats = async function(sessionId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await ActivityLog.findAll({
    attributes: [
      'messageType',
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      sessionId,
      action: 'message_send',
      createdAt: {
        [sequelize.Op.gte]: startDate
      }
    },
    group: ['messageType', 'status'],
    raw: true
  });
};

ActivityLog.getErrorLogs = async function(sessionId = null, limit = 50) {
  const where = { status: 'error' };
  if (sessionId) where.sessionId = sessionId;
  
  return await ActivityLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit
  });
};

ActivityLog.cleanup = async function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const deleted = await ActivityLog.destroy({
    where: {
      createdAt: {
        [sequelize.Op.lt]: cutoffDate
      }
    }
  });
  
  return deleted;
};

module.exports = ActivityLog; 