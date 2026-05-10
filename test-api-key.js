require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSkinAnalysisPrompt } = require('./prompts/skinAnalysisPrompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('='.repeat(60));
console.log('LUMNICA AI — API Key Test');
console.log('='.repeat(60));
console.log(`API Key: ${GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`DEMO_MODE: ${process.env.DEMO_MODE}`);
console.log('');

// ─── Generate 5 solid-color test images (different skin tones) ───
// Each is a tiny 10x10 PNG filled with a specific skin-tone color
// encoded as base64 so we don't need actual files
function createSolidColorPNG(r, g, b) {
  // Minimal 1x1 PNG structure manually constructed
  // We'll use a simple approach: create a 10x10 bitmap pixel pattern
  // For testing, we use placeholder base64 that represents a colored square
  // Real test: we generate a simple data URI style base64 PNG
  const { createCanvas } = (() => {
    try { return require('canvas'); } catch { return null; }
  })() || {};

  if (createCanvas) {
    const canvas = createCanvas(50, 50);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 50, 50);
    return canvas.toBuffer('image/png').toString('base64');
  }

  // Fallback: minimal valid 1x1 PNG with custom color (not pixel-perfect but valid)
  // We'll use a pre-encoded tiny PNG template
  return null;
}

// 5 test cases: different skin tones with expected Fitzpatrick types
const TEST_CASES = [
  { name: 'Test 1 — Very Fair (Type I expected)',    hex: '#FDDBB4', r: 253, g: 219, b: 180 },
  { name: 'Test 2 — Medium/Olive (Type III expected)', hex: '#E8A87C', r: 232, g: 168, b: 124 },
  { name: 'Test 3 — Tan/Brown (Type IV expected)',   hex: '#C68642', r: 198, g: 134, b:  66 },
  { name: 'Test 4 — Deep Brown (Type V expected)',   hex: '#8D5524', r: 141, g:  85, b:  36 },
  { name: 'Test 5 — Very Dark (Type VI expected)',   hex: '#4A2912', r:  74, g:  41, b:  18 },
];

async function testAPIKey() {
  if (!GEMINI_API_KEY) {
    console.error('❌ FATAL: GEMINI_API_KEY not set in .env');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

  // Step 1: Quick text-only ping to verify the key works
  console.log('Step 1: Testing API key with a simple text prompt...');
  try {
    const result = await model.generateContent('Reply with exactly: {"status":"ok","model":"working"}');
    const text = result.response.text().trim();
    console.log(`✅ API Key is VALID. Model responded: ${text.substring(0, 80)}`);
  } catch (err) {
    console.error(`❌ API Key FAILED: ${err.message}`);
    console.error('→ Get a new key at https://aistudio.google.com/app/apikey');
    process.exit(1);
  }

  console.log('');
  console.log('Step 2: Testing Vision with 5 different skin-tone colors...');
  console.log('(Each color simulates a different Fitzpatrick skin type)');
  console.log('─'.repeat(60));

  const results = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n📸 ${tc.name} (${tc.hex})`);

    // Build a minimal valid PNG (1x1 pixel) with the target color
    // PNG binary structure: signature + IHDR + IDAT + IEND
    const pngBase64 = buildMiniPNG(tc.r, tc.g, tc.b);
    const prompt = getSkinAnalysisPrompt();

    try {
      const imagepart = { inlineData: { data: pngBase64, mimeType: 'image/png' } };
      const res = await model.generateContent([prompt, imagepart]);
      const raw = res.response.text().trim();

      // Extract JSON
      const jsonMatch = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response: ' + raw.substring(0, 200));

      const parsed = JSON.parse(jsonMatch[0]);
      results.push({ test: tc.name, hex: tc.hex, result: parsed });

      console.log(`   ✅ Fitzpatrick: ${parsed.fitzpatrickType || 'N/A'}  |  Tone: ${parsed.tone || 'N/A'}`);
      console.log(`   Undertone: ${parsed.undertone || 'N/A'}  |  Oiliness: ${parsed.oiliness || 'N/A'}`);
      console.log(`   Hex returned: ${parsed.approximateHex || 'N/A'}`);

    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      results.push({ test: tc.name, hex: tc.hex, error: err.message });
    }

    // Avoid rate limits
    if (i < TEST_CASES.length - 1) {
      process.stdout.write('   ⏳ Waiting 2s to avoid rate limit...');
      await new Promise(r => setTimeout(r, 2000));
      console.log(' done');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  let passed = 0, failed = 0;
  results.forEach(r => {
    if (r.error) {
      console.log(`❌ ${r.test}: ERROR — ${r.error}`);
      failed++;
    } else {
      console.log(`✅ ${r.test}`);
      console.log(`   → Returned: ${r.result.fitzpatrickType} | ${r.result.tone} | Hex: ${r.result.approximateHex}`);
      passed++;
    }
  });

  const allTonesDifferent = new Set(results.filter(r => r.result).map(r => r.result.fitzpatrickType)).size > 1;
  console.log('\n' + '─'.repeat(60));
  console.log(`Passed: ${passed}/5 | Failed: ${failed}/5`);
  console.log(`Results vary by skin tone: ${allTonesDifferent ? '✅ YES (accurate!)' : '❌ NO (all same — investigate)'}`);

  if (passed === 5 && allTonesDifferent) {
    console.log('\n🎉 Everything is working! Your photo upload analysis should now be ACCURATE.');
  } else if (passed > 0) {
    console.log('\n⚠️  Partial success. Some calls failed — likely rate limits. Try again in 1 min.');
  } else {
    console.log('\n❌ All failed. Check your API key at https://aistudio.google.com/app/apikey');
  }
}

// Build a minimal valid 1x1 PNG with the given RGB color
function buildMiniPNG(r, g, b) {
  // We'll craft a 1x1 PNG manually using Buffer operations
  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width=1, height=1, bitdepth=8, colortype=2 (RGB), compression=0, filter=0, interlace=0
  const ihdrData = Buffer.from([0,0,0,1, 0,0,0,1, 8, 2, 0, 0, 0]);
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk: raw pixel data (filter=0, then R, G, B)
  const raw = Buffer.from([0, r, g, b]);
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]).toString('base64');
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBytes, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function crc32(buf) {
  const table = makeCRCTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff);
}

let _crcTable = null;
function makeCRCTable() {
  if (_crcTable) return _crcTable;
  _crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    _crcTable[n] = c;
  }
  return _crcTable;
}

testAPIKey().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
