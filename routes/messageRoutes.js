const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const whatsappService = require('../services/WhatsAppService');

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Daftar mime types yang diizinkan
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/3gp',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe file ${file.mimetype} tidak didukung`), false);
    }
  }
});

// Middleware untuk validasi sessionId
const validateSession = (req, res, next) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID diperlukan'
    });
  }
  
  const session = whatsappService.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session tidak ditemukan'
    });
  }
  
  if (!session.isConnected) {
    return res.status(400).json({
      success: false,
      message: 'Session belum terhubung'
    });
  }
  
  next();
};

// Middleware untuk validasi nomor telepon
const validatePhoneNumber = (req, res, next) => {
  const { to, phone } = req.body;
  const phoneNumber = to || phone;
  
  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Nomor telepon diperlukan (gunakan field "to" atau "phone")'
    });
  }
  
  // Format nomor telepon ke format WhatsApp
  req.body.to = whatsappService.formatPhoneNumber(phoneNumber);
  next();
};

// POST - Kirim pesan teks biasa
router.post('/:sessionId/text', validateSession, validatePhoneNumber, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, message, text } = req.body;
    
    const messageText = message || text;
    if (!messageText) {
      return res.status(400).json({
        success: false,
        message: 'Pesan teks diperlukan (gunakan field "message" atau "text")'
      });
    }
    
    const result = await whatsappService.sendTextMessage(sessionId, to, messageText);
    
    res.json({
      success: true,
      message: 'Pesan teks berhasil dikirim',
      data: {
        sessionId,
        to,
        message: messageText,
        messageId: result.key.id,
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

// POST - Kirim OTP
router.post('/:sessionId/otp', validateSession, validatePhoneNumber, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, otp, length = 6, companyName } = req.body;
    
    // Generate OTP jika tidak disediakan
    const finalOTP = otp || whatsappService.generateOTP(length);
    
    const result = await whatsappService.sendOTPMessage(sessionId, to, finalOTP, companyName);
    
    res.json({
      success: true,
      message: 'OTP berhasil dikirim',
      data: {
        sessionId,
        to,
        otp: finalOTP,
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

// POST - Kirim gambar
router.post('/:sessionId/image', validateSession, validatePhoneNumber, upload.single('image'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, caption = '', imageUrl } = req.body;
    
    let imagePath;
    if (req.file) {
      imagePath = req.file.path;
    } else if (imageUrl) {
      imagePath = imageUrl;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Gambar diperlukan (upload file atau sediakan imageUrl)'
      });
    }
    
    const result = await whatsappService.sendImageMessage(sessionId, to, imagePath, caption);
    
    // Hapus file upload setelah dikirim jika menggunakan upload
    if (req.file) {
      setTimeout(() => {
        fs.remove(imagePath).catch(console.error);
      }, 5000);
    }
    
    res.json({
      success: true,
      message: 'Gambar berhasil dikirim',
      data: {
        sessionId,
        to,
        caption,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Hapus file jika ada error
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Kirim video
router.post('/:sessionId/video', validateSession, validatePhoneNumber, upload.single('video'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, caption = '', videoUrl } = req.body;
    
    let videoPath;
    if (req.file) {
      videoPath = req.file.path;
    } else if (videoUrl) {
      videoPath = videoUrl;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Video diperlukan (upload file atau sediakan videoUrl)'
      });
    }
    
    const result = await whatsappService.sendVideoMessage(sessionId, to, videoPath, caption);
    
    // Hapus file upload setelah dikirim
    if (req.file) {
      setTimeout(() => {
        fs.remove(videoPath).catch(console.error);
      }, 10000);
    }
    
    res.json({
      success: true,
      message: 'Video berhasil dikirim',
      data: {
        sessionId,
        to,
        caption,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Kirim audio
router.post('/:sessionId/audio', validateSession, validatePhoneNumber, upload.single('audio'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, audioUrl } = req.body;
    
    let audioPath;
    if (req.file) {
      audioPath = req.file.path;
    } else if (audioUrl) {
      audioPath = audioUrl;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Audio diperlukan (upload file atau sediakan audioUrl)'
      });
    }
    
    const result = await whatsappService.sendAudioMessage(sessionId, to, audioPath);
    
    // Hapus file upload setelah dikirim
    if (req.file) {
      setTimeout(() => {
        fs.remove(audioPath).catch(console.error);
      }, 10000);
    }
    
    res.json({
      success: true,
      message: 'Audio berhasil dikirim',
      data: {
        sessionId,
        to,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Kirim dokumen
router.post('/:sessionId/document', validateSession, validatePhoneNumber, upload.single('document'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, filename, documentUrl } = req.body;
    
    let documentPath, finalFilename;
    if (req.file) {
      documentPath = req.file.path;
      finalFilename = filename || req.file.originalname;
    } else if (documentUrl) {
      documentPath = documentUrl;
      finalFilename = filename || 'document.pdf';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Dokumen diperlukan (upload file atau sediakan documentUrl)'
      });
    }
    
    const result = await whatsappService.sendDocumentMessage(sessionId, to, documentPath, finalFilename);
    
    // Hapus file upload setelah dikirim
    if (req.file) {
      setTimeout(() => {
        fs.remove(documentPath).catch(console.error);
      }, 10000);
    }
    
    res.json({
      success: true,
      message: 'Dokumen berhasil dikirim',
      data: {
        sessionId,
        to,
        filename: finalFilename,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST - Kirim lokasi
router.post('/:sessionId/location', validateSession, validatePhoneNumber, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, latitude, longitude, locationName = '' } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude dan longitude diperlukan'
      });
    }
    
    const result = await whatsappService.sendLocationMessage(sessionId, to, parseFloat(latitude), parseFloat(longitude), locationName);
    
    res.json({
      success: true,
      message: 'Lokasi berhasil dikirim',
      data: {
        sessionId,
        to,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        locationName,
        messageId: result.key.id,
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

// POST - Kirim pesan dengan button
router.post('/:sessionId/button', validateSession, validatePhoneNumber, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, text, buttons, footer = '' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Teks pesan diperlukan'
      });
    }
    
    if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array buttons diperlukan dan tidak boleh kosong'
      });
    }
    
    if (buttons.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'Maksimal 3 button yang diizinkan'
      });
    }
    
    // Validasi format button
    for (const button of buttons) {
      if (!button.text) {
        return res.status(400).json({
          success: false,
          message: 'Setiap button harus memiliki property "text"'
        });
      }
    }
    
    const result = await whatsappService.sendButtonMessage(sessionId, to, text, buttons, footer);
    
    res.json({
      success: true,
      message: 'Pesan button berhasil dikirim',
      data: {
        sessionId,
        to,
        text,
        buttons,
        footer,
        messageId: result.key.id,
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

// POST - Kirim list message
router.post('/:sessionId/list', validateSession, validatePhoneNumber, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { to, text, buttonText, sections, footer = '' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Teks pesan diperlukan'
      });
    }
    
    if (!buttonText) {
      return res.status(400).json({
        success: false,
        message: 'Button text diperlukan'
      });
    }
    
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array sections diperlukan dan tidak boleh kosong'
      });
    }
    
    // Validasi format sections
    for (const section of sections) {
      if (!section.title || !section.rows || !Array.isArray(section.rows)) {
        return res.status(400).json({
          success: false,
          message: 'Setiap section harus memiliki title dan array rows'
        });
      }
      
      for (const row of section.rows) {
        if (!row.title || !row.rowId) {
          return res.status(400).json({
            success: false,
            message: 'Setiap row harus memiliki title dan rowId'
          });
        }
      }
    }
    
    const result = await whatsappService.sendListMessage(sessionId, to, text, buttonText, sections, footer);
    
    res.json({
      success: true,
      message: 'List message berhasil dikirim',
      data: {
        sessionId,
        to,
        text,
        buttonText,
        sections,
        footer,
        messageId: result.key.id,
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

// GET - Generate OTP tanpa mengirim
router.get('/:sessionId/generate-otp', (req, res) => {
  try {
    const { length = 6 } = req.query;
    const otp = whatsappService.generateOTP(parseInt(length));
    
    res.json({
      success: true,
      message: 'OTP berhasil digenerate',
      data: {
        otp,
        length: parseInt(length),
        timestamp: new Date().toISOString(),
        expiresIn: '5 menit (rekomendasi)'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET - Format nomor telepon
router.get('/format-phone/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const formatted = whatsappService.formatPhoneNumber(phoneNumber);
    
    res.json({
      success: true,
      message: 'Nomor telepon berhasil diformat',
      data: {
        original: phoneNumber,
        formatted: formatted.replace('@s.whatsapp.net', ''),
        whatsappFormat: formatted
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