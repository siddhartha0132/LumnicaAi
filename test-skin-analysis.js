require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nvidiaService = require('./services/nvidiaService');

// ─── Accuracy validation helpers ─────────────────────────────────────────────

const VALID_UNDERTONES = ['warm', 'cool', 'neutral', 'olive'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];
const OILINESS_PATTERN = /T-zone:\s*\d+(\.\d+)?\/10,\s*Cheeks:\s*\d+(\.\d+)?\/10/i;

function validateSkinData(result, label) {
  const issues = [];
  const { inner: skin, imageConfidence } = result;

  // --- Required fields present ---
  if (!skin.tone || skin.tone.trim().length < 3)
    issues.push('tone: missing or too short');

  if (!skin.oiliness || !OILINESS_PATTERN.test(skin.oiliness))
    issues.push(`oiliness: bad format — got "${skin.oiliness}" (expected "T-zone: X/10, Cheeks: Y/10")`);

  if (!skin.texture || skin.texture.trim().length < 3)
    issues.push('texture: missing or too short');

  if (!Array.isArray(skin.concerns) || skin.concerns.length === 0)
    issues.push('concerns: must be a non-empty array');

  if (!VALID_UNDERTONES.includes(skin.undertone))
    issues.push(`undertone: invalid value "${skin.undertone}" (expected: ${VALID_UNDERTONES.join('/')})`);

  if (!VALID_CONFIDENCE.includes(imageConfidence))
    issues.push(`imageConfidence: invalid value "${imageConfidence}"`);

  // --- Accuracy checks: values should be specific, not generic placeholders ---
  if (skin.tone === 'describe shade and evenness')
    issues.push('tone: returned the prompt placeholder, not a real value');

  if (skin.texture === 'describe pores, smoothness, bumps')
    issues.push('texture: returned the prompt placeholder, not a real value');

  if (JSON.stringify(skin.concerns) === '["issue1","issue2"]')
    issues.push('concerns: returned the prompt placeholder, not real values');

  // --- Oiliness range sanity (0–10) ---
  const oilinessNums = skin.oiliness?.match(/\d+(\.\d+)?/g)?.map(Number) || [];
  for (const n of oilinessNums) {
    if (n < 0 || n > 10) issues.push(`oiliness: value ${n} out of 0–10 range`);
  }

  return issues;
}

function printResult(label, result, issues) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📋 ${label}`);
  console.log(`${'─'.repeat(60)}`);
  console.log('  tone          :', result.inner.tone);
  console.log('  oiliness      :', result.inner.oiliness);
  console.log('  texture       :', result.inner.texture);
  console.log('  concerns      :', JSON.stringify(result.inner.concerns));
  console.log('  undertone     :', result.inner.undertone);
  console.log('  imageConfidence:', result.imageConfidence);

  if (issues.length === 0) {
    console.log('\n  ✅ All accuracy checks passed');
  } else {
    console.log(`\n  ❌ ${issues.length} issue(s) found:`);
    issues.forEach(i => console.log(`     • ${i}`));
  }
}

// ─── Main test runner ─────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  LUMNICA AI — SKIN ANALYSIS ACCURACY TEST');
  console.log('══════════════════════════════════════════════════════════\n');

  // 1. Config check
  console.log('1️⃣  Config check');
  console.log('  NVIDIA_API_KEY_VISION        :', process.env.NVIDIA_API_KEY_VISION ? '✅ set' : '❌ missing');
  console.log('  NVIDIA_API_KEY_VISION_FALLBACK:', process.env.NVIDIA_API_KEY_VISION_FALLBACK ? '✅ set' : '❌ missing');
  console.log('  Vision configured            :', nvidiaService.isVisionConfigured() ? '✅ yes' : '❌ no');

  if (!nvidiaService.isVisionConfigured()) {
    console.error('\n❌ Vision not configured — aborting.');
    process.exit(1);
  }

  // 2. Find test image
  console.log('\n2️⃣  Looking for test image...');
  const files = fs.readdirSync(__dirname);
  const imageFile = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

  if (!imageFile) {
    console.error('❌ No test image found in project root. Add a .jpg/.png file.');
    process.exit(1);
  }

  const imagePath = path.join(__dirname, imageFile);
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const mimeType = imageFile.match(/\.png$/i) ? 'image/png' : 'image/jpeg';
  const sizeKB = Math.round(fs.statSync(imagePath).size / 1024);
  console.log(`  Using: ${imageFile} (${sizeKB} KB, ${mimeType})`);

  // 3. Run analysis
  console.log('\n3️⃣  Running skin analysis (primary 90B vision model)...');
  console.log('  ⏳ Please wait, this can take 10–30s...\n');

  let result, elapsed;
  try {
    const t0 = Date.now();
    result = await nvidiaService.analyzeSkinFromImage(imageBase64, mimeType);
    elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✅ Response received in ${elapsed}s`);
  } catch (err) {
    console.error('  ❌ Analysis failed:', err.message);
    process.exit(1);
  }

  // 4. Validate accuracy
  console.log('\n4️⃣  Validating response accuracy...');
  const issues = validateSkinData(result, imageFile);
  printResult(`Analysis of "${imageFile}"`, result, issues);

  // 5. Summary
  console.log('\n══════════════════════════════════════════════════════════');
  if (issues.length === 0) {
    console.log(`  ✅ PASS — analysis is accurate and well-formed (${elapsed}s)`);
  } else {
    console.log(`  ❌ FAIL — ${issues.length} accuracy issue(s) detected`);
  }
  console.log('══════════════════════════════════════════════════════════\n');

  process.exit(issues.length === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
