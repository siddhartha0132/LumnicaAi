require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.NVIDIA_API_KEY_VISION;
const ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

const imagePath = path.join(__dirname, 'face.jpg');
const imageBuffer = fs.readFileSync(imagePath);
const imageBase64 = imageBuffer.toString('base64');
const mimeType = 'image/jpeg';

console.log(`\n🔑 API Key: ${API_KEY ? API_KEY.slice(0,12)+'...' : '❌ MISSING'}`);
console.log(`📷 Image: ${(imageBuffer.length / 1024).toFixed(1)} KB as base64`);

async function testModel(model, label) {
  console.log(`\n── Testing ${label} ──`);
  try {
    const res = await axios.post(ENDPOINT, {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in one sentence.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      temperature: 0.7,
      max_tokens: 256,
      stream: false,
    }, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      timeout: 60000,
    });
    console.log('✅ SUCCESS:', res.data.choices?.[0]?.message?.content?.slice(0,200));
  } catch (err) {
    if (err.response) {
      console.log(`❌ HTTP ${err.response.status} — Full body:`, JSON.stringify(err.response.data, null, 2));
    } else {
      console.log('❌ Error:', err.message);
    }
  }
}

(async () => {
  await testModel('moonshotai/kimi-k3', 'Kimi-K3');
  await testModel('meta/llama-3.2-11b-vision-instruct', 'Llama-3.2-11b');
})();
