require('dotenv').config();
const https = require('https');

const API_KEY = process.env.NVIDIA_API_KEY_TEXT;
const BASE_URL = 'integrate.api.nvidia.com';

// Models to test in order of preference
const MODELS_TO_TEST = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'mistralai/mistral-7b-instruct-v0.3',
  'microsoft/phi-3-mini-128k-instruct',
];

function testModel(model) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say: WORKING' }],
      max_tokens: 10,
      temperature: 0.1,
    });

    const options = {
      hostname: BASE_URL,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ model, status: res.statusCode, ok: res.statusCode === 200, data: data.substring(0, 100) });
      });
    });

    req.on('error', (e) => resolve({ model, status: 0, ok: false, data: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ model, status: 0, ok: false, data: 'TIMEOUT' }); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`\n🔑 Testing API Key: ${API_KEY ? API_KEY.substring(0, 20) + '...' : 'NOT SET!'}\n`);
  if (!API_KEY) { console.error('❌ NVIDIA_API_KEY_TEXT not set in .env!'); process.exit(1); }

  const working = [];
  for (const model of MODELS_TO_TEST) {
    process.stdout.write(`  Testing ${model}... `);
    const result = await testModel(model);
    if (result.ok) {
      console.log(`✅ WORKS (${result.status})`);
      working.push(model);
    } else {
      console.log(`❌ FAILED (${result.status}) — ${result.data.substring(0, 60)}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (working.length > 0) {
    console.log(`\n✅ BEST MODEL TO USE: ${working[0]}`);
    console.log(`\n📋 Set this in Render env:\n   NVIDIA_MODEL=${working[0]}\n`);
  } else {
    console.log('\n❌ No models are working with this API key!');
    console.log('   → Check if the API key is valid or has credits.\n');
  }
}

main();
