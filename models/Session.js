const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false,
    index: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  userName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  userPhone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  isConnected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    index: true
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  qrGenerated: {
    type: DataTypes.DATE,
    allowNull: true
  },
  connectedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  disconnectedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deviceInfo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'error', 'connecting'),
    defaultValue: 'inactive'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'sessions',
  indexes: [
    {
      fields: ['sessionId']
    },
    {
      fields: ['isConnected']
    },
    {
      fields: ['status']
    },
    {
      fields: ['lastSeen']
    }
  ]
});

// Instance methods
Session.prototype.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

Session.prototype.setConnected = function(user = null) {
  this.isConnected = true;
  this.status = 'active';
  this.connectedAt = new Date();
  this.lastSeen = new Date();
  this.errorMessage = null;
  
  if (user) {
    this.userId = user.id;
    this.userName = user.name;
    this.userPhone = user.id.split(':')[0];
  }
  
  return this.save();
};

Session.prototype.setDisconnected = function(errorMessage = null) {
  this.isConnected = false;
  this.status = errorMessage ? 'error' : 'inactive';
  this.disconnectedAt = new Date();
  this.errorMessage = errorMessage;
  
  return this.save();
};

// Static methods
Session.getActiveCount = async function() {
  return await Session.count({ where: { isConnected: true } });
};

Session.getBySessionId = async function(sessionId) {
  return await Session.findOne({ where: { sessionId } });
};

Session.createOrUpdate = async function(sessionId, data = {}) {
  const [session, created] = await Session.findOrCreate({
    where: { sessionId },
    defaults: {
      sessionId,
      ...data
    }
  });
  
  if (!created && Object.keys(data).length > 0) {
    await session.update(data);
  }
  
  return session;
};

module.exports = Session; 