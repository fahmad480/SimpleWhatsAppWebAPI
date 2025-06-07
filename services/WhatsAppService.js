const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  generateMessageID,
  downloadContentFromMessage,
  jidDecode,
  proto
} = require('@whiskeysockets/baileys');

const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

// Database models
const { Session, ActivityLog, OTPLog } = require('../models');

// Google AI Service
const GoogleAIService = require('./GoogleAIService');

class WhatsAppService {
  constructor() {
    this.sessions = new Map();
    this.qrCodes = new Map();
    this.reconnectAttempts = new Map(); // Track reconnect attempts
    this.reconnectTimeouts = new Map(); // Track active timeouts
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [WA-SERVICE ${level.toUpperCase()}]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/whatsapp-service.log' })
      ]
    });

    // Cleanup expired QR codes every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.cleanupExpiredQRCodes();
    });

    // Cleanup old logs every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldLogs();
    });

    // Expire old OTPs every minute
    cron.schedule('* * * * *', async () => {
      await OTPLog.expireOldOTPs();
    });
  }

  // Log activity to database
  async logActivity(data) {
    try {
      await ActivityLog.logActivity(data);
    } catch (error) {
      this.logger.error('Failed to log activity:', error);
    }
  }

  // Setup socket event handlers (extracted to avoid duplication)
  setupSocketEventHandlers(sock, sessionId, sessionData, saveCreds) {
    // Remove any existing event listeners
    sock.ev.removeAllListeners();
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        const qrCodeString = await QRCode.toDataURL(qr);
        sessionData.qrCode = qrCodeString;
        this.qrCodes.set(sessionId, {
          qr: qrCodeString,
          timestamp: new Date()
        });
        
        // Update database
        await Session.createOrUpdate(sessionId, {
          qrGenerated: new Date(),
          status: 'connecting'
        });

        await this.logActivity({
          sessionId,
          action: 'qr_generate',
          status: 'success'
        });

        this.logger.info(`QR Code generated untuk session ${sessionId}`);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        this.logger.info(`Connection closed untuk session ${sessionId}. Status code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
        
        // Log disconnection
        await this.logActivity({
          sessionId,
          action: 'connection_close',
          status: 'success',
          details: `Status code: ${statusCode}, Reconnecting: ${shouldReconnect}`,
          errorMessage: lastDisconnect?.error?.message
        });

        // Update database
        await Session.createOrUpdate(sessionId, {
          isConnected: false,
          disconnectedAt: new Date(),
          status: shouldReconnect ? 'connecting' : 'inactive',
          errorMessage: lastDisconnect?.error?.message
        });

        // Update session data
        sessionData.isConnected = false;
        sessionData.qrCode = null;
        
        if (shouldReconnect) {
          await this.handleReconnection(sessionId, statusCode, lastDisconnect?.error?.message);
        } else {
          await this.removeSession(sessionId);
        }
      } else if (connection === 'open') {
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts.delete(sessionId);
        this.clearReconnectTimeout(sessionId);
        
        sessionData.isConnected = true;
        sessionData.user = sock.user;
        sessionData.qrCode = null;
        this.qrCodes.delete(sessionId);

        // Update database
        const dbSession = await Session.createOrUpdate(sessionId);
        await dbSession.setConnected(sock.user);

        await this.logActivity({
          sessionId,
          action: 'connection_open',
          status: 'success',
          details: `Connected as ${sock.user?.name || sock.user?.id}`
        });

        this.logger.info(`Session ${sessionId} berhasil terhubung sebagai ${sock.user?.name || sock.user?.id}`);
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.key.fromMe && msg.message) {
        const phoneNumber = msg.key.remoteJid?.split('@')[0];
        const messageText = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          msg.message?.videoMessage?.caption || '';
        
        this.logger.info(`Pesan masuk di session ${sessionId}: ${msg.key.remoteJid} - ${messageText}`);
        
        await this.logActivity({
          sessionId,
          action: 'message_receive',
          phoneNumber: phoneNumber,
          messageId: msg.key.id,
          status: 'success',
          details: messageText.substring(0, 100)
        });

        // Cek apakah pesan dari nomor AI chatbot
        const aiChatbotPhone = process.env.AI_CHATBOT_PHONE || '081220749123';
        if (phoneNumber === aiChatbotPhone.replace(/^0/, '62')) {
          try {
            this.logger.info(`Processing AI chatbot message from ${phoneNumber}: ${messageText}`);
            
            // Generate respons AI
            const aiResponse = await GoogleAIService.generateResponse(phoneNumber, messageText);
            
            // Kirim balasan AI
            await this.sendTextMessage(sessionId, msg.key.remoteJid, aiResponse);
            
            await this.logActivity({
              sessionId,
              action: 'ai_chatbot_response',
              phoneNumber: phoneNumber,
              messageId: msg.key.id,
              status: 'success',
              details: `User: ${messageText.substring(0, 50)} | AI: ${aiResponse.substring(0, 50)}`,
              responseData: { originalMessage: messageText, aiResponse }
            });

            this.logger.info(`AI chatbot response sent to ${phoneNumber}`);
            
          } catch (error) {
            this.logger.error(`Error processing AI chatbot message from ${phoneNumber}:`, error);
            
            await this.logActivity({
              sessionId,
              action: 'ai_chatbot_response',
              phoneNumber: phoneNumber,
              messageId: msg.key.id,
              status: 'error',
              errorMessage: error.message,
              details: `Failed to process: ${messageText.substring(0, 50)}`
            });

            // Kirim pesan error yang ramah
            try {
              await this.sendTextMessage(sessionId, msg.key.remoteJid, 
                'Maaf, saya sedang mengalami gangguan. Coba kirim pesan lagi dalam beberapa menit ya! 🤖');
            } catch (sendError) {
              this.logger.error(`Failed to send error message to ${phoneNumber}:`, sendError);
            }
          }
        }
      }
    });
  }

  // Handle reconnection with retry limit
  async handleReconnection(sessionId, statusCode, errorMessage) {
    const maxRetries = 5;
    const currentAttempts = this.reconnectAttempts.get(sessionId) || 0;
    
    if (currentAttempts >= maxRetries) {
      this.logger.error(`Max reconnection attempts reached for session ${sessionId}, removing session`);
      await this.removeSession(sessionId);
      return;
    }

    // Clear any existing timeout
    this.clearReconnectTimeout(sessionId);
    
    // Calculate delay with exponential backoff
    const baseDelay = 3000; // 3 seconds
    const delay = baseDelay * Math.pow(2, currentAttempts); // 3s, 6s, 12s, 24s, 48s
    
    this.logger.info(`Scheduling reconnection for session ${sessionId} in ${delay}ms (attempt ${currentAttempts + 1}/${maxRetries})`);
    
    // Update reconnect attempts
    this.reconnectAttempts.set(sessionId, currentAttempts + 1);
    
    // Set timeout for reconnection
    const timeoutId = setTimeout(async () => {
      try {
        // Check if session still exists and needs reconnection
        const session = this.sessions.get(sessionId);
        if (!session || session.isConnected) {
          this.logger.info(`Session ${sessionId} no longer needs reconnection`);
          this.reconnectAttempts.delete(sessionId);
          return;
        }

        this.logger.info(`Attempting reconnection for session ${sessionId} (attempt ${currentAttempts + 1})`);
        
        // Special handling for stream error 515 (post-pairing restart)
        if (statusCode === 515 || errorMessage?.includes('Stream Errored')) {
          await this.reconnectSession(sessionId);
        } else {
          // For other errors, recreate session completely
          await this.recreateSession(sessionId);
        }
      } catch (error) {
        this.logger.error(`Error during reconnection attempt for session ${sessionId}:`, error);
        
        // If reconnection fails, try again or give up
        if (currentAttempts < maxRetries - 1) {
          await this.handleReconnection(sessionId, statusCode, errorMessage);
        } else {
          this.logger.error(`All reconnection attempts failed for session ${sessionId}, removing session`);
          await this.removeSession(sessionId);
        }
      }
    }, delay);
    
    this.reconnectTimeouts.set(sessionId, timeoutId);
  }

  // Clear reconnect timeout
  clearReconnectTimeout(sessionId) {
    const timeoutId = this.reconnectTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.reconnectTimeouts.delete(sessionId);
    }
  }

  // Create new WhatsApp session
  async createSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} sudah ada`);
    }

    try {
      // Clear any existing reconnection data
      this.reconnectAttempts.delete(sessionId);
      this.clearReconnectTimeout(sessionId);

      // Create or update session in database
      await Session.createOrUpdate(sessionId, {
        status: 'connecting'
      });

      await this.logActivity({
        sessionId,
        action: 'session_create',
        status: 'success'
      });

      const sessionPath = path.join('sessions', sessionId);
      await fs.ensureDir(sessionPath);

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version, isLatest } = await fetchLatestBaileysVersion();

      this.logger.info(`Menggunakan WA v${version.join('.')}, isLatest: ${isLatest}`);

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp OTP API', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
      });

      const sessionData = {
        socket: sock,
        sessionId,
        isConnected: false,
        qrCode: null,
        user: null,
        lastSeen: new Date()
      };

      this.sessions.set(sessionId, sessionData);

      // Setup event handlers
      this.setupSocketEventHandlers(sock, sessionId, sessionData, saveCreds);

      return sessionData;
    } catch (error) {
      this.logger.error(`Error membuat session ${sessionId}:`, error);
      
      await this.logActivity({
        sessionId,
        action: 'session_create',
        status: 'error',
        errorMessage: error.message
      });

      throw error;
    }
  }

  // Create or recreate session (for reconnection)
  async recreateSession(sessionId) {
    try {
      // Clear reconnection data
      this.reconnectAttempts.delete(sessionId);
      this.clearReconnectTimeout(sessionId);

      // Clean up existing session
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        if (session.socket) {
          try {
            // Remove event listeners before logout
            session.socket.ev.removeAllListeners();
            await session.socket.logout();
          } catch (e) {
            // Ignore logout errors
            this.logger.warn(`Logout error during recreate for session ${sessionId}:`, e.message);
          }
        }
        this.sessions.delete(sessionId);
        this.qrCodes.delete(sessionId);
      }

      // Buat session baru
      return await this.createSession(sessionId);
    } catch (error) {
      this.logger.error(`Error recreating session ${sessionId}:`, error);
      throw error;
    }
  }

  // Reconnect session without removing session data (for post-pairing restart)
  async reconnectSession(sessionId) {
    try {
      const sessionPath = path.join('sessions', sessionId);
      
      // Pastikan session path masih ada
      if (!await fs.pathExists(sessionPath)) {
        this.logger.warn(`Session path tidak ditemukan untuk ${sessionId}, membuat session baru`);
        return await this.createSession(sessionId);
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const { version, isLatest } = await fetchLatestBaileysVersion();

      this.logger.info(`Reconnecting session ${sessionId} menggunakan WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Clean up old socket if exists
      const existingSession = this.sessions.get(sessionId);
      if (existingSession && existingSession.socket) {
        try {
          existingSession.socket.ev.removeAllListeners();
          await existingSession.socket.logout();
        } catch (e) {
          this.logger.warn(`Error cleaning up old socket for session ${sessionId}:`, e.message);
        }
      }

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp OTP API', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
      });

      // Update or create session data
      const sessionData = this.sessions.get(sessionId) || {
        sessionId,
        isConnected: false,
        qrCode: null,
        user: null,
        lastSeen: new Date()
      };

      sessionData.socket = sock;
      sessionData.isConnected = false;
      sessionData.lastSeen = new Date();

      this.sessions.set(sessionId, sessionData);

      // Setup event handlers
      this.setupSocketEventHandlers(sock, sessionId, sessionData, saveCreds);

      return sessionData;
    } catch (error) {
      this.logger.error(`Error reconnecting session ${sessionId}:`, error);
      // Fallback ke create session baru jika reconnect gagal
      return await this.createSession(sessionId);
    }
  }

  // Restart session with proper validation
  async restartSession(sessionId) {
    try {
      this.logger.info(`Restarting session ${sessionId}`);
      
      // Check if session exists
      const sessionPath = path.join('sessions', sessionId);
      const hasSessionFiles = await fs.pathExists(sessionPath);
      
      if (!hasSessionFiles) {
        this.logger.warn(`No session files found for ${sessionId}, creating new session`);
        return await this.createSession(sessionId);
      }
      
      // Remove existing session if any
      if (this.sessions.has(sessionId)) {
        await this.removeSession(sessionId);
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Create new session using existing files
      return await this.createSession(sessionId);
      
    } catch (error) {
      this.logger.error(`Error restarting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get session info
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Get all sessions
  getAllSessions() {
    const sessions = {};
    for (const [id, session] of this.sessions) {
      sessions[id] = {
        sessionId: id,
        isConnected: session.isConnected,
        user: session.user,
        lastSeen: session.lastSeen
      };
    }
    return sessions;
  }

  // Remove session
  async removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear reconnection data
      this.reconnectAttempts.delete(sessionId);
      this.clearReconnectTimeout(sessionId);
      
      if (session.socket) {
        try {
          // Remove event listeners before logout
          session.socket.ev.removeAllListeners();
          await session.socket.logout();
        } catch (error) {
          // Ignore logout errors, socket mungkin sudah tidak valid
          this.logger.info(`Logout error untuk session ${sessionId} (ignored):`, error.message);
        }
      }
      this.sessions.delete(sessionId);
      this.qrCodes.delete(sessionId);
      
      // Update database
      await Session.createOrUpdate(sessionId, {
        isConnected: false,
        status: 'inactive',
        disconnectedAt: new Date()
      });

      await this.logActivity({
        sessionId,
        action: 'session_delete',
        status: 'success'
      });
      
      // Remove session files
      try {
        const sessionPath = path.join('sessions', sessionId);
        await fs.remove(sessionPath);
      } catch (error) {
        this.logger.warn(`Error removing session files for ${sessionId}:`, error.message);
      }
      
      this.logger.info(`Session ${sessionId} dihapus`);
    }
  }

  // Get QR code
  getQRCode(sessionId) {
    return this.qrCodes.get(sessionId);
  }

  // Send text message
  async sendTextMessage(sessionId, to, text) {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const result = await session.socket.sendMessage(to, { text });
      
      await this.logActivity({
        sessionId,
        action: 'message_send',
        messageType: 'text',
        phoneNumber: to.replace('@s.whatsapp.net', ''),
        messageId: result.key.id,
        status: 'success',
        responseData: { messageId: result.key.id }
      });

      this.logger.info(`Pesan teks terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      await this.logActivity({
        sessionId,
        action: 'message_send',
        messageType: 'text',
        phoneNumber: to.replace('@s.whatsapp.net', ''),
        status: 'error',
        errorMessage: error.message
      });

      this.logger.error(`Error mengirim pesan teks:`, error);
      throw error;
    }
  }

  // Send OTP message with template
  async sendOTPMessage(sessionId, to, otp, companyName = 'WhatsApp OTP API') {
    const otpMessage = `🔐 *Kode OTP Anda*

Kode OTP: *${otp}*

Kode ini akan kedaluwarsa dalam 5 menit.
Jangan bagikan kode ini kepada siapapun.

Terima kasih,
${companyName}`;

    try {
      const result = await this.sendTextMessage(sessionId, to, otpMessage);
      
      // Save OTP to database
      await OTPLog.createOTP({
        sessionId,
        phoneNumber: to.replace('@s.whatsapp.net', ''),
        otp,
        messageId: result.key.id,
        companyName
      });

      await this.logActivity({
        sessionId,
        action: 'otp_send',
        messageType: 'otp',
        phoneNumber: to.replace('@s.whatsapp.net', ''),
        messageId: result.key.id,
        status: 'success',
        details: `OTP sent to ${to}`,
        responseData: { messageId: result.key.id }
      });

      return result;
    } catch (error) {
      await this.logActivity({
        sessionId,
        action: 'otp_send',
        messageType: 'otp',
        phoneNumber: to.replace('@s.whatsapp.net', ''),
        status: 'error',
        errorMessage: error.message
      });
      throw error;
    }
  }

  // Send image message
  async sendImageMessage(sessionId, to, imagePath, caption = '') {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const result = await session.socket.sendMessage(to, {
        image: { url: imagePath },
        caption
      });
      this.logger.info(`Gambar terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim gambar:`, error);
      throw error;
    }
  }

  // Send video message
  async sendVideoMessage(sessionId, to, videoPath, caption = '') {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const result = await session.socket.sendMessage(to, {
        video: { url: videoPath },
        caption
      });
      this.logger.info(`Video terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim video:`, error);
      throw error;
    }
  }

  // Send audio message
  async sendAudioMessage(sessionId, to, audioPath) {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const result = await session.socket.sendMessage(to, {
        audio: { url: audioPath },
        mimetype: 'audio/mpeg'
      });
      this.logger.info(`Audio terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim audio:`, error);
      throw error;
    }
  }

  // Send document message
  async sendDocumentMessage(sessionId, to, documentPath, filename) {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const result = await session.socket.sendMessage(to, {
        document: { url: documentPath },
        fileName: filename,
        mimetype: 'application/pdf'
      });
      this.logger.info(`Dokumen terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim dokumen:`, error);
      throw error;
    }
  }

  // Send location message
  async sendLocationMessage(sessionId, to, latitude, longitude, locationName = '') {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const result = await session.socket.sendMessage(to, {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          name: locationName
        }
      });
      this.logger.info(`Lokasi terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim lokasi:`, error);
      throw error;
    }
  }

  // Send button message
  async sendButtonMessage(sessionId, to, text, buttons, footer = '') {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const buttonMessage = {
        text,
        footer,
        buttons: buttons.map((btn, index) => ({
          buttonId: `btn_${index + 1}`,
          buttonText: { displayText: btn.text },
          type: 1
        })),
        headerType: 1
      };

      const result = await session.socket.sendMessage(to, buttonMessage);
      this.logger.info(`Pesan button terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim button message:`, error);
      throw error;
    }
  }

  // Send list message
  async sendListMessage(sessionId, to, text, buttonText, sections, footer = '') {
    const session = this.getSession(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} tidak terhubung`);
    }

    try {
      const listMessage = {
        text,
        footer,
        title: text,
        buttonText,
        sections
      };

      const result = await session.socket.sendMessage(to, listMessage);
      this.logger.info(`List message terkirim dari session ${sessionId} ke ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error mengirim list message:`, error);
      throw error;
    }
  }

  // Format phone number to WhatsApp format
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('62') && cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    return cleaned + '@s.whatsapp.net';
  }

  // Generate OTP
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  // Cleanup expired QR codes
  cleanupExpiredQRCodes() {
    const now = new Date();
    for (const [sessionId, qrData] of this.qrCodes) {
      const timeDiff = now - qrData.timestamp;
      // Remove QR codes older than 2 minutes
      if (timeDiff > 2 * 60 * 1000) {
        this.qrCodes.delete(sessionId);
        this.logger.info(`QR Code expired untuk session ${sessionId}`);
      }
    }
  }

  // Get all sessions from database
  async getAllSessionsFromDB() {
    try {
      const dbSessions = await Session.findAll({
        order: [['updatedAt', 'DESC']]
      });

      const sessions = {};
      for (const dbSession of dbSessions) {
        const memorySession = this.sessions.get(dbSession.sessionId);
        sessions[dbSession.sessionId] = {
          sessionId: dbSession.sessionId,
          isConnected: memorySession?.isConnected || false,
          user: memorySession?.user || {
            id: dbSession.userId,
            name: dbSession.userName
          },
          lastSeen: dbSession.lastSeen,
          status: dbSession.status,
          connectedAt: dbSession.connectedAt,
          disconnectedAt: dbSession.disconnectedAt,
          qrGenerated: dbSession.qrGenerated
        };
      }

      return sessions;
    } catch (error) {
      this.logger.error('Error getting sessions from database:', error);
      return this.getAllSessions(); // Fallback to memory
    }
  }

  // Cleanup old logs
  async cleanupOldLogs() {
    try {
      const activityDeleted = await ActivityLog.cleanup(30); // 30 days
      const otpDeleted = await OTPLog.cleanup(7); // 7 days
      
      this.logger.info(`Cleanup completed: ${activityDeleted} activity logs, ${otpDeleted} OTP logs deleted`);
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  // Get session statistics
  async getSessionStats(sessionId) {
    try {
      const session = await Session.getBySessionId(sessionId);
      if (!session) return null;

      const messageStats = await ActivityLog.getMessageStats(sessionId);
      const otpStats = await OTPLog.getPhoneStats(session.userPhone);
      
      return {
        session: {
          sessionId: session.sessionId,
          userId: session.userId,
          userName: session.userName,
          userPhone: session.userPhone,
          isConnected: session.isConnected,
          status: session.status,
          connectedAt: session.connectedAt,
          lastSeen: session.lastSeen
        },
        messageStats,
        otpStats
      };
    } catch (error) {
      this.logger.error('Error getting session stats:', error);
      return null;
    }
  }
}

module.exports = new WhatsAppService(); 