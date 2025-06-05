const express = require('express');
const router = express.Router();
const whatsappService = require('../services/WhatsAppService');

// GET - Test webhook
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint berhasil diakses',
    timestamp: new Date().toISOString()
  });
});

// POST - Receive incoming messages callback
router.post('/incoming-message', (req, res) => {
  try {
    const { sessionId, from, message, messageType, timestamp } = req.body;
    
    // Log pesan masuk
    console.log('Incoming Message:', {
      sessionId,
      from,
      message,
      messageType,
      timestamp
    });
    
    // Di sini Anda bisa menambahkan logic untuk memproses pesan masuk
    // Misalnya: auto-reply, log ke database, dll.
    
    res.json({
      success: true,
      message: 'Pesan masuk berhasil diterima',
      data: {
        sessionId,
        from,
        processed: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Connection status webhook
router.post('/connection-status', (req, res) => {
  try {
    const { sessionId, status, user, timestamp } = req.body;
    
    console.log('Connection Status Update:', {
      sessionId,
      status,
      user,
      timestamp
    });
    
    // Logic untuk handle perubahan status koneksi
    
    res.json({
      success: true,
      message: 'Status koneksi berhasil diterima',
      data: {
        sessionId,
        status,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - Get webhook statistics
router.get('/stats', (req, res) => {
  try {
    const sessions = whatsappService.getAllSessions();
    const stats = {
      totalSessions: Object.keys(sessions).length,
      connectedSessions: Object.values(sessions).filter(s => s.isConnected).length,
      disconnectedSessions: Object.values(sessions).filter(s => !s.isConnected).length,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'Statistik webhook berhasil diambil',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 