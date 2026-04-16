require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    console.log('Checking API key and available models...\n');
    
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    console.log('✅ API Key is valid!\n');
    console.log('Available models:\n');
    
    response.data.models.forEach(model => {
      console.log(`📦 ${model.name}`);
      console.log(`   Display: ${model.displayName}`);
      console.log(`   Methods: ${model.supportedGenerationMethods.join(', ')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

listModels();
