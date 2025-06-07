const express = require('express');
const router = express.Router();
const GoogleAIService = require('../services/GoogleAIService');

// Get AI chatbot stats
router.get('/stats', async (req, res) => {
  try {
    const stats = GoogleAIService.getStats();
    const isAvailable = GoogleAIService.isAvailable();
    
    res.json({
      success: true,
      message: 'AI chatbot statistics retrieved successfully',
      data: {
        ...stats,
        isAvailable,
        chatbotPhone: process.env.AI_CHATBOT_PHONE || '081220749123',
        model: process.env.GOOGLE_AI_MODEL || 'gemini-1.5-flash'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI chatbot stats',
      error: error.message
    });
  }
});

// Get conversation history for specific phone number
router.get('/history/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const history = GoogleAIService.getHistory(phoneNumber);
    
    res.json({
      success: true,
      message: 'Conversation history retrieved successfully',
      data: {
        phoneNumber,
        history,
        totalMessages: history.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation history',
      error: error.message
    });
  }
});

// Clear conversation history for specific phone number
router.delete('/history/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    GoogleAIService.clearHistory(phoneNumber);
    
    res.json({
      success: true,
      message: `Conversation history cleared for ${phoneNumber}`,
      data: {
        phoneNumber,
        cleared: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear conversation history',
      error: error.message
    });
  }
});

// Clear all conversation history
router.delete('/history', async (req, res) => {
  try {
    GoogleAIService.clearAllHistory();
    
    res.json({
      success: true,
      message: 'All conversation history cleared successfully',
      data: {
        cleared: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear all conversation history',
      error: error.message
    });
  }
});

// Test AI response (manual testing)
router.post('/test', async (req, res) => {
  try {
    const { message, phoneNumber } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }
    
    const testPhoneNumber = phoneNumber || 'test123456789';
    const response = await GoogleAIService.generateResponse(testPhoneNumber, message);
    
    res.json({
      success: true,
      message: 'AI response generated successfully',
      data: {
        userMessage: message,
        aiResponse: response,
        phoneNumber: testPhoneNumber
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI response',
      error: error.message
    });
  }
});

// Check AI service availability
router.get('/health', async (req, res) => {
  try {
    const isAvailable = GoogleAIService.isAvailable();
    
    res.json({
      success: true,
      message: 'AI service health check completed',
      data: {
        isAvailable,
        apiKeyConfigured: !!process.env.GOOGLE_AI_API_KEY,
        model: process.env.GOOGLE_AI_MODEL || 'gemini-1.5-flash',
        chatbotPhone: process.env.AI_CHATBOT_PHONE || '081220749123'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI service health check failed',
      error: error.message
    });
  }
});

module.exports = router; 