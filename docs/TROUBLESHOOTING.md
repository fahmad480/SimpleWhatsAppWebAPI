# Troubleshooting Guide - WhatsApp OTP API

## 🔧 Common Issues and Solutions

### 1. QR Code Timeout / Scan QR Code Always Restart

**Error:**
```
Error: QR refs attempts ended
Error: Session abc already exists
pairing configured successfully, expect to restart the connection...
stream errored out - code 515
Connection closed for session abc. Reconnecting: true
```

**Cause:**
- After QR code is scanned, WhatsApp requires connection restart
- Old system deleted session data during restart, causing pairing to be lost
- User had to scan QR code repeatedly

**Solution:**
✅ **Already Fixed** - Latest version handles restart with smart handling:

**Applied Fixes:**
1. **Smart Reconnection**: System differentiates between restart after pairing vs normal error
2. **Preserve Session Data**: Pairing data not deleted when restart is required
3. **Graceful Recovery**: Fallback to old method if smart reconnection fails

**New Flow:**
```
1. User scans QR code ✅
2. Pairing successful ✅
3. WhatsApp requests restart (stream error 515) ✅
4. System restarts without deleting session data ✅
5. Connection successful without rescan ✅
```

**Manual Fix if still occurring:**
```bash
# 1. Restart problematic session
curl -X PUT http://localhost:3000/api/sessions/test-session/restart

# 2. Or delete and recreate
curl -X DELETE http://localhost:3000/api/sessions/test-session
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-session"}'
```

**Success Login Tips:**
- ⏰ Scan QR code within 2 minutes of appearance
- 📱 Ensure stable internet connection on phone
- 🔄 If fails, wait 30 seconds before trying again
- 📊 Monitor logs to see progress

### 2. Session Not Connected

**Error:**
```
{"success":false,"message":"Session not connected"}
```

**Solution:**
```bash
# 1. Check session status
curl http://localhost:3000/api/sessions/your-session/status

# 2. If not connected, get new QR code
curl http://localhost:3000/api/sessions/your-session/qr

# 3. Or open in browser
# http://localhost:3000/api/sessions/your-session/qr-page
```

### 3. File Upload Error

**Error:**
```
Error: File type image/svg+xml not supported
```

**Solution:**
Supported file types:
- **Images:** JPEG, JPG, PNG, GIF, WebP
- **Videos:** MP4, AVI, MOV, WMV, 3GP  
- **Audio:** MP3, WAV, OGG, M4A, MPEG
- **Documents:** PDF, DOC, DOCX, XLS, XLSX, TXT, CSV

### 4. Invalid Phone Number

**Error:**
```
{"success":false,"message":"Phone number required"}
```

**Solution:**
```javascript
// Correct formats:
"to": "08123456789"   // ✅
"to": "8123456789"    // ✅  
"to": "628123456789"  // ✅

// Wrong formats:
"to": "+628123456789" // ❌
"to": "081-234-56789" // ❌
```

### 5. OTP Not Sent

**Possible Causes:**
1. Session not connected
2. Phone number not registered on WhatsApp
3. Rate limiting from WhatsApp

**Solution:**
```bash
# 1. Check session status first
curl http://localhost:3000/api/sessions/your-session/status

# 2. Ensure Indonesian phone number format
curl http://localhost:3000/api/messages/format-phone/08123456789

# 3. Test with your own number first
curl -X POST http://localhost:3000/api/messages/your-session/text \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your_number",
    "message": "Test message"
  }'
```

### 6. High Server Memory

**Cause:**
- Too many active sessions
- Upload files not cleaned up

**Solution:**
```bash
# 1. View all active sessions
curl http://localhost:3000/api/sessions

# 2. Delete unnecessary sessions
curl -X DELETE http://localhost:3000/api/sessions/old-session

# 3. Restart server periodically
npm run restart
```

### 7. WhatsApp Web Logout

**Error:**
```
Connection closed. Reconnecting: false
```

**Cause:**
- WhatsApp account logged out from web
- Device pairing revoked

**Solution:**
```bash
# 1. Session will be automatically deleted
# 2. Create new session
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "new-session"}'

# 3. Scan QR code again
```

## 🚀 Best Practices for Production

### 1. Session Management
```javascript
// Implement health check for sessions
const checkAllSessions = async () => {
  const sessions = await fetch('http://localhost:3000/api/sessions');
  const data = await sessions.json();
  
  for (const [sessionId, session] of Object.entries(data.data.sessions)) {
    if (!session.isConnected) {
      console.log(`⚠️ Session ${sessionId} disconnected`);
      // Auto restart or notification
    }
  }
};

// Run every 5 minutes
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
      
      // If session not connected, try restart
      if (result.message.includes('not connected')) {
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
  
  // 1 OTP per 60 seconds per number
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

// Log metrics every hour
setInterval(() => {
  console.log('📊 Metrics:', monitor);
  
  // Alert if failure rate is high
  const failureRate = monitor.failedRequests / monitor.totalOTPSent;
  if (failureRate > 0.1) { // 10% failure rate
    console.log('🚨 High failure rate detected!');
    // Send notification
  }
}, 60 * 60 * 1000);
```

## 📞 Support

If you're still experiencing issues:

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
   - Network connectivity: Ensure internet access

---

**💡 Tips:** Always monitor application logs for further debugging! 