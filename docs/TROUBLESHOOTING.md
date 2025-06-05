# Troubleshooting Guide - WhatsApp OTP API

## 🔧 Masalah Umum dan Solusi

### 1. QR Code Timeout / Scan QR Code Selalu Restart

**Error:**
```
Error: QR refs attempts ended
Error: Session abc sudah ada
pairing configured successfully, expect to restart the connection...
stream errored out - code 515
Connection closed untuk session abc. Reconnecting: true
```

**Penyebab:**
- Setelah QR code di-scan, WhatsApp memerlukan restart connection
- Sistem lama menghapus session data saat restart, sehingga pairing hilang
- User harus scan QR code berulang kali

**Solusi:**
✅ **Sudah Diperbaiki** - Versi terbaru menangani restart dengan smart handling:

**Perbaikan yang Diterapkan:**
1. **Smart Reconnection**: Sistem membedakan antara restart setelah pairing vs error normal
2. **Preserve Session Data**: Data pairing tidak dihapus saat restart diperlukan
3. **Graceful Recovery**: Fallback ke method lama jika smart reconnection gagal

**Cara Kerja Baru:**
```
1. User scan QR code ✅
2. Pairing berhasil ✅
3. WhatsApp minta restart (stream error 515) ✅
4. Sistem restart tanpa hapus session data ✅
5. Koneksi berhasil tanpa scan ulang ✅
```

**Manual Fix jika masih terjadi:**
```bash
# 1. Restart session yang bermasalah
curl -X PUT http://localhost:3000/api/sessions/test-session/restart

# 2. Atau hapus dan buat ulang
curl -X DELETE http://localhost:3000/api/sessions/test-session
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session"}'
```

**Tips Sukses Login:**
- ⏰ Scan QR code dalam 2 menit setelah muncul
- 📱 Pastikan koneksi internet HP stabil
- 🔄 Jika gagal, tunggu 30 detik sebelum coba lagi
- 📊 Monitor log untuk melihat progress

### 2. Session Tidak Terhubung

**Error:**
```
{"success":false,"message":"Session tidak terhubung"}
```

**Solusi:**
```bash
# 1. Cek status session
curl http://localhost:3000/api/sessions/your-session/status

# 2. Jika belum connected, ambil QR code baru
curl http://localhost:3000/api/sessions/your-session/qr

# 3. Atau buka di browser
# http://localhost:3000/api/sessions/your-session/qr-page
```

### 3. File Upload Error

**Error:**
```
Error: Tipe file image/svg+xml tidak didukung
```

**Solusi:**
File types yang didukung:
- **Images:** JPEG, JPG, PNG, GIF, WebP
- **Videos:** MP4, AVI, MOV, WMV, 3GP  
- **Audio:** MP3, WAV, OGG, M4A, MPEG
- **Documents:** PDF, DOC, DOCX, XLS, XLSX, TXT, CSV

### 4. Nomor Telepon Invalid

**Error:**
```
{"success":false,"message":"Nomor telepon diperlukan"}
```

**Solusi:**
```javascript
// Format yang benar:
"to": "08123456789"   // ✅
"to": "8123456789"    // ✅  
"to": "628123456789"  // ✅

// Format yang salah:
"to": "+628123456789" // ❌
"to": "081-234-56789" // ❌
```

### 5. OTP Tidak Terkirim

**Kemungkinan Penyebab:**
1. Session belum terhubung
2. Nomor telepon tidak terdaftar di WhatsApp
3. Rate limiting dari WhatsApp

**Solusi:**
```bash
# 1. Cek status session dulu
curl http://localhost:3000/api/sessions/your-session/status

# 2. Pastikan nomor format Indonesia
curl http://localhost:3000/api/messages/format-phone/08123456789

# 3. Test dengan nomor Anda sendiri dulu
curl -X POST http://localhost:3000/api/messages/your-session/text \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your_number",
    "message": "Test message"
  }'
```

### 6. Server Memory Tinggi

**Penyebab:**
- Terlalu banyak session aktif
- File upload tidak terbersihkan

**Solusi:**
```bash
# 1. Lihat semua session aktif
curl http://localhost:3000/api/sessions

# 2. Hapus session yang tidak perlu
curl -X DELETE http://localhost:3000/api/sessions/old-session

# 3. Restart server secara berkala
npm run restart
```

### 7. WhatsApp Web Logout

**Error:**
```
Connection closed. Reconnecting: false
```

**Penyebab:**
- Akun WhatsApp di-logout dari web
- Device pairing di-revoke

**Solusi:**
```bash
# 1. Session otomatis akan dihapus
# 2. Buat session baru
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "new-session"}'

# 3. Scan QR code ulang
```

## 🚀 Best Practices untuk Production

### 1. Session Management
```javascript
// Implementasi health check untuk sessions
const checkAllSessions = async () => {
  const sessions = await fetch('http://localhost:3000/api/sessions');
  const data = await sessions.json();
  
  for (const [sessionId, session] of Object.entries(data.data.sessions)) {
    if (!session.isConnected) {
      console.log(`⚠️ Session ${sessionId} disconnected`);
      // Auto restart atau notifikasi
    }
  }
};

// Jalankan setiap 5 menit
setInterval(checkAllSessions, 5 * 60 * 1000);
```

### 2. Error Handling
```javascript
const sendOTPWithRetry = async (sessionId, phoneNumber, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`http://localhost:3000/api/messages/${sessionId}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber })
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result;
      }
      
      // Jika session tidak terhubung, coba restart
      if (result.message.includes('tidak terhubung')) {
        await fetch(`http://localhost:3000/api/sessions/${sessionId}/restart`, {
          method: 'PUT'
        });
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};
```

### 3. Rate Limiting
```javascript
// Simple rate limiting
const rateLimiter = new Map();

const canSendOTP = (phoneNumber) => {
  const now = Date.now();
  const lastSent = rateLimiter.get(phoneNumber) || 0;
  
  // 1 OTP per 60 detik per nomor
  if (now - lastSent < 60000) {
    return false;
  }
  
  rateLimiter.set(phoneNumber, now);
  return true;
};
```

### 4. Monitoring & Alerts
```javascript
// Setup monitoring
const monitor = {
  totalOTPSent: 0,
  failedRequests: 0,
  activeSessions: 0
};

// Log metrics setiap jam
setInterval(() => {
  console.log('📊 Metrics:', monitor);
  
  // Alert jika failure rate tinggi
  const failureRate = monitor.failedRequests / monitor.totalOTPSent;
  if (failureRate > 0.1) { // 10% failure rate
    console.log('🚨 High failure rate detected!');
    // Send notification
  }
}, 60 * 60 * 1000);
```

## 📞 Support

Jika masih mengalami masalah:

1. **Check Logs:**
   ```bash
   tail -f logs/app.log
   tail -f logs/whatsapp-service.log
   ```

2. **Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/webhook/stats
   ```

3. **Test Connection:**
   ```bash
   # Test basic connectivity
   curl http://localhost:3000/
   
   # Test session creation
   curl -X POST http://localhost:3000/api/sessions/create \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "debug-session"}'
   ```

4. **Environment Check:**
   - Node.js version: `node --version` (recommended: v16+)
   - NPM version: `npm --version`
   - Available memory: Check system resources
   - Network connectivity: Pastikan bisa akses internet

---

**💡 Tips:** Selalu monitor log aplikasi untuk debug masalah lebih lanjut! 