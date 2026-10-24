// ============================================================
// LUMNICA SKIN MODEL — on-device concern detection
//   1. MediaPipe Face Landmarker finds the face (478 points)
//   2. the same face regions used in training are cropped
//      (spec comes from /models/concerns/labels.json)
//   3. the ONNX model classifies each region patch
//   4. per concern: highest probability over the regions;
//      nothing above the tuned threshold => "clear"
// Trained by ml/train_skin_models.py. The photo never leaves
// the browser.
// ============================================================

const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.wasm.min.mjs';
const MEDIAPIPE_VERSION = '0.10.35'; // same version the training script used
const MEDIAPIPE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const LANDMARKER_MODEL = '/models/face_landmarker.task';
// ?model=<folder> loads a candidate model from /models/<folder> for side-by-side testing.
const MODEL_DIR = `/models/${/^[\w-]+$/.test(new URLSearchParams(location.search).get('model') || '')
  ? new URLSearchParams(location.search).get('model') : 'concerns'}`;
const INPUT_SIZE = 224;
const RESIZE_TO = 255; // training eval transform: Resize(255) then CenterCrop(224)

// Model classes -> wording the backend's dosha engine already understands.
const CONCERN_TEXT = {
  acne: 'acne',
  comedones: 'blackheads and whiteheads',
  dark_spots: 'dark spots',
  pores: 'enlarged pores',
  redness: 'redness',
  wrinkles: 'fine lines and wrinkles',
};

let modelPromise = null;
let landmarkerPromise = null;

function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const ort = await import(ORT_URL);
      // Single thread: multi-threading needs cross-origin isolation headers.
      ort.env.wasm.numThreads = 1;
      const res = await fetch(`${MODEL_DIR}/labels.json`);
      if (!res.ok) throw new Error(`Skin model is not available (${res.status})`);
      const spec = await res.json();
      const session = await ort.InferenceSession.create(`${MODEL_DIR}/${spec.model_file}`, {
        executionProviders: ['wasm'],
      });
      return { ort, session, spec };
    })().catch(err => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_URL}/wasm`);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 2, // 2 so the photo check can ask for one person only
      });
    })().catch(err => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export function preloadSkinModel() {
  return Promise.all([loadModel(), loadLandmarker()]);
}

function sourceSize(source) {
  return {
    w: source.naturalWidth || source.videoWidth || source.width,
    h: source.naturalHeight || source.videoHeight || source.height,
  };
}

/** Square crop boxes for every region, in source pixels (mirrors region_boxes() in training). */
function regionBoxes(points, spec) {
  const [a, b] = spec.face_width_landmarks;
  const faceWidth = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
  const pushFrom = points[spec.push_from_landmark];
  const boxes = {};
  for (const [name, region] of Object.entries(spec.regions)) {
    let cx = region.center.reduce((s, i) => s + points[i].x, 0) / region.center.length;
    let cy = region.center.reduce((s, i) => s + points[i].y, 0) / region.center.length;
    if (region.push) {
      cx += (cx - pushFrom.x) * region.push;
      cy += (cy - pushFrom.y) * region.push;
    }
    const half = (region.size * faceWidth) / 2;
    boxes[name] = { x: cx - half, y: cy - half, side: 2 * half };
  }
  return { boxes, faceWidth };
}

/** Share of skin-coloured pixels (YCbCr rule used in training). */
function skinFraction(ctx, size) {
  const { data } = ctx.getImageData(0, 0, size, size);
  let skin = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cr > 133 && cr < 173 && cb > 77 && cb < 127) skin++;
  }
  return skin / (data.length / 4);
}

const VIEWS = 6;
// FiveCrop offsets inside the 255x255 resize (torchvision order and rounding) + mirrored centre.
const VIEW_OFFSETS = [[0, 0], [31, 0], [0, 31], [31, 31], [16, 16], [16, 16, 'mirror']];

/**
 * Six 224x224 views of one region, as CHW float32 in [0,1] — the same views ml/train_skin_models.py
 * (tta_views) averages over. Returns null if the region is off-image, too small or not mostly skin.
 */
function regionViews(source, box, spec, imgW, imgH) {
  const inside =
    (Math.max(0, Math.min(box.x + box.side, imgW) - Math.max(box.x, 0)) *
      Math.max(0, Math.min(box.y + box.side, imgH) - Math.max(box.y, 0))) /
    (box.side * box.side);
  if (box.side < spec.min_patch_px || inside < 0.8) return null;

  const check = document.createElement('canvas');
  check.width = check.height = 64;
  const checkCtx = check.getContext('2d', { willReadFrequently: true });
  checkCtx.drawImage(source, box.x, box.y, box.side, box.side, 0, 0, 64, 64);
  if (skinFraction(checkCtx, 64) < spec.min_skin_fraction) return null;

  // Whole-pixel crop box, like PIL's crop in training.
  const x0 = Math.round(box.x), y0 = Math.round(box.y);
  const x1 = Math.round(box.x + box.side), y1 = Math.round(box.y + box.side);
  const big = document.createElement('canvas');
  big.width = big.height = RESIZE_TO;
  const bigCtx = big.getContext('2d');
  bigCtx.imageSmoothingQuality = 'high';
  bigCtx.drawImage(source, x0, y0, x1 - x0, y1 - y0, 0, 0, RESIZE_TO, RESIZE_TO);

  const plane = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(VIEWS * 3 * plane);
  const view = document.createElement('canvas');
  view.width = view.height = INPUT_SIZE;
  const ctx = view.getContext('2d', { willReadFrequently: true });
  VIEW_OFFSETS.forEach(([ox, oy, mirror], v) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (mirror) ctx.setTransform(-1, 0, 0, 1, INPUT_SIZE, 0);
    ctx.drawImage(big, ox, oy, INPUT_SIZE, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const base = v * 3 * plane;
    for (let i = 0; i < plane; i++) {
      out[base + i] = data[i * 4] / 255;
      out[base + plane + i] = data[i * 4 + 1] / 255;
      out[base + 2 * plane + i] = data[i * 4 + 2] / 255;
    }
  });
  return out;
}

/**
 * Detect skin concerns on a face photo (img, canvas, video frame or ImageBitmap).
 * Returns { faceFound, concerns: [text], scores: {class: maxProb}, regions: {name: topClass} }.
 */
export async function analyzeFaceSkin(source) {
  const [{ ort, session, spec }, landmarker] = await Promise.all([loadModel(), loadLandmarker()]);
  const { w, h } = sourceSize(source);

  const result = landmarker.detect(source);
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks) return { faceFound: false, reason: 'no_face' };

  const points = landmarks.map(p => ({ x: p.x * w, y: p.y * h }));
  const { boxes, faceWidth } = regionBoxes(points, spec);
  // Same rule as training: face width vs. the image's longer side.
  if (faceWidth < (spec.min_face_fraction ?? 0.15) * Math.max(w, h)) return { faceFound: false, reason: 'face_too_small' };

  // A concern only counts from the regions it was trained on (e.g. wrinkles: forehead and eye
  // corners), each with its own threshold — see ml/tune_aggregation.py.
  const scores = Object.fromEntries(spec.classes.map(c => [c, 0]));
  const regions = {};
  for (const [name, box] of Object.entries(boxes)) {
    const pixels = regionViews(source, box, spec, w, h);
    if (!pixels) continue;
    const output = await session.run({
      [spec.input.name]: new ort.Tensor('float32', pixels, [VIEWS, 3, INPUT_SIZE, INPUT_SIZE]),
    });
    const all = output[spec.output.name].data;
    const n = spec.classes.length;
    const probs = spec.classes.map((_, i) => {
      let sum = 0;
      for (let v = 0; v < VIEWS; v++) sum += all[v * n + i];
      return sum / VIEWS;
    });
    let top = 0;
    spec.classes.forEach((c, i) => {
      if (spec.regions_for?.[c]?.includes(name) ?? true) scores[c] = Math.max(scores[c], probs[i]);
      if (probs[i] > probs[top]) top = i;
    });
    regions[name] = { top: spec.classes[top], probability: Number(probs[top].toFixed(3)), probs: probs.map(p => Number(p.toFixed(4))) };
  }
  if (Object.keys(regions).length === 0) return { faceFound: false, reason: 'no_usable_skin' };

  const thresholdFor = c => spec.concern_thresholds?.[c] ?? spec.face_threshold;
  const concerns = spec.classes
    .filter(c => c !== 'clear' && scores[c] >= thresholdFor(c))
    .sort((a, b) => scores[b] - scores[a]);

  return {
    faceFound: true,
    concerns: concerns.map(c => CONCERN_TEXT[c] || c),
    scores: Object.fromEntries(Object.entries(scores).map(([c, v]) => [c, Number(v.toFixed(3))])),
    regions,
    boxes,
    size: { w, h },
  };
}

// ---------------------------------------------------------------- tone, undertone, oiliness
// Pixel measurements on the same face regions — not trained models. Lighting and camera white
// balance move them, so they are estimates.

function regionPixels(source, box, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, box.x, box.y, box.side, box.side, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

function isSkin(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cr > 133 && cr < 173 && cb > 77 && cb < 127;
}

function toLab(r, g, b) {
  const lin = v => (v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function median(values) {
  const s = [...values].sort((p, q) => p - q);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Skin tone from the Individual Typology Angle (ITA°) of the cheeks, plus a rough undertone. */
function skinTone(source, boxes) {
  const L = [], A = [], B = [];
  for (const name of ['right_cheek', 'left_cheek']) {
    if (!boxes[name]) continue;
    const d = regionPixels(source, boxes[name]);
    for (let i = 0; i < d.length; i += 4) {
      if (!isSkin(d[i], d[i + 1], d[i + 2])) continue;
      const lab = toLab(d[i], d[i + 1], d[i + 2]);
      L.push(lab.L);
      A.push(lab.a);
      B.push(lab.b);
    }
  }
  if (L.length < 200) return null;
  const [l, a, b] = [median(L), median(A), median(B)];
  const ita = (Math.atan2(l - 50, b) * 180) / Math.PI;
  const tone =
    ita > 55 ? 'very light' : ita > 41 ? 'light' : ita > 28 ? 'medium (wheatish)' :
    ita > 10 ? 'tan' : ita > -30 ? 'brown' : 'deep brown';
  // Hue angle: more yellow = warm, more red/pink = cool.
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  const undertone = hue > 62 ? 'warm' : hue < 48 ? 'cool' : a < 9 && b > 14 ? 'olive' : 'neutral';
  return { tone, undertone, ita: Math.round(ita) };
}

/** Share of shiny pixels (bright, low saturation) in a region: the signature of surface oil. */
function shine(source, box) {
  if (!box) return null;
  const d = regionPixels(source, box);
  let bright = 0, total = 0;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const cutoff = Math.max(median(lum) * 1.35, 150);
  for (let i = 0, k = 0; i < d.length; i += 4, k++) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    total++;
    if (lum[k] > cutoff && (max - min) / (max || 1) < 0.35) bright++;
  }
  return bright / total;
}

function oiliness(source, boxes) {
  const tz = [shine(source, boxes.forehead), shine(source, boxes.nose)].filter(v => v !== null);
  const ch = [shine(source, boxes.right_cheek), shine(source, boxes.left_cheek)].filter(v => v !== null);
  if (!tz.length || !ch.length) return null;
  const toScore = f => Math.max(1, Math.min(10, Math.round(2 + f * 60)));
  const t = toScore(tz.reduce((s, v) => s + v, 0) / tz.length);
  const c = toScore(ch.reduce((s, v) => s + v, 0) / ch.length);
  return `T-zone: ${t}/10, Cheeks: ${c}/10`;
}

/**
 * Full on-device skin analysis in the backend's skinData format, or null when no usable face
 * is found (the caller then falls back to the server-side analysis).
 */
export async function analyzeSkinLocally(source) {
  const face = await analyzeFaceSkin(source);
  if (!face.faceFound) return null;
  const tone = skinTone(source, face.boxes);
  return {
    tone: tone?.tone || 'medium',
    undertone: tone?.undertone || 'neutral',
    oiliness: oiliness(source, face.boxes) || 'T-zone: 5/10, Cheeks: 4/10',
    texture: face.concerns.includes('enlarged pores') ? 'visible enlarged pores' : 'smooth, even texture',
    concerns: face.concerns.length ? face.concerns : ['none visible'],
    imageConfidence: Object.keys(face.regions).length >= 4 ? 'high' : 'medium',
    engine: 'on-device',
    _model: { scores: face.scores, regions: face.regions, ita: tone?.ita },
  };
}

// ---------------------------------------------------------------- photo quality check
// Rejects photos the analysis cannot be trusted on, with a plain-language reason. Most real-world
// errors came from photos like these (small/turned faces, dim light, blur), so this is the
// cheapest accuracy gain available without new training data.

// Calibrated on 62 real photos vs. blurred / darkened / shrunk / rotated copies of them
// (good photos: face 0.17-0.43 of frame, brightness >= ~69, sharpness >= ~79).
const QUALITY = {
  minFaceFraction: 0.18, // face width vs. longer image side
  maxYaw: 0.3,           // nose offset from face centre, as a share of face width
  maxRollDeg: 25,
  minBrightness: 55,     // median luminance of face skin, 0-255
  maxClipped: 0.25,      // share of blown-out pixels on the face
  minSharpness: 50,      // variance of the Laplacian on the face, 256px wide
};

function faceCrop(source, points, size = 256) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.max(1, Math.round((size * (y1 - y0)) / Math.max(1, x1 - x0)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, x0, y0, x1 - x0, y1 - y0, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function lightingAndSharpness({ data, width, height }) {
  const gray = new Float32Array(width * height);
  const skinLum = [];
  let clipped = 0, skinCount = 0;
  for (let i = 0, k = 0; i < data.length; i += 4, k++) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    gray[k] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (isSkin(r, g, b)) {
      skinLum.push(gray[k]);
      skinCount++;
      if (Math.max(r, g, b) > 250) clipped++;
    }
  }
  // Variance of the Laplacian: low means few sharp edges, i.e. blur or heavy smoothing filters.
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const k = y * width + x;
      const lap = gray[k - width] + gray[k + width] + gray[k - 1] + gray[k + 1] - 4 * gray[k];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / Math.max(n, 1);
  return {
    brightness: median(skinLum),
    clipped: clipped / Math.max(skinCount, 1),
    sharpness: sumSq / Math.max(n, 1) - mean * mean,
  };
}

/**
 * Check whether a photo is good enough to analyse.
 * Returns { ok, problems: [{ code, message }], metrics }.
 */
export async function checkPhotoQuality(source) {
  const landmarker = await loadLandmarker();
  const { w, h } = sourceSize(source);
  const faces = landmarker.detect(source).faceLandmarks || [];
  if (faces.length === 0) {
    return { ok: false, problems: [{ code: 'no_face', message: "We couldn't find a face. Use a front-facing photo with your whole face visible." }], metrics: {} };
  }
  if (faces.length > 1) {
    return { ok: false, problems: [{ code: 'many_faces', message: 'Please use a photo with only you in it.' }], metrics: {} };
  }
  const pts = faces[0].map(p => ({ x: p.x * w, y: p.y * h }));
  const faceWidth = Math.hypot(pts[234].x - pts[454].x, pts[234].y - pts[454].y);
  const yaw = Math.abs((pts[4].x - (pts[234].x + pts[454].x) / 2) / faceWidth);
  const roll = Math.abs((Math.atan2(pts[263].y - pts[33].y, pts[263].x - pts[33].x) * 180) / Math.PI);
  const metrics = {
    faceFraction: faceWidth / Math.max(w, h),
    yaw,
    roll: Math.min(roll, 180 - roll),
    ...lightingAndSharpness(faceCrop(source, pts)),
  };
  const problems = [];
  if (metrics.faceFraction < QUALITY.minFaceFraction) problems.push({ code: 'too_far', message: 'Move closer: your face should fill most of the photo.' });
  if (metrics.yaw > QUALITY.maxYaw) problems.push({ code: 'turned', message: 'Face the camera straight on.' });
  if (metrics.roll > QUALITY.maxRollDeg) problems.push({ code: 'tilted', message: 'Keep your head level.' });
  if (metrics.brightness < QUALITY.minBrightness) problems.push({ code: 'dark', message: 'The photo is too dark. Face a window or a bright light.' });
  if (metrics.clipped > QUALITY.maxClipped) problems.push({ code: 'glare', message: 'Too much glare on your face. Avoid direct flash or harsh sunlight.' });
  if (metrics.sharpness < QUALITY.minSharpness) problems.push({ code: 'blurry', message: 'The photo looks blurry or filtered. Hold still, and turn off beauty filters.' });
  Object.keys(metrics).forEach(k => { metrics[k] = Number(metrics[k].toFixed(3)); });
  return { ok: problems.length === 0, problems, metrics };
}
