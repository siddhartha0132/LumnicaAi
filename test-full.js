require('dotenv').config();

const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // may not exist — we'll use node-fetch alternative
const http = require('http');

// ─── INLINE TEST — no server needed ───────────────────────────────────────────

async function runTests() {
  console.log('\n======================================================');
  console.log('  LUMNICA AI — FULL END-TO-END TEST');
  console.log('======================================================\n');

  // ENV CHECK
  console.log('--- ENV CHECK ---');
  const geminiKey = process.env.GEMINI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  console.log('GEMINI_API_KEY :', geminiKey ? `✅ SET (len=${geminiKey.length})` : '❌ MISSING');
  console.log('NVIDIA_API_KEY :', nvidiaKey && nvidiaKey !== 'your_nvidia_api_key_here' ? `✅ SET (len=${nvidiaKey.length})` : '❌ MISSING or placeholder');
  console.log('DEMO_MODE      :', process.env.DEMO_MODE);
  console.log('NODE_ENV       :', process.env.NODE_ENV);
  console.log('');

  // MODULE LOAD CHECK
  console.log('--- MODULE LOAD CHECK ---');
  try {
    require('./config');           console.log('✅ config/index.js');
    require('./utils/logger');     console.log('✅ utils/logger.js');
    require('./middleware/errorHandler'); console.log('✅ middleware/errorHandler.js');
    require('./services/nvidiaService'); console.log('✅ services/nvidiaService.js');
    require('./services/productService'); console.log('✅ services/productService.js');
    require('./services/geminiService'); console.log('✅ services/geminiService.js');
    require('./routes/analyzeSkin');    console.log('✅ routes/analyzeSkin.js');
    require('./routes/analyzeSkinML');  console.log('✅ routes/analyzeSkinML.js');
    require('./routes/generateQuiz');   console.log('✅ routes/generateQuiz.js');
    require('./routes/analyzeResults'); console.log('✅ routes/analyzeResults.js');
  } catch (e) {
    console.error('❌ MODULE LOAD FAILED:', e.message);
    process.exit(1);
  }
  console.log('');

  // TEST 1: Skin Analysis (Gemini Vision)
  console.log('--- TEST 1: Gemini Vision Skin Analysis ---');
  const { analyzeSkinFromImage } = require('./services/geminiService');
  
  // Use a small test image (create a tiny valid JPEG in memory via base64)
  // Using the face photo downloaded earlier
  let testImageBase64, testMimeType;
  const testImagePath = '/tmp/test_face.jpg';
  if (fs.existsSync(testImagePath)) {
    testImageBase64 = fs.readFileSync(testImagePath).toString('base64');
    testMimeType = 'image/jpeg';
    console.log(`Using test image: ${testImagePath} (${Math.round(testImageBase64.length / 1024)}KB base64)`);
  } else {
    console.log('⚠️  No test image at /tmp/test_face.jpg — skipping vision test');
  }

  let skinData;
  if (testImageBase64) {
    try {
      skinData = await analyzeSkinFromImage(testImageBase64, testMimeType);
      console.log('\n✅ SKIN ANALYSIS RESULT (from real photo — NOT hardcoded):');
      console.log(JSON.stringify(skinData, null, 2));
    } catch (e) {
      console.error('❌ Skin analysis failed:', e.message);
      skinData = { tone: 'medium warm', oiliness: 'combination', texture: 'slightly uneven', concerns: ['dark spots'], undertone: 'warm' };
      console.log('Using fallback skinData for next tests');
    }
  } else {
    skinData = { tone: 'medium warm', oiliness: 'combination', texture: 'slightly uneven', concerns: ['dark spots'], undertone: 'warm' };
  }

  console.log('');

  // TEST 2: NVIDIA Analysis (with Gemini fallback)
  console.log('--- TEST 2: NVIDIA NIM analyzeResults ---');
  const nvidiaService = require('./services/nvidiaService');
  const { analyzeResults } = require('./services/geminiService');
  
  const testAnswers = ['B', 'A', 'B', 'B', 'C', 'A'];
  let finalAnalysis;

  if (nvidiaService.isConfigured()) {
    console.log('NVIDIA is configured — calling NVIDIA NIM...');
    try {
      finalAnalysis = await nvidiaService.analyzeResults(skinData, testAnswers);
      console.log('\n✅ NVIDIA ANALYSIS SUCCESS:');
      console.log('  Dosha type:', finalAnalysis.dosha?.type);
      console.log('  Morning steps:', finalAnalysis.routine?.morning?.length || 0);
      console.log('  Night steps:', finalAnalysis.routine?.night?.length || 0);
      console.log('  Products:', finalAnalysis.products?.length || 0);
      console.log('\nFull NVIDIA result:');
      console.log(JSON.stringify(finalAnalysis, null, 2));
    } catch (nvidiaErr) {
      console.warn('⚠️  NVIDIA failed:', nvidiaErr.message);
      console.log('Falling back to Gemini...');
      try {
        finalAnalysis = await analyzeResults(skinData, testAnswers);
        console.log('\n✅ GEMINI FALLBACK SUCCESS:');
        console.log('  Dosha type:', finalAnalysis.dosha?.type);
        console.log(JSON.stringify(finalAnalysis, null, 2));
      } catch (geminiErr) {
        console.error('❌ Gemini fallback also failed:', geminiErr.message);
      }
    }
  } else {
    console.log('NVIDIA not configured — using Gemini directly');
    try {
      finalAnalysis = await analyzeResults(skinData, testAnswers);
      console.log('\n✅ GEMINI ANALYSIS SUCCESS:');
      console.log('  Dosha type:', finalAnalysis.dosha?.type);
    } catch (e) {
      console.error('❌ Gemini failed:', e.message);
    }
  }

  console.log('\n======================================================');
  console.log('  TEST COMPLETE');
  console.log('======================================================\n');
}

runTests().catch(console.error);
