const express = require('express');
const router = express.Router();
const whatsappService = require('../services/WhatsAppService');
const { v4: uuidv4 } = require('uuid');

// Middleware untuk validasi sessionId
const validateSessionId = (req, res, next) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID diperlukan'
    });
  }
  next();
};

// CREATE - Buat session baru
router.post('/create', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Generate sessionId jika tidak disediakan
    const finalSessionId = sessionId || `session_${uuidv4()}`;
    
    const session = await whatsappService.createSession(finalSessionId);
    
    res.status(201).json({
      success: true,
      message: 'Session berhasil dibuat',
      data: {
        sessionId: finalSessionId,
        isConnected: session.isConnected,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// READ - Daftar semua sessions
router.get('/', (req, res) => {
  try {
    const sessions = whatsappService.getAllSessions();
    
    res.json({
      success: true,
      message: 'Daftar sessions berhasil diambil',
      data: {
        sessions,
        total: Object.keys(sessions).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// READ - Status session tertentu
router.get('/:sessionId/status', validateSessionId, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session tidak ditemukan'
      });
    }
    
    res.json({
      success: true,
      message: 'Status session berhasil diambil',
      data: {
        sessionId,
        isConnected: session.isConnected,
        user: session.user,
        lastSeen: session.lastSeen
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// READ - QR Code untuk login
router.get('/:sessionId/qr', validateSessionId, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session tidak ditemukan'
      });
    }
    
    if (session.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Session sudah terhubung, QR Code tidak diperlukan'
      });
    }
    
    const qrData = whatsappService.getQRCode(sessionId);
    
    if (!qrData) {
      return res.status(404).json({
        success: false,
        message: 'QR Code belum tersedia atau sudah kedaluwarsa'
      });
    }
    
    res.json({
      success: true,
      message: 'QR Code berhasil diambil',
      data: {
        sessionId,
        qrCode: qrData.qr,
        timestamp: qrData.timestamp,
        instructions: 'Scan QR Code ini dengan aplikasi WhatsApp Anda'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE - Logout dan hapus session
router.delete('/:sessionId', validateSessionId, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session tidak ditemukan'
      });
    }
    
    await whatsappService.removeSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session berhasil dihapus'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// PUT - Restart session
router.put('/:sessionId/restart', validateSessionId, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session tidak ditemukan'
      });
    }
    
    // Hapus session lama
    await whatsappService.removeSession(sessionId);
    
    // Buat session baru dengan ID yang sama
    const newSession = await whatsappService.createSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session berhasil direstart',
      data: {
        sessionId,
        isConnected: newSession.isConnected,
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

// GET - QR Code sebagai HTML page (untuk kemudahan testing)
router.get('/:sessionId/qr-page', validateSessionId, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).send('<h1>Session tidak ditemukan</h1>');
    }
    
    if (session.isConnected) {
      return res.send(`
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2>✅ Session ${sessionId} sudah terhubung</h2>
          <p>User: ${session.user?.name || session.user?.id}</p>
          <button onclick="location.reload()">Refresh</button>
        </div>
      `);
    }
    
    const qrData = whatsappService.getQRCode(sessionId);
    
    if (!qrData) {
      return res.send(`
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h2>⏳ Menunggu QR Code...</h2>
          <p>Session: ${sessionId}</p>
          <button onclick="location.reload()">Refresh</button>
          <script>setTimeout(() => location.reload(), 3000);</script>
        </div>
      `);
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp QR Code - ${sessionId}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px;
            background: #f0f0f0;
          }
          .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .qr-code {
            margin: 20px 0;
            border: 3px solid #25D366;
            border-radius: 10px;
            padding: 10px;
            background: white;
          }
          .instructions {
            color: #666;
            margin: 20px 0;
            line-height: 1.5;
          }
          .session-info {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-size: 14px;
          }
          button {
            background: #25D366;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
          }
          button:hover {
            background: #128C7E;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>📱 WhatsApp QR Code</h2>
          <div class="session-info">
            <strong>Session ID:</strong> ${sessionId}
          </div>
          <div class="qr-code">
            <img src="${qrData.qr}" alt="QR Code" style="width: 250px; height: 250px;">
          </div>
          <div class="instructions">
            <strong>Cara Login:</strong><br>
            1. Buka WhatsApp di ponsel Anda<br>
            2. Tap menu ⋮ atau Settings<br>
            3. Pilih "Linked Devices"<br>
            4. Tap "Link a Device"<br>
            5. Scan QR code di atas
          </div>
          <button onclick="location.reload()">🔄 Refresh</button>
          <button onclick="checkStatus()">✅ Cek Status</button>
        </div>
        
        <script>
          // Auto refresh setiap 10 detik
          setInterval(() => {
            checkStatus();
          }, 10000);
          
          function checkStatus() {
            fetch('/api/sessions/${sessionId}/status')
              .then(response => response.json())
              .then(data => {
                if (data.success && data.data.isConnected) {
                  location.reload();
                }
              });
          }
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});

module.exports = router; 