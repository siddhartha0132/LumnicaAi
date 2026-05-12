require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nvidiaService = require('./services/nvidiaService');

async function runTest() {
  console.log('Testing NVIDIA Vision Model with current .env API key...');
  
  if (!nvidiaService.isConfigured()) {
    console.error('❌ NVIDIA API Key is not configured in .env!');
    return;
  }
  
  console.log('✅ NVIDIA API Key found.');

  // Find the first image in the current directory
  const files = fs.readdirSync(__dirname);
  const imageFile = files.find(f => f.endsWith('.jpg') || f.endsWith('.png'));
  
  if (!imageFile) {
    console.error('❌ No test image (.jpg or .png) found in this directory.');
    return;
  }
  
  console.log(`📸 Found image: ${imageFile}`);
  
  try {
    const imagePath = path.join(__dirname, imageFile);
    const imageBase64 = fs.readFileSync(imagePath).toString('base64');
    const mimeType = imageFile.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    console.log('🚀 Sending image to NVIDIA Nemotron Omni...');
    console.log('⏳ This may take up to 30-60 seconds due to the 4096 thinking budget...');
    
    const result = await nvidiaService.analyzeSkinFromImage(imageBase64, mimeType);
    
    console.log('\n✅ SUCCESS! Parsed Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n❌ ERROR:');
    console.error(err.message || err);
  }
}

runTest();
