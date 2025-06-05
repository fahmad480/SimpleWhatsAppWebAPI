const axios = require('axios');

// Konfigurasi
const BASE_URL = 'http://localhost:3000/api';
const SESSION_ID = 'test-session';
const TARGET_PHONE = '08123456789'; // Ganti dengan nomor HP yang valid

// Helper function untuk delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test functions
async function testAPI() {
  try {
    console.log('🚀 Mulai testing WhatsApp OTP API\n');

    // 1. Health check
    console.log('1. Testing health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', health.data.status);
    console.log('');

    // 2. Create session
    console.log('2. Membuat session...');
    const createSession = await axios.post(`${BASE_URL}/sessions/create`, {
      sessionId: SESSION_ID
    });
    console.log('✅ Session dibuat:', createSession.data.data.sessionId);
    console.log('');

    // 3. Wait for QR code
    console.log('3. Menunggu QR code...');
    await delay(3000);
    
    try {
      const qrResponse = await axios.get(`${BASE_URL}/sessions/${SESSION_ID}/qr`);
      console.log('✅ QR Code tersedia');
      console.log('📱 Silakan buka browser dan akses:');
      console.log(`   http://localhost:3000/api/sessions/${SESSION_ID}/qr-page`);
      console.log('   Scan QR code dengan WhatsApp Anda');
      console.log('');
    } catch (error) {
      console.log('⏳ QR Code belum tersedia, coba lagi...');
    }

    // 4. Wait for connection
    console.log('4. Menunggu koneksi WhatsApp...');
    let isConnected = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts x 5 seconds = 2.5 minutes

    while (!isConnected && attempts < maxAttempts) {
      try {
        const status = await axios.get(`${BASE_URL}/sessions/${SESSION_ID}/status`);
        if (status.data.data.isConnected) {
          isConnected = true;
          console.log('✅ WhatsApp terhubung!');
          console.log('👤 User:', status.data.data.user?.name || status.data.data.user?.id);
          console.log('');
        } else {
          console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts} - Menunggu koneksi...`);
          await delay(5000);
        }
      } catch (error) {
        console.log('❌ Error checking status:', error.response?.data?.message || error.message);
      }
      attempts++;
    }

    if (!isConnected) {
      console.log('❌ Timeout menunggu koneksi WhatsApp');
      console.log('💡 Pastikan QR code sudah di-scan');
      return;
    }

    // 5. Test send text message
    console.log('5. Testing kirim pesan teks...');
    try {
      const textMessage = await axios.post(`${BASE_URL}/messages/${SESSION_ID}/text`, {
        to: TARGET_PHONE,
        message: '🧪 Test pesan dari WhatsApp OTP API'
      });
      console.log('✅ Pesan teks terkirim:', textMessage.data.data.messageId);
      console.log('');
    } catch (error) {
      console.log('❌ Error kirim pesan teks:', error.response?.data?.message || error.message);
    }

    // 6. Test send OTP
    console.log('6. Testing kirim OTP...');
    try {
      const otpMessage = await axios.post(`${BASE_URL}/messages/${SESSION_ID}/otp`, {
        to: TARGET_PHONE,
        companyName: 'WhatsApp API Test'
      });
      console.log('✅ OTP terkirim:', otpMessage.data.data.otp);
      console.log('');
    } catch (error) {
      console.log('❌ Error kirim OTP:', error.response?.data?.message || error.message);
    }

    console.log('🎉 Testing selesai!');
    console.log('💡 Session masih aktif. Anda bisa melanjutkan testing manual.');

  } catch (error) {
    console.error('❌ Error during testing:', error.response?.data || error.message);
  }
}

// Jalankan test
if (require.main === module) {
  console.log('📱 WhatsApp OTP API Tester');
  console.log('==========================');
  console.log(`🎯 Target phone: ${TARGET_PHONE}`);
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log(`📋 Session ID: ${SESSION_ID}`);
  console.log('');
  
  testAPI();
}

module.exports = { testAPI }; 