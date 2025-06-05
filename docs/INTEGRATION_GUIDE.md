# Panduan Integrasi WhatsApp OTP API

## 📋 Daftar Isi

1. [Quick Start](#quick-start)
2. [Authentication & Session](#authentication--session)
3. [Mengirim OTP](#mengirim-otp)
4. [Contoh Implementasi](#contoh-implementasi)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

## Quick Start

### 1. Persiapan

```bash
# Clone dan install
git clone <repository-url>
cd whatsapp-otp-api
npm install

# Jalankan server
npm start
```

### 2. Buat Session WhatsApp

```javascript
// 1. Buat session baru
const response = await fetch('http://localhost:3000/api/sessions/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'my-session'
  })
});

const result = await response.json();
console.log('Session ID:', result.data.sessionId);
```

### 3. Login WhatsApp

```javascript
// Buka QR code di browser
window.open('http://localhost:3000/api/sessions/my-session/qr-page');

// Atau ambil QR code data
const qrResponse = await fetch('http://localhost:3000/api/sessions/my-session/qr');
const qrData = await qrResponse.json();
console.log('QR Code:', qrData.data.qrCode); // Base64 image
```

### 4. Cek Status Koneksi

```javascript
const checkConnection = async () => {
  const response = await fetch('http://localhost:3000/api/sessions/my-session/status');
  const data = await response.json();
  
  if (data.data.isConnected) {
    console.log('✅ WhatsApp terhubung!');
    console.log('User:', data.data.user);
    return true;
  }
  
  console.log('⏳ Belum terhubung...');
  return false;
};

// Polling sampai terhubung
const waitForConnection = async () => {
  while (!(await checkConnection())) {
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
};
```

### 5. Kirim OTP

```javascript
const sendOTP = async (phoneNumber) => {
  const response = await fetch('http://localhost:3000/api/messages/my-session/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phoneNumber,
      companyName: 'PT. Contoh'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('✅ OTP terkirim:', result.data.otp);
    return result.data.otp;
  } else {
    throw new Error(result.message);
  }
};

// Contoh penggunaan
const otp = await sendOTP('08123456789');
```

## Authentication & Session

### Membuat Multiple Sessions

```javascript
const sessions = ['session-1', 'session-2', 'session-3'];

for (const sessionId of sessions) {
  const response = await fetch('http://localhost:3000/api/sessions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  
  const result = await response.json();
  console.log(`Session ${sessionId} dibuat:`, result.success);
}
```

### Monitoring Sessions

```javascript
const getAllSessions = async () => {
  const response = await fetch('http://localhost:3000/api/sessions');
  const data = await response.json();
  
  return data.data.sessions;
};

const sessions = await getAllSessions();
console.log('Total sessions:', Object.keys(sessions).length);

for (const [sessionId, session] of Object.entries(sessions)) {
  console.log(`${sessionId}: ${session.isConnected ? '✅' : '❌'}`);
}
```

## Mengirim OTP

### OTP dengan Template Custom

```javascript
const sendCustomOTP = async (phoneNumber, template) => {
  // Generate OTP dulu
  const otpResponse = await fetch('http://localhost:3000/api/messages/my-session/generate-otp?length=6');
  const otpData = await otpResponse.json();
  const otp = otpData.data.otp;
  
  // Template custom
  const message = template.replace('{OTP}', otp);
  
  // Kirim pesan
  const response = await fetch('http://localhost:3000/api/messages/my-session/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phoneNumber,
      message: message
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    return { otp, messageId: result.data.messageId };
  } else {
    throw new Error(result.message);
  }
};

// Contoh penggunaan
const template = `
🔐 Kode Verifikasi Anda

Kode OTP: *{OTP}*

Jangan bagikan kode ini kepada siapapun.
Berlaku 5 menit.

Salam,
Tim Customer Service
`;

const { otp, messageId } = await sendCustomOTP('08123456789', template);
```

### Batch OTP Sending

```javascript
const sendBatchOTP = async (phoneNumbers, companyName = 'PT. Contoh') => {
  const results = [];
  
  for (const phoneNumber of phoneNumbers) {
    try {
      const response = await fetch('http://localhost:3000/api/messages/my-session/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          companyName
        })
      });
      
      const result = await response.json();
      
      results.push({
        phoneNumber,
        success: result.success,
        otp: result.success ? result.data.otp : null,
        error: result.success ? null : result.message
      });
      
      // Delay untuk menghindari spam
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      results.push({
        phoneNumber,
        success: false,
        otp: null,
        error: error.message
      });
    }
  }
  
  return results;
};

// Contoh penggunaan
const phoneNumbers = ['08123456789', '08987654321', '08111222333'];
const results = await sendBatchOTP(phoneNumbers, 'PT. Contoh');

results.forEach(result => {
  if (result.success) {
    console.log(`✅ ${result.phoneNumber}: OTP ${result.otp}`);
  } else {
    console.log(`❌ ${result.phoneNumber}: ${result.error}`);
  }
});
```

## Contoh Implementasi

### Node.js dengan Express

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const WHATSAPP_API_BASE = 'http://localhost:3000/api';
const SESSION_ID = 'main-session';

// Endpoint untuk kirim OTP
app.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Kirim OTP
    const response = await axios.post(`${WHATSAPP_API_BASE}/messages/${SESSION_ID}/otp`, {
      to: phoneNumber,
      companyName: 'PT. Contoh'
    });
    
    // Simpan OTP ke database/cache untuk verifikasi
    const otp = response.data.data.otp;
    // await saveOTPToCache(phoneNumber, otp);
    
    res.json({
      success: true,
      message: 'OTP berhasil dikirim',
      // Jangan kirim OTP ke frontend untuk keamanan
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message
    });
  }
});

// Endpoint untuk verify OTP
app.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    // Ambil OTP dari cache/database
    // const savedOTP = await getOTPFromCache(phoneNumber);
    
    // if (otp === savedOTP) {
    //   await deleteOTPFromCache(phoneNumber);
    //   res.json({ success: true, message: 'OTP valid' });
    // } else {
    //   res.status(400).json({ success: false, message: 'OTP tidak valid' });
    // }
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(4000, () => {
  console.log('API berjalan di port 4000');
});
```

### PHP Implementation

```php
<?php
class WhatsAppOTPAPI {
    private $baseUrl;
    private $sessionId;
    
    public function __construct($baseUrl = 'http://localhost:3000/api', $sessionId = 'main-session') {
        $this->baseUrl = $baseUrl;
        $this->sessionId = $sessionId;
    }
    
    public function sendOTP($phoneNumber, $companyName = 'PT. Contoh') {
        $url = $this->baseUrl . '/messages/' . $this->sessionId . '/otp';
        
        $data = [
            'to' => $phoneNumber,
            'companyName' => $companyName
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }
    
    public function checkSessionStatus() {
        $url = $this->baseUrl . '/sessions/' . $this->sessionId . '/status';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        return $data['data']['isConnected'] ?? false;
    }
}

// Contoh penggunaan
$whatsapp = new WhatsAppOTPAPI();

if ($whatsapp->checkSessionStatus()) {
    $result = $whatsapp->sendOTP('08123456789', 'PT. Contoh');
    
    if ($result['success']) {
        echo "OTP berhasil dikirim: " . $result['data']['otp'];
    } else {
        echo "Error: " . $result['message'];
    }
} else {
    echo "WhatsApp session belum terhubung";
}
?>
```

## Error Handling

### Common Error Responses

```javascript
const handleAPIError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        console.error('Bad Request:', data.message);
        break;
      case 404:
        console.error('Not Found:', data.message);
        break;
      case 500:
        console.error('Server Error:', data.message);
        break;
      default:
        console.error('Unknown Error:', data.message);
    }
  } else {
    console.error('Network Error:', error.message);
  }
};

// Contoh penggunaan dengan try-catch
try {
  const result = await sendOTP('08123456789');
  console.log('Success:', result);
} catch (error) {
  handleAPIError(error);
}
```

### Retry Mechanism

```javascript
const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
};

// Contoh penggunaan
const sendOTPWithRetry = async (phoneNumber) => {
  return await retryRequest(async () => {
    const response = await fetch('http://localhost:3000/api/messages/my-session/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phoneNumber })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  });
};
```

## Best Practices

### 1. Session Management

```javascript
// Singleton pattern untuk session
class WhatsAppSessionManager {
  constructor() {
    this.sessions = new Map();
    this.baseUrl = 'http://localhost:3000/api';
  }
  
  async createSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }
    
    const response = await fetch(`${this.baseUrl}/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    
    const result = await response.json();
    this.sessions.set(sessionId, result.data);
    
    return result.data;
  }
  
  async waitForConnection(sessionId, timeout = 120000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/status`);
      const data = await response.json();
      
      if (data.data.isConnected) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    throw new Error('Connection timeout');
  }
}
```

### 2. Rate Limiting

```javascript
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }
  
  canMakeRequest(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
}

const rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute

const sendOTPWithRateLimit = async (phoneNumber) => {
  if (!rateLimiter.canMakeRequest(phoneNumber)) {
    throw new Error('Rate limit exceeded');
  }
  
  return await sendOTP(phoneNumber);
};
```

### 3. OTP Storage & Validation

```javascript
class OTPManager {
  constructor() {
    this.otps = new Map();
    this.expiryTime = 5 * 60 * 1000; // 5 minutes
  }
  
  store(phoneNumber, otp) {
    this.otps.set(phoneNumber, {
      otp,
      timestamp: Date.now(),
      attempts: 0
    });
  }
  
  verify(phoneNumber, inputOTP, maxAttempts = 3) {
    const otpData = this.otps.get(phoneNumber);
    
    if (!otpData) {
      throw new Error('OTP not found');
    }
    
    // Check expiry
    if (Date.now() - otpData.timestamp > this.expiryTime) {
      this.otps.delete(phoneNumber);
      throw new Error('OTP expired');
    }
    
    // Check attempts
    if (otpData.attempts >= maxAttempts) {
      this.otps.delete(phoneNumber);
      throw new Error('Too many attempts');
    }
    
    otpData.attempts++;
    
    if (otpData.otp === inputOTP) {
      this.otps.delete(phoneNumber);
      return true;
    }
    
    return false;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [phoneNumber, otpData] of this.otps) {
      if (now - otpData.timestamp > this.expiryTime) {
        this.otps.delete(phoneNumber);
      }
    }
  }
}

// Auto cleanup setiap 5 menit
const otpManager = new OTPManager();
setInterval(() => otpManager.cleanup(), 5 * 60 * 1000);
```

### 4. Monitoring & Logging

```javascript
class WhatsAppAPIMonitor {
  constructor() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }
  
  async makeRequest(requestFn, operation) {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      const result = await requestFn();
      this.stats.successfulRequests++;
      
      // Update average response time
      const responseTime = Date.now() - startTime;
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime + responseTime) / 2;
      
      console.log(`✅ ${operation} completed in ${responseTime}ms`);
      return result;
      
    } catch (error) {
      this.stats.failedRequests++;
      console.error(`❌ ${operation} failed:`, error.message);
      throw error;
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      successRate: (this.stats.successfulRequests / this.stats.totalRequests) * 100
    };
  }
}

const monitor = new WhatsAppAPIMonitor();

// Contoh penggunaan
const monitoredSendOTP = async (phoneNumber) => {
  return await monitor.makeRequest(
    () => sendOTP(phoneNumber),
    `Send OTP to ${phoneNumber}`
  );
};
```

---

Dengan panduan ini, Anda dapat mengintegrasikan WhatsApp OTP API ke dalam aplikasi Anda dengan mudah dan aman. Pastikan untuk mengikuti best practices untuk keamanan dan performa yang optimal. 