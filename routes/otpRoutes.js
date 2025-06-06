const express = require('express');
const router = express.Router();
const { OTPLog } = require('../models');
const whatsappService = require('../services/WhatsAppService');

// POST - Verify OTP
router.post('/verify', async (req, res) => {
  try {
    const { phoneNumber, otp, sessionId } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Nomor telepon dan OTP diperlukan'
      });
    }

    // Format phone number
    const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber).replace('@s.whatsapp.net', '');

    // Find valid OTP
    const otpRecord = await OTPLog.getValidOTP(formattedPhone, otp);
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP tidak valid atau sudah kedaluwarsa'
      });
    }

    // Verify OTP
    const verificationResult = otpRecord.verify(otp);
    await otpRecord.save();

    if (verificationResult.success) {
      res.json({
        success: true,
        message: 'OTP berhasil diverifikasi',
        data: {
          phoneNumber: formattedPhone,
          verifiedAt: otpRecord.verifiedAt,
          sessionId: otpRecord.sessionId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: verificationResult.message,
        data: {
          phoneNumber: formattedPhone,
          attempts: otpRecord.attempts,
          maxAttempts: otpRecord.maxAttempts,
          status: otpRecord.status
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - Check OTP status
router.get('/status/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { sessionId } = req.query;

    // Format phone number
    const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber).replace('@s.whatsapp.net', '');

    // Get recent OTP
    const recentOTP = await OTPLog.getRecentOTP(formattedPhone, sessionId);

    if (!recentOTP) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada OTP yang ditemukan untuk nomor ini'
      });
    }

    res.json({
      success: true,
      message: 'Status OTP berhasil diambil',
      data: {
        phoneNumber: formattedPhone,
        status: recentOTP.status,
        expiresAt: recentOTP.expiresAt,
        isExpired: recentOTP.isExpired(),
        canVerify: recentOTP.canVerify(),
        attempts: recentOTP.attempts,
        maxAttempts: recentOTP.maxAttempts,
        createdAt: recentOTP.createdAt,
        verifiedAt: recentOTP.verifiedAt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - Phone number statistics
router.get('/stats/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { days = 7 } = req.query;

    // Format phone number
    const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber).replace('@s.whatsapp.net', '');

    // Get phone stats
    const stats = await OTPLog.getPhoneStats(formattedPhone, parseInt(days));

    // Recent OTPs
    const recentOTPs = await OTPLog.findAll({
      where: { phoneNumber: formattedPhone },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: { exclude: ['otp'] } // Don't expose actual OTP
    });

    res.json({
      success: true,
      message: 'Phone number statistics retrieved',
      data: {
        phoneNumber: formattedPhone,
        days: parseInt(days),
        statistics: stats,
        recentOTPs
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Resend OTP
router.post('/resend', async (req, res) => {
  try {
    const { phoneNumber, sessionId, companyName } = req.body;

    if (!phoneNumber || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Nomor telepon dan session ID diperlukan'
      });
    }

    // Format phone number
    const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber);

    // Check recent OTP (rate limiting)
    const recentOTP = await OTPLog.getRecentOTP(formattedPhone.replace('@s.whatsapp.net', ''));
    
    if (recentOTP && !recentOTP.isExpired()) {
      const waitTime = Math.ceil((recentOTP.expiresAt - new Date()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Tunggu ${waitTime} detik sebelum mengirim OTP lagi`,
        data: {
          waitTime,
          expiresAt: recentOTP.expiresAt
        }
      });
    }

    // Generate new OTP
    const newOTP = whatsappService.generateOTP();
    
    // Send OTP via WhatsApp
    const result = await whatsappService.sendOTPMessage(sessionId, formattedPhone, newOTP, companyName);

    res.json({
      success: true,
      message: 'OTP berhasil dikirim ulang',
      data: {
        phoneNumber: formattedPhone.replace('@s.whatsapp.net', ''),
        sessionId,
        messageId: result.key.id,
        timestamp: new Date().toISOString(),
        expiresIn: '5 menit'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Expire OTP manually
router.post('/expire', async (req, res) => {
  try {
    const { phoneNumber, sessionId } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Nomor telepon diperlukan'
      });
    }

    // Format phone number
    const formattedPhone = whatsappService.formatPhoneNumber(phoneNumber).replace('@s.whatsapp.net', '');

    // Find recent active OTP
    const recentOTP = await OTPLog.getRecentOTP(formattedPhone, sessionId);
    
    if (!recentOTP || recentOTP.status !== 'sent') {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada OTP aktif yang ditemukan'
      });
    }

    // Expire the OTP
    await recentOTP.markExpired();

    res.json({
      success: true,
      message: 'OTP berhasil diexpire',
      data: {
        phoneNumber: formattedPhone,
        otpId: recentOTP.id,
        expiredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 