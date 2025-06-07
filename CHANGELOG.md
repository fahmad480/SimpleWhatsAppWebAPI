# Changelog - WhatsApp OTP API

## [1.3.0] - 2024-06-07

### 🤖 Added - AI Chatbot Integration
- **NEW**: Integrasi dengan Google AI Studio untuk fitur AI chatbot
- **NEW**: Respons otomatis untuk pesan dari nomor tertentu (081220749123)
- **NEW**: Conversation history management per nomor telepon
- **NEW**: AI statistics dan monitoring
- **NEW**: Fallback responses jika AI tidak tersedia
- **NEW**: Endpoint manajemen AI chatbot (`/api/ai/*`)

### ⚙️ Configuration
- Tambah environment variables untuk Google AI Studio:
  - `GOOGLE_AI_API_KEY`: API key dari Google AI Studio
  - `GOOGLE_AI_MODEL`: Model AI yang digunakan (default: gemini-1.5-flash)
  - `AI_CHATBOT_PHONE`: Nomor WhatsApp untuk AI chatbot (default: 081220749123)

### 📊 New API Endpoints
- `GET /api/ai/health` - Health check AI service
- `GET /api/ai/stats` - Statistik penggunaan AI chatbot
- `POST /api/ai/test` - Test manual AI response
- `GET /api/ai/history/{phoneNumber}` - Ambil history percakapan
- `DELETE /api/ai/history/{phoneNumber}` - Hapus history spesifik nomor
- `DELETE /api/ai/history` - Hapus semua history

### 🔧 Features
- **Contextual Memory**: AI mengingat 20 percakapan terakhir per nomor
- **Multi-language**: Mendukung Bahasa Indonesia natural
- **Error Handling**: Fallback responses jika Google AI error
- **Logging**: Lengkap dengan activity logging untuk semua interaksi AI
- **Performance**: Optimized dengan history cleanup otomatis

### 📁 New Files
- `services/GoogleAIService.js` - Core AI service logic
- `routes/aiChatbotRoutes.js` - AI chatbot API endpoints  
- `examples/ai-chatbot-test.js` - Testing script untuk AI chatbot
- `docs/AI_CHATBOT_GUIDE.md` - Dokumentasi lengkap AI chatbot

### 🔄 Modified Files
- `services/WhatsAppService.js` - Tambah AI processing untuk pesan masuk
- `index.js` - Integrasi route AI chatbot
- `README.md` - Update dokumentasi dengan fitur AI
- `config/env.example` - Tambah konfigurasi Google AI Studio

---

## [1.2.0] - 2024-06-06

### 🗄️ Added - Database Integration
- **NEW**: SQLite database integration (default)
- **NEW**: MySQL database support
- **NEW**: Session persistence across server restarts
- **NEW**: Activity logging dengan Sequelize ORM
- **NEW**: OTP tracking dan verification system
- **NEW**: Analytics dashboard dan monitoring

### 📊 Database Models
- `Session` - Menyimpan status dan info WhatsApp sessions
- `ActivityLog` - Log semua aktivitas API dan pesan
- `OTPLog` - Tracking OTP yang dikirim dan diverifikasi

### 🔧 Features
- **Auto-migration**: Database schema otomatis dibuat saat startup
- **Health monitoring**: Endpoint untuk cek status database
- **Data cleanup**: Otomatis hapus data lama
- **Statistics**: Real-time analytics untuk usage tracking
- **Error tracking**: Comprehensive error logging

### 📁 New Files
- `config/database.js` - Database configuration dan connection
- `models/` - Sequelize models (Session, ActivityLog, OTPLog)
- `routes/analyticsRoutes.js` - Analytics API endpoints
- `routes/otpRoutes.js` - OTP management endpoints
- `docs/DATABASE_INTEGRATION.md` - Database setup guide

---

## [1.1.0] - 2024-06-05

### ⚡ Enhanced
- **Improved**: Error handling dan reconnection logic
- **Added**: File upload validation dan cleanup
- **Enhanced**: Logging system dengan Winston
- **Added**: Health check endpoint
- **Improved**: Session management

### 🐛 Fixed
- Fixed QR code expiration issues
- Improved WhatsApp connection stability
- Better error messages untuk API responses

---

## [1.0.0] - 2024-06-04

### 🎉 Initial Release
- ✅ Multi-session WhatsApp support
- ✅ Send OTP automatically
- ✅ Send text messages
- ✅ Send images with caption
- ✅ Send videos with caption
- ✅ Send audio/voice notes
- ✅ Send documents/files
- ✅ Send location
- ✅ QR Code for WhatsApp login
- ✅ Auto reconnect
- ✅ File upload support
- ✅ Complete logging

### 📁 Core Files
- `index.js` - Main server
- `services/WhatsAppService.js` - Core WhatsApp logic
- `routes/` - API endpoints
- `examples/test-api.js` - Testing script
- Complete documentation

### 📦 Features
- ✅ Multi-session management
- ✅ OTP generation and sending
- ✅ File upload support (50MB limit)
- ✅ Auto reconnect
- ✅ Health check endpoints
- ✅ Error handling
- ✅ Rate limiting ready
- ✅ Production ready

### 🔗 API Endpoints
- Session management (7 endpoints)
- Message sending (7 endpoints)  
- Utility endpoints (3 endpoints)
- Webhook support

### 📚 Documentation
- README.md - Complete documentation
- INTEGRATION_GUIDE.md - Integration guide
- Examples and testing scripts 