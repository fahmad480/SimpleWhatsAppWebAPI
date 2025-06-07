const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Warna untuk console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = (color, message) => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

async function testAIChatbot() {
  log('cyan', '🤖 Testing AI Chatbot Integration...\n');

  try {
    // 1. Test AI Health Check
    log('blue', '1️⃣ Testing AI Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/ai/health`);
    log('green', '✅ AI Health Check Response:');
    console.log(JSON.stringify(healthResponse.data, null, 2));
    console.log();

    // 2. Test AI Statistics
    log('blue', '2️⃣ Testing AI Statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/ai/stats`);
    log('green', '✅ AI Statistics Response:');
    console.log(JSON.stringify(statsResponse.data, null, 2));
    console.log();

    // 3. Test AI Response - Simple Greeting
    log('blue', '3️⃣ Testing AI Response - Simple Greeting...');
    const greetingResponse = await axios.post(`${BASE_URL}/ai/test`, {
      message: 'Halo, siapa kamu?',
      phoneNumber: '628123456789'
    });
    log('green', '✅ AI Greeting Response:');
    console.log(JSON.stringify(greetingResponse.data, null, 2));
    console.log();

    // 4. Test AI Response - Technical Question
    log('blue', '4️⃣ Testing AI Response - Technical Question...');
    const techResponse = await axios.post(`${BASE_URL}/ai/test`, {
      message: 'Bagaimana cara menggunakan API ini untuk kirim OTP?',
      phoneNumber: '628123456789'
    });
    log('green', '✅ AI Technical Response:');
    console.log(JSON.stringify(techResponse.data, null, 2));
    console.log();

    // 5. Test AI Response - Indonesian Culture
    log('blue', '5️⃣ Testing AI Response - Indonesian Culture...');
    const cultureResponse = await axios.post(`${BASE_URL}/ai/test`, {
      message: 'Ceritakan tentang budaya Indonesia',
      phoneNumber: '628123456789'
    });
    log('green', '✅ AI Culture Response:');
    console.log(JSON.stringify(cultureResponse.data, null, 2));
    console.log();

    // 6. Get Conversation History
    log('blue', '6️⃣ Testing Conversation History...');
    const historyResponse = await axios.get(`${BASE_URL}/ai/history/628123456789`);
    log('green', '✅ Conversation History:');
    console.log(JSON.stringify(historyResponse.data, null, 2));
    console.log();

    // 7. Test Multiple Conversations (Different Phone Number)
    log('blue', '7️⃣ Testing Multiple Conversations...');
    await axios.post(`${BASE_URL}/ai/test`, {
      message: 'Halo, saya user baru',
      phoneNumber: '628987654321'
    });
    await axios.post(`${BASE_URL}/ai/test`, {
      message: 'Apa saja fitur yang tersedia?',
      phoneNumber: '628987654321'
    });
    
    const newUserHistory = await axios.get(`${BASE_URL}/ai/history/628987654321`);
    log('green', '✅ New User Conversation History:');
    console.log(JSON.stringify(newUserHistory.data, null, 2));
    console.log();

    // 8. Updated Statistics
    log('blue', '8️⃣ Checking Updated Statistics...');
    const updatedStats = await axios.get(`${BASE_URL}/ai/stats`);
    log('green', '✅ Updated AI Statistics:');
    console.log(JSON.stringify(updatedStats.data, null, 2));
    console.log();

    // 9. Clear Specific User History
    log('blue', '9️⃣ Testing Clear Specific User History...');
    const clearResponse = await axios.delete(`${BASE_URL}/ai/history/628123456789`);
    log('green', '✅ Clear History Response:');
    console.log(JSON.stringify(clearResponse.data, null, 2));
    console.log();

    // 10. Verify History Cleared
    log('blue', '🔟 Verifying History Cleared...');
    const clearedHistory = await axios.get(`${BASE_URL}/ai/history/628123456789`);
    log('green', '✅ Cleared History Check:');
    console.log(JSON.stringify(clearedHistory.data, null, 2));
    console.log();

    // Summary
    log('green', '🎉 AI Chatbot Testing Completed Successfully!');
    log('yellow', '\n📋 Test Summary:');
    log('yellow', '✅ AI Health Check - OK');
    log('yellow', '✅ AI Statistics - OK');
    log('yellow', '✅ Simple Greeting - OK');
    log('yellow', '✅ Technical Question - OK');
    log('yellow', '✅ Cultural Question - OK');
    log('yellow', '✅ Conversation History - OK');
    log('yellow', '✅ Multiple Users - OK');
    log('yellow', '✅ Clear History - OK');
    
    log('cyan', '\n🔧 To use AI Chatbot in production:');
    log('cyan', '1. Set GOOGLE_AI_API_KEY in .env file');
    log('cyan', '2. Configure AI_CHATBOT_PHONE number');
    log('cyan', '3. Create WhatsApp session and connect');
    log('cyan', '4. Send messages from configured phone number');
    log('cyan', '5. AI will automatically respond!');

  } catch (error) {
    log('red', '❌ Error during AI Chatbot testing:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    
    log('yellow', '\n💡 Troubleshooting Tips:');
    log('yellow', '1. Make sure server is running (npm start)');
    log('yellow', '2. Check if GOOGLE_AI_API_KEY is set in .env');
    log('yellow', '3. Verify Google AI Studio API quota');
    log('yellow', '4. Check logs/ai-service.log for detailed errors');
  }
}

// Test AI Configuration
async function testAIConfiguration() {
  log('cyan', '\n🔧 Testing AI Configuration...\n');
  
  try {
    const healthResponse = await axios.get(`${BASE_URL}/ai/health`);
    const config = healthResponse.data.data;
    
    log('blue', 'AI Configuration Status:');
    console.log(`📱 Chatbot Phone: ${config.chatbotPhone}`);
    console.log(`🤖 AI Model: ${config.model}`);
    console.log(`🔑 API Key Configured: ${config.apiKeyConfigured ? '✅' : '❌'}`);
    console.log(`🚀 AI Available: ${config.isAvailable ? '✅' : '❌'}`);
    
    if (!config.apiKeyConfigured) {
      log('red', '\n⚠️ WARNING: Google AI API Key not configured!');
      log('yellow', 'Add GOOGLE_AI_API_KEY to your .env file to enable AI responses.');
      log('yellow', 'Currently using fallback responses only.');
    } else {
      log('green', '\n✅ AI Configuration looks good!');
    }
    
  } catch (error) {
    log('red', '❌ Failed to check AI configuration:');
    console.error(error.message);
  }
}

// Main function
async function main() {
  console.clear();
  log('cyan', '╔══════════════════════════════════════════════════════════╗');
  log('cyan', '║               🤖 AI CHATBOT TEST SUITE 🤖                ║');
  log('cyan', '║                WhatsApp OTP API                          ║');
  log('cyan', '╚══════════════════════════════════════════════════════════╝\n');

  // Test AI Configuration first
  await testAIConfiguration();
  
  // Then run full tests
  await testAIChatbot();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { testAIChatbot, testAIConfiguration }; 