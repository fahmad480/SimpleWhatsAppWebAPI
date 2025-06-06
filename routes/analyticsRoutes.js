const express = require('express');
const router = express.Router();
const { OTPLog, ActivityLog, Session } = require('../models');
const { Op, Sequelize } = require('sequelize');

// GET - Dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    // Total statistics
    const totalSessions = await Session.count({ where: { status: 'connected' } });
    const totalOTPs = await OTPLog.count();
    const verifiedOTPs = await OTPLog.count({ where: { status: 'verified' } });
    const todayOTPs = await OTPLog.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    // Success rate
    const successRate = totalOTPs > 0 ? ((verifiedOTPs / totalOTPs) * 100).toFixed(2) : 0;

    // Daily OTP statistics for the past week
    const dailyStats = await OTPLog.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'verified' THEN 1 ELSE 0 END")), 'verified']
      ],
      where: {
        createdAt: {
          [Op.gte]: dateFrom
        }
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']]
    });

    // Popular phone number patterns (country codes)
    const countryStats = await OTPLog.findAll({
      attributes: [
        [Sequelize.fn('SUBSTR', Sequelize.col('phoneNumber'), 1, 3), 'countryCode'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: [Sequelize.fn('SUBSTR', Sequelize.col('phoneNumber'), 1, 3)],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
      limit: 10
    });

    // Recent activity
    const recentActivity = await ActivityLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      message: 'Dashboard data berhasil diambil',
      data: {
        overview: {
          totalSessions,
          totalOTPs,
          verifiedOTPs,
          todayOTPs,
          successRate: parseFloat(successRate)
        },
        dailyStats: dailyStats.map(stat => ({
          date: stat.dataValues.date,
          total: parseInt(stat.dataValues.total),
          verified: parseInt(stat.dataValues.verified),
          successRate: stat.dataValues.total > 0 ? 
            ((stat.dataValues.verified / stat.dataValues.total) * 100).toFixed(2) : 0
        })),
        countryStats: countryStats.map(stat => ({
          countryCode: stat.dataValues.countryCode,
          count: parseInt(stat.dataValues.count)
        })),
        recentActivity: recentActivity.map(activity => ({
          id: activity.id,
          sessionId: activity.sessionId,
          action: activity.action,
          details: activity.details,
          createdAt: activity.createdAt
        }))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - Session analytics
router.get('/sessions', async (req, res) => {
  try {
    // Session status distribution
    const sessionStats = await Session.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Session activity over time
    const sessionActivity = await ActivityLog.findAll({
      attributes: [
        'sessionId',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'activityCount'],
        [Sequelize.fn('MAX', Sequelize.col('createdAt')), 'lastActivity']
      ],
      group: ['sessionId'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']]
    });

    res.json({
      success: true,
      message: 'Session analytics berhasil diambil',
      data: {
        statusDistribution: sessionStats.map(stat => ({
          status: stat.status,
          count: parseInt(stat.dataValues.count)
        })),
        activityBySession: sessionActivity.map(activity => ({
          sessionId: activity.sessionId,
          activityCount: parseInt(activity.dataValues.activityCount),
          lastActivity: activity.dataValues.lastActivity
        }))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - OTP analytics
router.get('/otp', async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    // Status distribution
    const statusStats = await OTPLog.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: dateFrom
        }
      },
      group: ['status']
    });

    // Time-based analytics
    let timeFormat;
    switch (period) {
      case 'hourly':
        timeFormat = '%Y-%m-%d %H:00:00';
        break;
      case 'weekly':
        timeFormat = '%Y-%u';
        break;
      case 'monthly':
        timeFormat = '%Y-%m';
        break;
      default:
        timeFormat = '%Y-%m-%d';
    }

    const timeStats = await OTPLog.findAll({
      attributes: [
        [Sequelize.fn('strftime', timeFormat, Sequelize.col('createdAt')), 'period'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'verified' THEN 1 ELSE 0 END")), 'verified'],
        [Sequelize.fn('AVG', Sequelize.col('attempts')), 'avgAttempts']
      ],
      where: {
        createdAt: {
          [Op.gte]: dateFrom
        }
      },
      group: [Sequelize.fn('strftime', timeFormat, Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('strftime', timeFormat, Sequelize.col('createdAt')), 'ASC']]
    });

    // Top failed phones (for monitoring abuse)
    const failedPhones = await OTPLog.findAll({
      attributes: [
        'phoneNumber',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalAttempts'],
        [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")), 'failures']
      ],
      where: {
        createdAt: {
          [Op.gte]: dateFrom
        },
        status: {
          [Op.in]: ['failed', 'expired']
        }
      },
      group: ['phoneNumber'],
      having: Sequelize.literal('failures > 3'),
      order: [[Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")), 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      message: 'OTP analytics berhasil diambil',
      data: {
        period: period,
        days: parseInt(days),
        statusDistribution: statusStats.map(stat => ({
          status: stat.status,
          count: parseInt(stat.dataValues.count)
        })),
        timeBasedStats: timeStats.map(stat => ({
          period: stat.dataValues.period,
          total: parseInt(stat.dataValues.total),
          verified: parseInt(stat.dataValues.verified),
          avgAttempts: parseFloat(stat.dataValues.avgAttempts).toFixed(2),
          successRate: stat.dataValues.total > 0 ? 
            ((stat.dataValues.verified / stat.dataValues.total) * 100).toFixed(2) : 0
        })),
        suspiciousActivity: failedPhones.map(phone => ({
          phoneNumber: phone.phoneNumber,
          totalAttempts: parseInt(phone.dataValues.totalAttempts),
          failures: parseInt(phone.dataValues.failures)
        }))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - Export data (CSV format)
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { days = 30 } = req.query;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    let data, filename, headers;

    switch (type) {
      case 'otp':
        data = await OTPLog.findAll({
          where: {
            createdAt: {
              [Op.gte]: dateFrom
            }
          },
          attributes: { exclude: ['otp'] }, // Don't export actual OTP values
          order: [['createdAt', 'DESC']]
        });
        filename = `otp_logs_${new Date().toISOString().split('T')[0]}.csv`;
        headers = ['id', 'sessionId', 'phoneNumber', 'status', 'attempts', 'maxAttempts', 'createdAt', 'expiresAt', 'verifiedAt'];
        break;

      case 'activity':
        data = await ActivityLog.findAll({
          where: {
            createdAt: {
              [Op.gte]: dateFrom
            }
          },
          order: [['createdAt', 'DESC']]
        });
        filename = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
        headers = ['id', 'sessionId', 'action', 'details', 'createdAt'];
        break;

      case 'sessions':
        data = await Session.findAll({
          order: [['createdAt', 'DESC']]
        });
        filename = `sessions_${new Date().toISOString().split('T')[0]}.csv`;
        headers = ['id', 'sessionId', 'phoneNumber', 'status', 'createdAt', 'lastActivity'];
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Type export tidak valid. Gunakan: otp, activity, atau sessions'
        });
    }

    // Convert to CSV
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    });

    const csvData = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 