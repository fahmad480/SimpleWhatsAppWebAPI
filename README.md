# WhatsApp OTP API

REST API untuk mengirim OTP dan berbagai jenis pesan melalui WhatsApp menggunakan library [Baileys](https://github.com/WhiskeySockets/Baileys).

## 🚀 Fitur

- ✅ Multi-session WhatsApp support
- ✅ Kirim OTP otomatis
- ✅ Kirim pesan teks
- ✅ Kirim gambar dengan caption
- ✅ Kirim video dengan caption
- ✅ Kirim audio/voice note
- ✅ Kirim dokumen/file
- ✅ Kirim lokasi
- ✅ Kirim pesan dengan button
- ✅ Kirim list message
- ✅ QR Code untuk login WhatsApp
- ✅ Auto reconnect
- ✅ File upload support
- ✅ Logging lengkap

## 📦 Instalasi

1. Clone repository ini:
```bash
git clone <repository-url>
cd whatsapp-otp-api
```

2. Install dependencies:
```bash
npm install
```

3. Jalankan aplikasi:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

4. API akan berjalan di `http://localhost:3000`

## 🔧 Konfigurasi

Aplikasi akan otomatis membuat direktori yang diperlukan:
- `sessions/` - Menyimpan data session WhatsApp
- `uploads/` - Menyimpan file upload sementara
- `logs/` - Menyimpan log aplikasi
- `qr-codes/` - Cache QR code

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Health Check
```http
GET /api/health
```

### Session Management

#### 1. Buat Session Baru
```http
POST /api/sessions/create
Content-Type: application/json

{
  "sessionId": "session1" // opsional, akan di-generate otomatis jika tidak ada
}
```

#### 2. Lihat Semua Sessions
```http
GET /api/sessions
```

#### 3. Lihat Status Session
```http
GET /api/sessions/{sessionId}/status
```

#### 4. Ambil QR Code
```http
GET /api/sessions/{sessionId}/qr
```

#### 5. QR Code HTML Page (untuk testing)
```http
GET /api/sessions/{sessionId}/qr-page
```

#### 6. Restart Session
```http
PUT /api/sessions/{sessionId}/restart
```

#### 7. Hapus Session
```http
DELETE /api/sessions/{sessionId}
```

### Message Sending

#### 1. Kirim Pesan Teks
```http
POST /api/messages/{sessionId}/text
Content-Type: application/json

{
  "to": "08123456789",
  "message": "Halo, ini pesan teks"
}
```

#### 2. Kirim OTP
```http
POST /api/messages/{sessionId}/otp
Content-Type: application/json

{
  "to": "08123456789",
  "otp": "123456", // opsional, akan di-generate otomatis
  "length": 6, // opsional, default 6
  "companyName": "PT. Contoh" // opsional
}
```

#### 3. Kirim Gambar
```http
POST /api/messages/{sessionId}/image
Content-Type: multipart/form-data

to: 08123456789
caption: Ini caption gambar
image: [file upload]

// Atau dengan URL:
Content-Type: application/json
{
  "to": "08123456789",
  "imageUrl": "https://example.com/image.jpg",
  "caption": "Ini caption gambar"
}
```

#### 4. Kirim Video
```http
POST /api/messages/{sessionId}/video
Content-Type: multipart/form-data

to: 08123456789
caption: Ini caption video
video: [file upload]
```

#### 5. Kirim Audio
```http
POST /api/messages/{sessionId}/audio
Content-Type: multipart/form-data

to: 08123456789
audio: [file upload]
```

#### 6. Kirim Dokumen
```http
POST /api/messages/{sessionId}/document
Content-Type: multipart/form-data

to: 08123456789
filename: dokumen.pdf
document: [file upload]
```

#### 7. Kirim Lokasi
```http
POST /api/messages/{sessionId}/location
Content-Type: application/json

{
  "to": "08123456789",
  "latitude": -6.200000,
  "longitude": 106.816666,
  "locationName": "Jakarta, Indonesia"
}
```

#### 8. Kirim Pesan dengan Button
```http
POST /api/messages/{sessionId}/button
Content-Type: application/json

{
  "to": "08123456789",
  "text": "Pilih opsi di bawah:",
  "buttons": [
    {"text": "Ya"},
    {"text": "Tidak"},
    {"text": "Mungkin"}
  ],
  "footer": "Powered by WhatsApp API"
}
```

#### 9. Kirim List Message
```http
POST /api/messages/{sessionId}/list
Content-Type: application/json

{
  "to": "08123456789",
  "text": "Pilih menu:",
  "buttonText": "Lihat Menu",
  "sections": [
    {
      "title": "Menu Utama",
      "rows": [
        {"title": "Menu 1", "rowId": "menu1", "description": "Deskripsi menu 1"},
        {"title": "Menu 2", "rowId": "menu2", "description": "Deskripsi menu 2"}
      ]
    }
  ],
  "footer": "Silakan pilih"
}
```

### Utilities

#### 1. Generate OTP
```http
GET /api/messages/{sessionId}/generate-otp?length=6
```

#### 2. Format Nomor Telepon
```http
GET /api/messages/format-phone/{phoneNumber}
```

## 🔄 Cara Penggunaan

### 1. Buat Session dan Login WhatsApp

```bash
# 1. Buat session baru
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "mysession"}'

# 2. Buka QR code di browser
# http://localhost:3000/api/sessions/mysession/qr-page

# 3. Scan QR code dengan WhatsApp di HP

# 4. Cek status koneksi
curl http://localhost:3000/api/sessions/mysession/status
```

### 🔧 Tips Sukses Login QR Code

Berdasarkan perbaikan terbaru (v1.2.0), proses login QR code sudah lebih stabil:

✅ **Yang Sudah Diperbaiki:**
- Tidak perlu scan QR code berulang kali
- Sistem otomatis handle restart setelah pairing
- Session data preserved selama proses login

✅ **Tips Login Sukses:**
```bash
# 1. Buat session dan tunggu QR code muncul
curl -X POST http://localhost:3000/api/sessions/create \
  -d '{"sessionId": "stable-session"}'

# 2. Buka halaman QR di browser  
# http://localhost:3000/api/sessions/stable-session/qr-page

# 3. Monitor log di terminal untuk melihat progress:
# - "QR Code generated" ✅
# - "pairing configured successfully" ✅  
# - "Restart diperlukan setelah pairing" ✅
# - "berhasil terhubung sebagai..." ✅

# 4. Cek status akhir
curl http://localhost:3000/api/sessions/stable-session/status
```

⚠️ **Jika Masih Gagal:**
```bash
# 1. Restart session
curl -X PUT http://localhost:3000/api/sessions/stable-session/restart

# 2. Atau hapus dan buat ulang  
curl -X DELETE http://localhost:3000/api/sessions/stable-session
curl -X POST http://localhost:3000/api/sessions/create \
  -d '{"sessionId": "stable-session"}'
```

### 2. Kirim OTP

```bash
curl -X POST http://localhost:3000/api/messages/mysession/otp \
  -H "Content-Type: application/json" \
  -d '{
    "to": "08123456789",
    "companyName": "PT. Contoh"
  }'
```

### 3. Kirim Gambar dengan Upload

```bash
curl -X POST http://localhost:3000/api/messages/mysession/image \
  -F "to=08123456789" \
  -F "caption=Ini gambar contoh" \
  -F "image=@/path/to/image.jpg"
```

## 🔀 Format Nomor Telepon

API secara otomatis akan memformat nomor telepon ke format WhatsApp:
- `08123456789` → `628123456789@s.whatsapp.net`
- `8123456789` → `628123456789@s.whatsapp.net`
- `628123456789` → `628123456789@s.whatsapp.net`

## 📝 Response Format

Semua response menggunakan format JSON yang konsisten:

### Success Response
```json
{
  "success": true,
  "message": "Deskripsi sukses",
  "data": {
    // data response
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Deskripsi error"
}
```

## 🔧 Environment Variables

Anda bisa menggunakan environment variables untuk konfigurasi:

```env
PORT=3000
LOG_LEVEL=info
```

## 📋 File Types Support

### Gambar
- JPEG, JPG, PNG, GIF, WebP

### Video
- MP4, AVI, MOV, WMV, 3GP

### Audio
- MP3, WAV, OGG, M4A, MPEG

### Dokumen
- PDF, DOC, DOCX, XLS, XLSX, TXT, CSV

## ⚠️ Catatan Penting

1. **WhatsApp Terms of Service**: Pastikan penggunaan sesuai dengan TOS WhatsApp
2. **Rate Limiting**: WhatsApp memiliki rate limit, jangan spam pesan
3. **Session Management**: Session WhatsApp dapat terputus sewaktu-waktu
4. **File Size**: Maksimal upload file 50MB
5. **QR Code**: QR Code expired setelah 2 menit
6. **Auto Cleanup**: File upload akan dihapus otomatis setelah dikirim

## 🔧 Troubleshooting

Jika mengalami masalah seperti:
- QR Code timeout error
- Session tidak terhubung
- OTP tidak terkirim
- File upload gagal

Silakan baca **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** untuk solusi lengkap.

### Quick Fix untuk QR Code Timeout:
```bash
# Restart session yang bermasalah
curl -X PUT http://localhost:3000/api/sessions/your-session/restart
```

## 🛠️ Development

### Project Structure
```