# AI Chatbot Integration - WhatsApp OTP API

## 🤖 Overview

WhatsApp OTP API sekarang terintegrasi dengan **Google AI Studio** untuk memberikan fitur AI chatbot yang canggih. Sistem ini secara otomatis akan merespons pesan dari nomor tertentu menggunakan AI Gemini dari Google.

## ⚙️ Konfigurasi

### 1. Setup Google AI Studio API Key

1. Kunjungi [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Buat API key baru atau gunakan yang sudah ada
3. Copy API key tersebut

### 2. Environment Variables

Tambahkan konfigurasi berikut ke file `.env`:

```env
# Google AI Studio Configuration
GOOGLE_AI_API_KEY=your_google_ai_studio_api_key_here
GOOGLE_AI_MODEL=gemini-1.5-flash
AI_CHATBOT_PHONE=081220749123
```

**Konfigurasi:**
- `GOOGLE_AI_API_KEY`: API key dari Google AI Studio (WAJIB)
- `GOOGLE_AI_MODEL`: Model yang digunakan (default: gemini-1.5-flash)
- `AI_CHATBOT_PHONE`: Nomor WhatsApp yang akan direspon oleh AI (default: 081220749123)

### 3. Model yang Tersedia

- `gemini-1.5-flash` (Default - Cepat dan efisien)
- `gemini-1.5-pro` (Lebih canggih tapi lebih lambat)
- `gemini-pro` (Versi sebelumnya)

## 🚀 Cara Kerja

### Automatic Response Flow

1. **Pesan Masuk**: User mengirim pesan ke nomor yang dikonfigurasi (081220749123)
2. **Deteksi**: Sistem mendeteksi pesan dari nomor tersebut
3. **AI Processing**: Pesan dikirim ke Google AI Studio
4. **Response**: AI menghasilkan respons dalam Bahasa Indonesia
5. **Reply**: Sistem mengirim balasan otomatis ke user

### Contoh Percakapan

```
User: "Halo, siapa kamu?"
AI: "Halo! Saya adalah AI Assistant yang membantu kamu melalui WhatsApp. Ada yang bisa saya bantu hari ini? 😊"

User: "Jelaskan tentang Indonesia"
AI: "Indonesia adalah negara kepulauan terbesar di dunia dengan lebih dari 17.000 pulau. Terletak di Asia Tenggara dan memiliki keberagaman budaya, bahasa, dan suku yang luar biasa. Ibu kota Indonesia adalah Jakarta. 🇮🇩"
```

## 📊 API Endpoints

### 1. Health Check
```http
GET /api/ai/health
```

**Response:**
```json
{
  "success": true,
  "message": "AI service health check completed",
  "data": {
    "isAvailable": true,
    "apiKeyConfigured": true,
    "model": "gemini-1.5-flash",
    "chatbotPhone": "081220749123"
  }
}
```

### 2. AI Statistics
```http
GET /api/ai/stats
```

**Response:**
```json
{
  "success": true,
  "message": "AI chatbot statistics retrieved successfully",
  "data": {
    "totalConversations": 5,
    "totalMessages": 24,
    "averageMessagesPerConversation": 5,
    "isAvailable": true,
    "chatbotPhone": "081220749123",
    "model": "gemini-1.5-flash"
  }
}
```

### 3. Test AI Response
```http
POST /api/ai/test
Content-Type: application/json

{
  "message": "Halo, apa kabar?",
  "phoneNumber": "628123456789" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI response generated successfully",
  "data": {
    "userMessage": "Halo, apa kabar?",
    "aiResponse": "Halo! Kabar saya baik, terima kasih. Bagaimana dengan kamu? Ada yang bisa saya bantu hari ini? 😊",
    "phoneNumber": "628123456789"
  }
}
```

### 4. Get Conversation History
```http
GET /api/ai/history/{phoneNumber}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation history retrieved successfully",
  "data": {
    "phoneNumber": "628123456789",
    "history": [
      {
        "role": "user",
        "message": "Halo",
        "timestamp": "2024-01-01T10:00:00.000Z"
      },
      {
        "role": "assistant",
        "message": "Halo! Ada yang bisa saya bantu?",
        "timestamp": "2024-01-01T10:00:01.000Z"
      }
    ],
    "totalMessages": 2
  }
}
```

### 5. Clear Conversation History
```http
DELETE /api/ai/history/{phoneNumber}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation history cleared for 628123456789",
  "data": {
    "phoneNumber": "628123456789",
    "cleared": true
  }
}
```

### 6. Clear All History
```http
DELETE /api/ai/history
```

## 🎯 Fitur AI Chatbot

### 1. **Kontekstual Memory**
- AI mengingat percakapan sebelumnya (maksimal 20 pesan terakhir)
- Setiap nomor telepon memiliki history terpisah
- History otomatis dibersihkan untuk menghemat memori

### 2. **Response Style**
- **Bahasa**: Bahasa Indonesia yang natural dan ramah
- **Panjang**: Maksimal 3-4 kalimat per respons
- **Emoji**: Menggunakan emoji untuk membuat percakapan lebih menarik
- **Tone**: Ramah, membantu, dan profesional

### 3. **Error Handling**
- Jika AI tidak tersedia, sistem mengirim pesan fallback
- Log semua error untuk troubleshooting
- Retry otomatis jika terjadi gangguan sementara

### 4. **Logging & Analytics**
- Semua percakapan AI dicatat dalam database
- Tracking statistik penggunaan AI
- Monitor performa dan error rate

## 🔧 Konfigurasi Lanjutan

### Custom AI Prompt

Untuk memodifikasi gaya respons AI, edit file `services/GoogleAIService.js`:

```javascript
const systemPrompt = `Kamu adalah asisten AI yang ramah dan membantu di WhatsApp. 
Karakteristik kamu:
- Berbicara dalam Bahasa Indonesia yang natural dan ramah
- Memberikan jawaban yang jelas dan bermanfaat
- Bisa membantu berbagai topik umum
- Tidak terlalu panjang dalam menjawab (maksimal 3-4 kalimat)
- Gunakan emoji sesekali untuk membuat percakapan lebih menarik
- Jika ditanya tentang identitas, jawab bahwa kamu adalah AI Assistant yang membantu via WhatsApp
// Tambahkan customization lain di sini
`;
```

### Multiple AI Phone Numbers

Untuk menangani multiple nomor AI, modifikasi `services/WhatsAppService.js`:

```javascript
// Array nomor AI chatbot
const aiChatbotPhones = [
  process.env.AI_CHATBOT_PHONE || '081220749123',
  '081220749124',
  '081220749125'
];

// Cek apakah nomor ada dalam array
if (aiChatbotPhones.includes(phoneNumber.replace(/^0/, '62'))) {
  // Process AI chatbot logic
}
```

## 🔍 Monitoring & Troubleshooting

### 1. Check AI Service Status

```bash
curl http://localhost:3000/api/ai/health
```

### 2. View AI Logs

```bash
tail -f logs/ai-service.log
```

### 3. Common Issues

#### API Key Error
```
Error: GOOGLE_AI_API_KEY tidak ditemukan di environment variables
```
**Solution**: Pastikan API key sudah di-set di file `.env`

#### Model Not Found
```
Error: Model gemini-xxx not found
```
**Solution**: Gunakan model yang valid (gemini-1.5-flash, gemini-1.5-pro, dll)

#### Rate Limit Exceeded
```
Error: Rate limit exceeded for API key
```
**Solution**: Tunggu beberapa menit atau upgrade plan Google AI Studio

### 4. Performance Optimization

```javascript
// Cleanup conversation history setiap jam
setInterval(() => {
  GoogleAIService.clearAllHistory();
}, 60 * 60 * 1000);

// Limit jumlah history per user
const MAX_HISTORY_LENGTH = 10; // Kurangi dari 20 ke 10
```

## 📱 Testing

### 1. Manual Testing

1. Buat session WhatsApp dan connect
2. Kirim pesan dari nomor 081220749123 ke nomor yang ter-connect
3. Lihat respons AI secara real-time

### 2. API Testing

```bash
# Test AI response
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Halo, bagaimana caranya kirim OTP?"}'

# Check conversation history
curl http://localhost:3000/api/ai/history/628123456789

# View statistics
curl http://localhost:3000/api/ai/stats
```

## 🔒 Security & Privacy

### 1. **Data Privacy**
- Conversation history disimpan di memory (tidak di database secara permanen)
- History dibersihkan secara berkala
- Tidak ada data sensitif yang dikirim ke Google AI

### 2. **Rate Limiting**
- Google AI Studio memiliki rate limiting
- Implement rate limiting di level aplikasi jika diperlukan

### 3. **API Key Security**
- Jangan commit API key ke repository
- Gunakan environment variables
- Rotate API key secara berkala

## 💡 Use Cases

### 1. **Customer Support**
- Respons otomatis untuk pertanyaan umum
- Information help desk 24/7
- Redirect ke human agent jika diperlukan

### 2. **Information Bot**
- FAQ automation
- Company information
- Product information

### 3. **Personal Assistant**
- Reminder dan scheduling
- Weather information
- General knowledge queries

## 🚀 Future Enhancements

### 1. **Planned Features**
- Voice message support dengan Speech-to-Text
- Image analysis dengan Gemini Vision
- Integration dengan external APIs (weather, news, dll)
- Custom knowledge base integration

### 2. **Advanced Configuration**
- Different AI personalities per phone number
- Time-based responses (working hours)
- Multi-language support
- Integration dengan CRM systems

---

## 📞 Support

Jika mengalami masalah dengan AI chatbot:

1. **Check Configuration**: Pastikan environment variables sudah benar
2. **Check Logs**: Monitor logs untuk error messages
3. **Test API**: Gunakan endpoint test untuk debugging
4. **Check Quota**: Pastikan Google AI Studio quota masih tersedia

**Happy chatting dengan AI! 🤖✨** 