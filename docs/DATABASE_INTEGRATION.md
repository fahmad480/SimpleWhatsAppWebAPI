# Database Integration - WhatsApp OTP API

## 📋 Overview

WhatsApp OTP API sekarang terintegrasi dengan database (MySQL/SQLite) untuk menyimpan:
- **Session Information**: Status koneksi WhatsApp, user info, timestamps
- **Activity Logs**: Semua aktivitas API dan message tracking
- **OTP Logs**: Tracking OTP yang dikirim dan verifikasi

## 🗄️ Database Configuration

### Environment Variables

Salin file konfigurasi:
```bash
cp config/env.example .env
```

### SQLite (Default)
```env
DB_TYPE=sqlite
DB_SQLITE_PATH=./database/whatsapp_api.db
```

### MySQL
```env
DB_TYPE=mysql
DB_MYSQL_HOST=localhost
DB_MYSQL_PORT=3306
DB_MYSQL_USERNAME=root
DB_MYSQL_PASSWORD=your_password
DB_MYSQL_DATABASE=whatsapp_otp_api
```

## 📊 Database Schema

### 1. Sessions Table
```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId VARCHAR(100) UNIQUE NOT NULL,
  userId VARCHAR(100),
  userName VARCHAR(255),
  userPhone VARCHAR(20),
  isConnected BOOLEAN DEFAULT false,
  lastSeen DATETIME,
  qrGenerated DATETIME,
  connectedAt DATETIME,
  disconnectedAt DATETIME,
  deviceInfo TEXT,
  status ENUM('active', 'inactive', 'error', 'connecting') DEFAULT 'inactive',
  errorMessage TEXT,
  createdAt DATETIME,
  updatedAt DATETIME
);
```

### 2. Activity Logs Table
```sql
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId VARCHAR(100) NOT NULL,
  action ENUM('session_create', 'session_delete', 'session_restart', 'qr_generate', 'qr_scan', 'connection_open', 'connection_close', 'message_send', 'message_receive', 'otp_send', 'file_upload', 'api_call') NOT NULL,
  messageType ENUM('text', 'image', 'video', 'audio', 'document', 'location', 'button', 'list', 'otp'),
  phoneNumber VARCHAR(20),
  messageId VARCHAR(100),
  status ENUM('success', 'error', 'pending') DEFAULT 'pending',
  details TEXT,
  errorMessage TEXT,
  requestData TEXT,
  responseData TEXT,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  duration INTEGER,
  createdAt DATETIME,
  updatedAt DATETIME
);
```

### 3. OTP Logs Table
```sql
CREATE TABLE otp_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId VARCHAR(100) NOT NULL,
  phoneNumber VARCHAR(20) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  otpHash VARCHAR(255),
  status ENUM('sent', 'verified', 'expired', 'failed') DEFAULT 'sent',
  messageId VARCHAR(100),
  expiresAt DATETIME NOT NULL,
  verifiedAt DATETIME,
  attempts INTEGER DEFAULT 0,
  maxAttempts INTEGER DEFAULT 3,
  companyName VARCHAR(255),
  ipAddress VARCHAR(45),
  userAgent TEXT,
  createdAt DATETIME,
  updatedAt DATETIME
);
```

## 🚀 Setup Database

### Initial Migration
```bash
npm run db:migrate
```

### Force Reset (⚠️ Data akan hilang)
```bash
npm run db:migrate -- --force
```

## 📡 API Endpoints Baru

### Analytics & Statistics

#### 1. Dashboard Statistics
```http
GET /api/analytics/dashboard
```

**Response:**
```json
{
  "success": true,
  "message": "Dashboard statistics retrieved",
  "data": {
    "sessions": {
      "total": 5,
      "active": 2,
      "inactive": 3
    },
    "messages": {
      "total": 150,
      "today": 25
    },
    "otp": {
      "total": 45,
      "today": 8
    },
    "timestamp": "2025-06-05T16:00:00.000Z"
  }
}
```

#### 2. Session Statistics
```http
GET /api/analytics/sessions/{sessionId}/stats
```

#### 3. Activity Logs
```http
GET /api/analytics/logs/activity?sessionId=abc&action=message_send&limit=50
```

#### 4. OTP Logs
```http
GET /api/analytics/logs/otp?phoneNumber=081234567890&status=sent
```

#### 5. Error Logs
```http
GET /api/analytics/logs/errors?sessionId=abc&limit=20
```

### OTP Management

#### 1. Verify OTP
```http
POST /api/otp/verify
Content-Type: application/json

{
  "phoneNumber": "081234567890",
  "otp": "123456",
  "sessionId": "optional"
}
```

#### 2. Check OTP Status
```http
GET /api/otp/status/081234567890?sessionId=abc
```

#### 3. Resend OTP
```http
POST /api/otp/resend
Content-Type: application/json

{
  "phoneNumber": "081234567890",
  "sessionId": "abc",
  "companyName": "PT. Contoh"
}
```

#### 4. Expire OTP
```http
POST /api/otp/expire
Content-Type: application/json

{
  "phoneNumber": "081234567890",
  "sessionId": "abc"
}
```

## 🔧 Database Operations

### Session Management
```javascript
const { Session } = require('./models');

// Create or update session
const session = await Session.createOrUpdate('session123', {
  status: 'connecting'
});

// Get session by ID
const session = await Session.getBySessionId('session123');

// Set connected
await session.setConnected({ id: '628123456789', name: 'User Name' });

// Set disconnected
await session.setDisconnected('Connection error');
```

### Activity Logging
```javascript
const { ActivityLog } = require('./models');

// Log activity
await ActivityLog.logActivity({
  sessionId: 'session123',
  action: 'message_send',
  messageType: 'text',
  phoneNumber: '628123456789',
  messageId: 'msg_123',
  status: 'success',
  requestData: { to: '628123456789', message: 'Hello' },
  responseData: { messageId: 'msg_123' }
});

// Get session logs
const logs = await ActivityLog.getSessionLogs('session123', 100);

// Get message statistics
const stats = await ActivityLog.getMessageStats('session123', 7);
```

### OTP Management
```javascript
const { OTPLog } = require('./models');

// Create OTP
const otp = await OTPLog.createOTP({
  sessionId: 'session123',
  phoneNumber: '628123456789',
  otp: '123456',
  messageId: 'msg_123',
  companyName: 'PT. Contoh'
});

// Verify OTP
const otpRecord = await OTPLog.getValidOTP('628123456789', '123456');
if (otpRecord) {
  const result = otpRecord.verify('123456');
  await otpRecord.save();
}

// Check recent OTP
const recent = await OTPLog.getRecentOTP('628123456789');
```

## 🧹 Automatic Cleanup

### Scheduled Cleanup
- **Activity Logs**: Dihapus setelah 30 hari (daily at 2 AM)
- **OTP Logs**: Dihapus setelah 7 hari (daily at 2 AM)  
- **Expired OTPs**: Diupdate status setiap menit

### Manual Cleanup
```http
POST /api/analytics/cleanup
Content-Type: application/json

{
  "activityDays": 30,
  "otpDays": 7
}
```

## 📊 Monitoring & Analytics

### Real-time Dashboard
```bash
# Check overall health
curl http://localhost:3000/api/health

# View dashboard stats
curl http://localhost:3000/api/analytics/dashboard

# Session statistics
curl http://localhost:3000/api/analytics/sessions/session123/stats
```

### Log Analysis
```bash
# Recent activity logs
curl "http://localhost:3000/api/analytics/logs/activity?limit=100"

# Error tracking
curl "http://localhost:3000/api/analytics/logs/errors?limit=50"

# OTP statistics
curl "http://localhost:3000/api/analytics/logs/otp?status=verified&limit=50"
```

## 🔒 Security & Privacy

### Data Protection
- **OTP Values**: Tidak di-expose di API responses
- **Sensitive Data**: Request/response data bisa difilter
- **Rate Limiting**: Built-in untuk prevent spam

### Access Control
```javascript
// Add API key middleware (optional)
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid API key' 
    });
  }
  next();
};

// Apply to sensitive routes
app.use('/api/analytics', validateApiKey);
```

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check database connection
curl http://localhost:3000/api/health

# Manual migration
npm run db:migrate

# Check database file (SQLite)
ls -la database/

# View logs
tail -f logs/database.log
```

### Performance Optimization
```javascript
// Add indexes for better performance
await sequelize.query(`
  CREATE INDEX idx_activity_logs_session_action 
  ON activity_logs (sessionId, action);
  
  CREATE INDEX idx_otp_logs_phone_status 
  ON otp_logs (phoneNumber, status);
`);
```

---

## 📖 Migration dari Versi Lama

Jika Anda upgrade dari versi tanpa database:

1. **Backup data lama** (sessions folder)
2. **Install dependencies**: `npm install`
3. **Setup environment**: `cp config/env.example .env`
4. **Run migration**: `npm run db:migrate`
5. **Start server**: `npm start`

Data session yang ada di memory akan otomatis tersinkronisasi ke database saat pertama kali connect.

---

**💡 Tips:** Gunakan endpoint analytics untuk monitoring real-time dan troubleshooting issues! 