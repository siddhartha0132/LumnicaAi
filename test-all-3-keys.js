require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const KEY_TEXT            = process.env.NVIDIA_API_KEY_TEXT;
const KEY_VISION          = process.env.NVIDIA_API_KEY_VISION;
const KEY_VISION_FALLBACK = process.env.NVIDIA_API_KEY_VISION_FALLBACK;

const MODEL_TEXT            = process.env.NVIDIA_MODEL            || 'meta/llama-4-maverick-17b-128e-instruct';
const MODEL_VISION          = process.env.NVIDIA_VISION_MODEL     || 'meta/llama-3.2-90b-vision-instruct';
const MODEL_VISION_FALLBACK = process.env.NVIDIA_VISION_FALLBACK_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1';

async function fetchImageAsBase64(url) {
  // Use axios with responseType buffer - follows redirects properly
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  const mime = res.headers['content-type']?.split(';')[0] || 'image/jpeg';
  const b64 = Buffer.from(res.data).toString('base64');
  console.log(`   Image fetched: ${(b64.length * 0.75 / 1024).toFixed(1)} KB | mime: ${mime}`);
  return { b64, mime };
}

async function testText() {
  console.log('\n══════════════════════════════════════════');
  console.log(`🟦 TEST 1 — TEXT MODEL: ${MODEL_TEXT}`);
  const res = await axios.post(BASE_URL, {
    model: MODEL_TEXT,
    messages: [{ role: 'user', content: 'Say exactly: NVIDIA TEXT MODEL WORKING' }],
    max_tokens: 50, temperature: 1.0, stream: false,
  }, { headers: { Authorization: `Bearer ${KEY_TEXT}` } });
  console.log(`   ✅ ${res.data.choices[0].message.content.trim()}`);
}

async function testVision(model, key, label, b64, mime) {
  console.log('\n══════════════════════════════════════════');
  console.log(`🟩 ${label}: ${model}`);
  try {
    const res = await axios.post(BASE_URL, {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What do you see in this image? One sentence.' },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      }],
      max_tokens: 100, temperature: 1.0, top_p: 0.01, stream: false,
    }, { headers: { Authorization: `Bearer ${key}` }, timeout: 90000 });
    console.log(`   ✅ ${res.data.choices[0].message.content.trim()}`);
    return true;
  } catch (err) {
    const detail = err.response?.data;
    console.error(`   ❌ Error ${err.response?.status}:`, JSON.stringify(detail).substring(0, 300));
    return false;
  }
}

(async () => {
  console.log('\n🔑 KEY CHECK:');
  console.log(`   TEXT:            ${KEY_TEXT ? '✅' : '❌ MISSING'}`);
  console.log(`   VISION:          ${KEY_VISION ? '✅' : '❌ MISSING'}`);
  console.log(`   VISION_FALLBACK: ${KEY_VISION_FALLBACK ? '✅' : '❌ MISSING'}`);

  try { await testText(); } catch(e) { console.error('Text failed:', e.message); }

  // Use picsum.photos - a reliable image service that returns real JPEGs
  console.log('\n📷 Fetching real test image...');
  const { b64, mime } = await fetchImageAsBase64('https://picsum.photos/id/64/640/480.jpg');

  const v1 = await testVision(MODEL_VISION, KEY_VISION, 'PRIMARY VISION 90B', b64, mime);
  const v2 = await testVision(MODEL_VISION_FALLBACK, KEY_VISION_FALLBACK, 'FALLBACK VISION 8B', b64, mime);

  console.log('\n══════════════════════════════════════════');
  console.log('SUMMARY:');
  console.log(`  Text Model  (llama-4-maverick):      ✅`);
  console.log(`  Vision 90B  (llama-3.2-90b-vision):  ${v1 ? '✅' : '❌'}`);
  console.log(`  Vision 8B   (nemotron-nano-vl-8b):   ${v2 ? '✅' : '❌'}`);
  console.log('══════════════════════════════════════════\n');
})();
