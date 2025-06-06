const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OTPLog = sequelize.define('OTPLog', {
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
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false,
    index: true
  },
  otp: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  otpHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Hashed OTP for verification'
  },
  status: {
    type: DataTypes.ENUM('sent', 'verified', 'expired', 'failed'),
    defaultValue: 'sent',
    index: true
  },
  messageId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    index: true
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  companyName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'otp_logs',
  indexes: [
    {
      fields: ['sessionId']
    },
    {
      fields: ['phoneNumber']
    },
    {
      fields: ['status']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['phoneNumber', 'status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance methods
OTPLog.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

OTPLog.prototype.canVerify = function() {
  return !this.isExpired() && 
         this.status === 'sent' && 
         this.attempts < this.maxAttempts;
};

OTPLog.prototype.verify = function(inputOtp) {
  if (!this.canVerify()) {
    return { success: false, message: 'OTP tidak dapat diverifikasi' };
  }
  
  this.attempts += 1;
  
  if (this.otp === inputOtp) {
    this.status = 'verified';
    this.verifiedAt = new Date();
    return { success: true, message: 'OTP berhasil diverifikasi' };
  } else {
    if (this.attempts >= this.maxAttempts) {
      this.status = 'expired';
    }
    return { success: false, message: 'OTP tidak valid' };
  }
};

OTPLog.prototype.markExpired = function() {
  this.status = 'expired';
  return this.save();
};

// Static methods
OTPLog.createOTP = async function(data) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry
  
  return await OTPLog.create({
    sessionId: data.sessionId,
    phoneNumber: data.phoneNumber,
    otp: data.otp,
    otpHash: data.otpHash || null,
    messageId: data.messageId || null,
    expiresAt,
    companyName: data.companyName || null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null
  });
};

OTPLog.getValidOTP = async function(phoneNumber, otp) {
  return await OTPLog.findOne({
    where: {
      phoneNumber,
      otp,
      status: 'sent',
      expiresAt: {
        [sequelize.Op.gt]: new Date()
      },
      attempts: {
        [sequelize.Op.lt]: sequelize.col('maxAttempts')
      }
    },
    order: [['createdAt', 'DESC']]
  });
};

OTPLog.getRecentOTP = async function(phoneNumber, sessionId = null) {
  const where = {
    phoneNumber,
    createdAt: {
      [sequelize.Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    }
  };
  
  if (sessionId) where.sessionId = sessionId;
  
  return await OTPLog.findOne({
    where,
    order: [['createdAt', 'DESC']]
  });
};

OTPLog.getPhoneStats = async function(phoneNumber, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await OTPLog.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      phoneNumber,
      createdAt: {
        [sequelize.Op.gte]: startDate
      }
    },
    group: ['status'],
    raw: true
  });
};

OTPLog.cleanup = async function(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const deleted = await OTPLog.destroy({
    where: {
      createdAt: {
        [sequelize.Op.lt]: cutoffDate
      }
    }
  });
  
  return deleted;
};

OTPLog.expireOldOTPs = async function() {
  const expired = await OTPLog.update(
    { status: 'expired' },
    {
      where: {
        status: 'sent',
        expiresAt: {
          [sequelize.Op.lt]: new Date()
        }
      }
    }
  );
  
  return expired[0]; // Number of affected rows
};

module.exports = OTPLog; 