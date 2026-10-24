const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testFlow() {
  console.log('--- STARTING E2E TEST ---');

  // Step 1: analyzeSkin
  console.log('\n1. Testing POST /api/analyzeSkin...');
  const form = new FormData();
  form.append('image', fs.createReadStream('./face.jpg'));

  const skinRes = await axios.post('http://localhost:5001/api/analyzeSkin', form, {
    headers: form.getHeaders(),
  });
  const skinData = skinRes.data.skinData;
  console.log('✅ analyzeSkin SUCCESS:', JSON.stringify(skinData, null, 2));

  // Step 2: generateQuiz
  console.log('\n2. Testing POST /api/generateQuiz...');
  const quizRes = await axios.post('http://localhost:5001/api/generateQuiz', { skinData });
  const questions = quizRes.data.questions;
  console.log(`✅ generateQuiz SUCCESS: Received ${questions.length} questions.`);

  // Step 3: analyzeResults
  console.log('\n3. Testing POST /api/analyzeResults...');
  const answers = questions.map(q => q.options[0]); // Just pick the first option for each
  const resultsRes = await axios.post('http://localhost:5001/api/analyzeResults', {
    skinData,
    answers
  });
  const finalResult = resultsRes.data;
  console.log('✅ analyzeResults SUCCESS! Dosha:', finalResult.dosha.type);
  
  console.log('\n--- E2E TEST COMPLETE ---');
}

testFlow().catch(err => {
  console.error('❌ E2E TEST FAILED:', err.response ? err.response.data : err.message);
});
