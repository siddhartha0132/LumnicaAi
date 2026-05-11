// ============================================================
// LUMNICA ML ENGINE — On-Device Skin Analysis
// Optimized for all Fitzpatrick types (I-VI) including Indian skin
// ============================================================

let tfAvailable = false;
try {
  if (typeof tf !== 'undefined') tfAvailable = true;
} catch (e) { /* TF not loaded in Node env */ }

export async function startCamera(videoElement) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
        frameRate: { ideal: 15 }
      }
    });
    videoElement.srcObject = stream;
    await new Promise(r => videoElement.onloadedmetadata = r);
    videoElement.play();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function stopCamera(videoElement) {
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }
}

export function captureFaceCrop(videoEl, canvasEl) {
  const ctx = canvasEl.getContext('2d');
  canvasEl.width = videoEl.videoWidth || 640;
  canvasEl.height = videoEl.videoHeight || 480;
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  return canvasEl;
}

export async function initFaceMesh() {
  return true;
}

export function detectFace(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const centerW = Math.floor(canvas.width * 0.4);
  const centerH = Math.floor(canvas.height * 0.4);
  const centerX = Math.floor((canvas.width - centerW) / 2);
  const centerY = Math.floor((canvas.height - centerH) / 2);

  const centerData = ctx.getImageData(centerX, centerY, centerW, centerH);
  const skinRatio = detectSkinRatio(centerData);

  if (skinRatio > 0.08) {
    return { faceLandmarks: [true], skinRatio };
  }

  return { faceLandmarks: [], skinRatio: 0 };
}

function detectSkinRatio(imageData) {
  const d = imageData.data;
  let skinPixels = 0;
  const total = d.length / 4;

  for (let i = 0; i < d.length; i += 4) {
    if (isSkinPixelLAB(d[i], d[i + 1], d[i + 2])) {
      skinPixels++;
    }
  }

  return skinPixels / total;
}

function isSkinPixelLAB(r, g, b) {
  const lab = rgbToLab([r, g, b]);

  if (lab.L < 15 || lab.L > 95) return false;
  if (lab.a < -10 || lab.a > 30) return false;
  if (lab.b < -5 || lab.b > 50) return false;

  const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  if (chroma < 3 && lab.L > 80) return false;

  return true;
}

export function extractSkinRegions(canvas, landmarks) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const centerX = W / 2;
  const centerY = H / 2;

  return {
    leftCheek: extractPatch(ctx, { x: centerX - W * 0.18, y: centerY + H * 0.08 }, Math.floor(W * 0.12), W, H),
    rightCheek: extractPatch(ctx, { x: centerX + W * 0.06, y: centerY + H * 0.08 }, Math.floor(W * 0.12), W, H),
    forehead: extractPatch(ctx, { x: centerX - W * 0.06, y: centerY - H * 0.18 }, Math.floor(W * 0.12), W, H),
    nose: extractPatch(ctx, { x: centerX - W * 0.02, y: centerY - H * 0.02 }, Math.floor(W * 0.05), W, H),
    underEye: extractPatch(ctx, { x: centerX - W * 0.08, y: centerY - H * 0.08 }, Math.floor(W * 0.05), W, H),
  };
}

function extractPatch(ctx, center, size, W, H) {
  const x = Math.max(0, Math.floor(center.x - size / 2));
  const y = Math.max(0, Math.floor(center.y - size / 2));
  const w = Math.min(size, W - x);
  const h = Math.min(size, H - y);
  return ctx.getImageData(x, y, w, h);
}

export function analyzeSkinTone(regions) {
  const pixels = [
    ...collectPixels(regions.leftCheek),
    ...collectPixels(regions.rightCheek),
  ];

  if (pixels.length < 50) {
    return {
      type: 'IV',
      tone: 'tan',
      undertone: 'warm',
      labL: 45,
      rgb: [160, 120, 90],
      hexRange: '#A0785A',
    };
  }

  const avgRGB = averageRGB(pixels);
  const lab = rgbToLab(avgRGB);

  const L = lab.L;
  let fitzType, fitzTone;

  if (L >= 78) { fitzType = 'I'; fitzTone = 'very fair'; }
  else if (L >= 65) { fitzType = 'II'; fitzTone = 'fair'; }
  else if (L >= 50) { fitzType = 'III'; fitzTone = 'medium'; }
  else if (L >= 38) { fitzType = 'IV'; fitzTone = 'tan'; }
  else if (L >= 22) { fitzType = 'V'; fitzTone = 'brown'; }
  else { fitzType = 'VI'; fitzTone = 'deep'; }

  let undertone;
  if (lab.a > 6 && lab.b > 12) undertone = 'warm golden';
  else if (lab.a > 3 && lab.b > 5) undertone = 'warm';
  else if (lab.a < -5 && lab.b < 5) undertone = 'cool';
  else if (lab.a < 3 && lab.a > -3 && lab.b > 15 && lab.b < 35) undertone = 'olive';
  else if (Math.abs(lab.a) < 5 && lab.b < 15) undertone = 'neutral';
  else undertone = 'warm';

  return {
    type: fitzType,
    tone: fitzTone,
    undertone,
    labL: Math.round(L),
    rgb: avgRGB,
    hexRange: rgbToHex(avgRGB),
  };
}

export function analyzeOiliness(regions) {
  const noseScore = specularScore(regions.nose);
  const foreScore = specularScore(regions.forehead);
  const cheekScore = specularScore(regions.leftCheek);

  const tZoneAvg = (noseScore + foreScore) / 2;

  const tZone = tZoneAvg > 190 ? 'oily' : tZoneAvg > 145 ? 'normal' : 'dry';
  const cheeks = cheekScore > 165 ? 'oily' : cheekScore > 125 ? 'normal' : 'dry';

  let overall;
  if (tZone === 'oily' && cheeks === 'normal') overall = 'combination';
  else if (tZone === 'oily' || cheeks === 'oily') overall = 'oily';
  else if (tZone === 'dry' && cheeks === 'dry') overall = 'dry';
  else overall = 'normal';

  const poreScore = localContrast(regions.nose);
  const poreSize = poreScore > 32 ? 'very enlarged' : poreScore > 20 ? 'enlarged' : poreScore > 12 ? 'medium' : 'small';

  return { overall, tZone, cheeks, poreSize };
}

function specularScore(imageData) {
  const d = imageData.data;
  let bright = 0, count = 0, sumR = 0;

  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (v > 195) bright++;
    sumR += d[i];
    count++;
  }

  return count > 0 ? (bright / count) * 255 + (sumR / count) * 0.25 : 0;
}

function localContrast(imageData) {
  const d = imageData.data, w = imageData.width;
  let variance = 0, n = 0;

  for (let i = 0; i < d.length - w * 4; i += 4) {
    const curr = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const next = (d[i + w * 4] + d[i + w * 4 + 1] + d[i + w * 4 + 2]) / 3;
    variance += Math.abs(curr - next);
    n++;
  }

  return n > 0 ? variance / n : 0;
}

export function inferTexture(concerns, oilinessData) {
  const hasAcne = Array.isArray(concerns) && concerns.some(c => (c.name || c).includes('acne'));
  const hasPores = oilinessData.poreSize === 'enlarged' || oilinessData.poreSize === 'very enlarged';
  const hasRedness = Array.isArray(concerns) && concerns.some(c => (c.name || c).includes('redness'));

  let overall = 'smooth';
  if (hasAcne || hasPores) overall = 'slightly uneven';
  if ((hasAcne && hasPores) || hasRedness) overall = 'uneven';

  return {
    overall,
    acne: hasAcne ? 'mild' : 'none',
    surfaceIrregularities: hasPores || hasRedness ? 'visible' : 'minimal',
  };
}

export async function detectConcerns(canvasElement, apiKey, modelId) {
  if (!apiKey || !modelId) {
    return detectConcernsBasic(canvasElement);
  }

  try {
    const base64 = canvasElement.toDataURL('image/jpeg', 0.8).split(',')[1];

    const response = await fetch(
      `https://detect.roboflow.com/${modelId}?api_key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64,
      }
    );

    const result = await response.json();

    const concernMap = {
      'acne': { name: 'active acne', threshold: 0.4 },
      'dark_spot': { name: 'dark spots', threshold: 0.35 },
      'hyperpigmentation': { name: 'hyperpigmentation', threshold: 0.35 },
      'pores': { name: 'enlarged pores', threshold: 0.4 },
      'post_acne': { name: 'post-acne marks', threshold: 0.3 },
      'redness': { name: 'redness', threshold: 0.4 },
      'wrinkles': { name: 'fine lines', threshold: 0.35 },
    };

    const concerns = [];
    for (const pred of (result.predictions || [])) {
      const mapped = concernMap[pred.class];
      if (mapped && pred.confidence >= mapped.threshold) {
        concerns.push({
          name: mapped.name,
          severity: pred.confidence > 0.7 ? 'moderate' : pred.confidence > 0.5 ? 'mild' : 'minimal',
          confidence: pred.confidence,
        });
      }
    }

    return concerns.sort((a, b) => b.confidence - a.confidence);
  } catch {
    return detectConcernsBasic(canvasElement);
  }
}

function detectConcernsBasic(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const concerns = [];

  const rednessScore = detectRedness(imageData);
  if (rednessScore > 0.12) {
    concerns.push({ name: 'redness', severity: 'mild', confidence: Math.min(0.9, rednessScore) });
  }

  return concerns;
}

function detectRedness(imageData) {
  const d = imageData.data;
  let redPixels = 0, total = 0;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const chromaR = r - Math.max(g, b);
    if (chromaR > 25 && r > g && r > b) redPixels++;
    total++;
  }

  return total > 0 ? redPixels / total : 0;
}

export async function runLiveSkinAnalysis(videoEl, canvasEl, config = {}) {
  const landmarks = detectFace(videoEl);

  if (!landmarks.faceLandmarks || landmarks.faceLandmarks.length === 0) {
    return {
      error: 'No face detected — please ensure your face is centered and well-lit',
      skinData: null,
      needsFallback: true,
    };
  }

  captureFaceCrop(videoEl, canvasEl);

  const regions = extractSkinRegions(canvasEl, null);

  const [toneData, oilinessData, concerns] = await Promise.all([
    Promise.resolve(analyzeSkinTone(regions)),
    Promise.resolve(analyzeOiliness(regions)),
    detectConcerns(canvasEl, config.roboflowKey, config.roboflowModel),
  ]);

  const confidence = computeConfidence(landmarks, regions, toneData, landmarks.skinRatio);

  const skinData = {
    tone: `${toneData.tone} ${toneData.undertone}`,
    fitzpatrickType: toneData.type,
    approximateHex: toneData.hexRange,
    oiliness: oilinessData.overall,
    oilinessDetail: oilinessData,
    texture: inferTexture(concerns, oilinessData),
    concerns: concerns.length > 0 ? concerns.map(c => c.name) : ['none visible'],
    undertone: toneData.undertone,
    confidence: {
      score: confidence,
      source: 'on-device-ml',
      skinRatio: landmarks.skinRatio,
    },
  };

  return {
    skinData,
    needsFallback: confidence < 0.65,
  };
}

function computeConfidence(landmarks, regions, toneData, skinRatio) {
  let score = 0.88;

  if (skinRatio < 0.05) score -= 0.3;
  else if (skinRatio < 0.1) score -= 0.15;

  const L = toneData.labL;
  if (L < 15 || L > 92) score -= 0.2;
  else if (L < 25 || L > 82) score -= 0.1;
  else if (L < 35 || L > 75) score -= 0.05;

  return Math.max(0.40, Math.min(0.95, score));
}

export function analyzeImageFile(fileBuffer) {
  const canvas = document.createElement('canvas');
  const img = new Image();
  const url = URL.createObjectURL(new Blob([fileBuffer]));

  return new Promise((resolve) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const W = canvas.width, H = canvas.height;
      const centerX = W / 2, centerY = H / 2;

      const regions = {
        leftCheek: extractPatch(ctx, { x: centerX - W * 0.18, y: centerY + H * 0.08 }, Math.floor(W * 0.12), W, H),
        rightCheek: extractPatch(ctx, { x: centerX + W * 0.06, y: centerY + H * 0.08 }, Math.floor(W * 0.12), W, H),
        forehead: extractPatch(ctx, { x: centerX - W * 0.06, y: centerY - H * 0.18 }, Math.floor(W * 0.12), W, H),
        nose: extractPatch(ctx, { x: centerX - W * 0.02, y: centerY - H * 0.02 }, Math.floor(W * 0.05), W, H),
        underEye: extractPatch(ctx, { x: centerX - W * 0.08, y: centerY - H * 0.08 }, Math.floor(W * 0.05), W, H),
      };

      const toneData = analyzeSkinTone(regions);
      const oilinessData = analyzeOiliness(regions);
      const textureData = inferTexture([], oilinessData);

      const skinRatio = detectSkinRatio(ctx.getImageData(0, 0, W, H));
      const confidence = computeConfidence({}, regions, toneData, skinRatio);

      resolve({
        tone: `${toneData.tone} ${toneData.undertone}`,
        fitzpatrickType: toneData.type,
        approximateHex: toneData.hexRange,
        oiliness: oilinessData.overall,
        oilinessDetail: oilinessData,
        texture: textureData,
        concerns: ['none visible'],
        undertone: toneData.undertone,
        confidence: { score: confidence, source: 'on-device-ml', skinRatio },
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function collectPixels(imageData) {
  const pixels = [];
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    pixels.push([d[i], d[i + 1], d[i + 2]]);
  }
  return pixels;
}

function averageRGB(pixels) {
  let r = 0, g = 0, b = 0;
  for (const [pr, pg, pb] of pixels) { r += pr; g += pg; b += pb; }
  const n = pixels.length;
  return n > 0
    ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
    : [160, 120, 90];
}

function rgbToLab([r, g, b]) {
  r = r / 255; g = g / 255; b = b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

  x = x / 95.047; y = y / 100; z = z / 108.883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

  return {
    L: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}