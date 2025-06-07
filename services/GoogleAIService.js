const { GoogleGenerativeAI } = require('@google/generative-ai');
const winston = require('winston');

class GoogleAIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.modelName = process.env.GOOGLE_AI_MODEL || 'gemini-1.5-flash';
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY tidak ditemukan di environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [AI-SERVICE ${level.toUpperCase()}]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/ai-service.log' })
      ]
    });

    // Conversation history untuk setiap nomor telepon
    this.conversationHistory = new Map();
    
    this.logger.info('Google AI Service initialized successfully');
  }

  // Generate respons AI berdasarkan pesan pengguna
  async generateResponse(phoneNumber, userMessage) {
    try {
      this.logger.info(`Generating AI response for ${phoneNumber}: ${userMessage}`);
      
      // Dapatkan atau buat history percakapan
      let history = this.conversationHistory.get(phoneNumber) || [];
      
      // Sistem prompt untuk WhatsApp chatbot
      const systemPrompt = `Kamu adalah asisten AI yang ramah dan membantu di WhatsApp. 
      Karakteristik kamu:
      - Berbicara dalam Bahasa Indonesia yang natural dan ramah
      - Memberikan jawaban yang jelas dan bermanfaat
      - Bisa membantu berbagai topik umum
      - Tidak terlalu panjang dalam menjawab (maksimal 3-4 kalimat)
      - Gunakan emoji sesekali untuk membuat percakapan lebih menarik
      - Jika ditanya tentang identitas, jawab bahwa kamu adalah AI Assistant yang membantu via WhatsApp
      
      Percakapan sebelumnya:
      ${history.map(h => `${h.role}: ${h.message}`).join('\n')}
      
      Pesan pengguna: ${userMessage}
      
      Berikan respon yang sesuai:`;

      // Generate respons dari Google AI
      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const aiResponse = response.text();

      // Simpan ke history
      history.push({ role: 'user', message: userMessage, timestamp: new Date() });
      history.push({ role: 'assistant', message: aiResponse, timestamp: new Date() });
      
      // Batasi history maksimal 20 pesan terakhir
      if (history.length > 20) {
        history = history.slice(-20);
      }
      
      this.conversationHistory.set(phoneNumber, history);

      this.logger.info(`AI response generated for ${phoneNumber}: ${aiResponse.substring(0, 100)}...`);
      return aiResponse;

    } catch (error) {
      this.logger.error(`Error generating AI response for ${phoneNumber}:`, error);
      
      // Fallback response jika AI error
      const fallbackResponses = [
        'Maaf, saya sedang mengalami gangguan teknis. Coba tanya lagi dalam beberapa menit ya! 😅',
        'Oops! Ada masalah dengan sistem AI saya. Mohon tunggu sebentar dan coba lagi 🤖',
        'Maaf, saya tidak bisa merespons saat ini. Silakan coba lagi nanti ya! 🙏'
      ];
      
      return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
  }

  // Hapus history percakapan untuk nomor tertentu
  clearHistory(phoneNumber) {
    this.conversationHistory.delete(phoneNumber);
    this.logger.info(`Conversation history cleared for ${phoneNumber}`);
  }

  // Dapatkan history percakapan
  getHistory(phoneNumber) {
    return this.conversationHistory.get(phoneNumber) || [];
  }

  // Cek apakah AI service tersedia
  isAvailable() {
    return !!this.apiKey && !!this.model;
  }

  // Reset semua history (untuk maintenance)
  clearAllHistory() {
    this.conversationHistory.clear();
    this.logger.info('All conversation history cleared');
  }

  // Dapatkan statistik penggunaan
  getStats() {
    const totalConversations = this.conversationHistory.size;
    let totalMessages = 0;
    
    for (const history of this.conversationHistory.values()) {
      totalMessages += history.length;
    }
    
    return {
      totalConversations,
      totalMessages,
      averageMessagesPerConversation: totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0
    };
  }
}

module.exports = new GoogleAIService(); 