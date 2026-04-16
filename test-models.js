require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelsToTest = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-1.0-pro-vision',
  'models/gemini-1.5-flash-latest',
  'models/gemini-1.5-pro-latest',
  'models/gemini-1.5-flash-001',
  'models/gemini-1.5-pro-001'
];

async function testModel(modelName) {
  try {
    console.log(`\nTesting: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Test with simple text
    const result = await model.generateContent('Say "OK" if you work');
    const response = await result.response;
    const text = response.text();
    
    console.log(`✅ ${modelName} WORKS! Response: ${text.substring(0, 50)}`);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName} FAILED: ${error.message}`);
    return false;
  }
}

async function testAll() {
  console.log('Testing all Gemini models...\n');
  
  for (const modelName of modelsToTest) {
    await testModel(modelName);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec between tests
  }
  
  console.log('\n✅ Testing complete!');
  process.exit(0);
}

testAll();
