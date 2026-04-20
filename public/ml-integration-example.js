/**
 * LUMNICA ML Integration Example
 * 
 * This file shows how to integrate the ML engine into your existing app.
 * Copy the relevant parts into your React/Vue/vanilla JS application.
 */

// ============================================================
// EXAMPLE 1: React Component
// ============================================================

/*
import React, { useRef, useState, useEffect } from 'react';
import {
  startCamera,
  stopCamera,
  initFaceMesh,
  runLiveSkinAnalysis
} from './ml-engine.js';

function LiveSkinAnalyzer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [skinData, setSkinData] = useState(null);
  const [status, setStatus] = useState('Click Start to begin');

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        stopCamera(videoRef.current);
      }
    };
  }, []);

  const handleStart = async () => {
    setStatus('Starting camera...');
    const result = await startCamera(videoRef.current);
    
    if (!result.success) {
      setStatus('Camera error: ' + result.error);
      return;
    }
    
    setStatus('Loading face detection...');
    await initFaceMesh();
    
    setIsRunning(true);
    setStatus('Ready! Click Analyze');
  };

  const handleAnalyze = async () => {
    setStatus('Analyzing...');
    
    const result = await runLiveSkinAnalysis(
      videoRef.current,
      canvasRef.current,
      {
        roboflowKey: process.env.REACT_APP_ROBOFLOW_KEY,
        roboflowModel: process.env.REACT_APP_ROBOFLOW_MODEL
      }
    );
    
    if (result.error) {
      setStatus(result.error);
      return;
    }
    
    const { skinData, needsFallback } = result;
    
    if (needsFallback) {
      setStatus('Using Gemini fallback...');
      
      canvasRef.current.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'face.jpg');
        formData.append('mlData', JSON.stringify(skinData));
        
        const response = await fetch('/api/analyzeSkinML', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        setSkinData(data.skinData);
        setStatus('Complete (Gemini fallback)');
      }, 'image/jpeg', 0.8);
    } else {
      setSkinData(skinData);
      setStatus('Complete (on-device ML)');
    }
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <button onClick={handleStart} disabled={isRunning}>
        Start Camera
      </button>
      <button onClick={handleAnalyze} disabled={!isRunning}>
        Analyze
      </button>
      
      <p>{status}</p>
      
      {skinData && (
        <div>
          <h3>Results:</h3>
          <p>Tone: {skinData.fitzpatrick?.tone}</p>
          <p>Oiliness: {skinData.oiliness?.overall}</p>
          <p>Confidence: {(skinData.confidence?.score * 100).toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}

export default LiveSkinAnalyzer;
*/

// ============================================================
// EXAMPLE 2: Vue 3 Component
// ============================================================

/*
<template>
  <div class="skin-analyzer">
    <video ref="videoEl" autoplay playsinline></video>
    <canvas ref="canvasEl" style="display: none"></canvas>
    
    <button @click="startCamera" :disabled="isRunning">Start</button>
    <button @click="analyze" :disabled="!isRunning">Analyze</button>
    
    <p>{{ status }}</p>
    
    <div v-if="skinData">
      <h3>Results:</h3>
      <p>Tone: {{ skinData.fitzpatrick?.tone }}</p>
      <p>Oiliness: {{ skinData.oiliness?.overall }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import {
  startCamera as startCam,
  stopCamera,
  initFaceMesh,
  runLiveSkinAnalysis
} from './ml-engine.js';

const videoEl = ref(null);
const canvasEl = ref(null);
const isRunning = ref(false);
const skinData = ref(null);
const status = ref('Click Start');

const startCamera = async () => {
  status.value = 'Starting...';
  const result = await startCam(videoEl.value);
  
  if (!result.success) {
    status.value = 'Error: ' + result.error;
    return;
  }
  
  await initFaceMesh();
  isRunning.value = true;
  status.value = 'Ready!';
};

const analyze = async () => {
  status.value = 'Analyzing...';
  
  const result = await runLiveSkinAnalysis(
    videoEl.value,
    canvasEl.value
  );
  
  if (result.error) {
    status.value = result.error;
    return;
  }
  
  skinData.value = result.skinData;
  status.value = 'Complete!';
};

onUnmounted(() => {
  if (videoEl.value) {
    stopCamera(videoEl.value);
  }
});
</script>
*/

// ============================================================
// EXAMPLE 3: Vanilla JavaScript (Minimal)
// ============================================================

/*
import {
  startCamera,
  initFaceMesh,
  runLiveSkinAnalysis
} from './ml-engine.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

// Initialize
await startCamera(video);
await initFaceMesh();

// Analyze on button click
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const result = await runLiveSkinAnalysis(video, canvas);
  
  if (result.error) {
    console.error(result.error);
    return;
  }
  
  console.log('Skin data:', result.skinData);
  console.log('Needs fallback:', result.needsFallback);
  
  // Display results
  document.getElementById('results').textContent = 
    JSON.stringify(result.skinData, null, 2);
});
*/

// ============================================================
// EXAMPLE 4: Continuous Analysis (Every 2 seconds)
// ============================================================

/*
import {
  startCamera,
  initFaceMesh,
  runLiveSkinAnalysis
} from './ml-engine.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

await startCamera(video);
await initFaceMesh();

let analysisInterval = null;

function startContinuousAnalysis() {
  analysisInterval = setInterval(async () => {
    const result = await runLiveSkinAnalysis(video, canvas);
    
    if (result.error) {
      console.warn('Analysis skipped:', result.error);
      return;
    }
    
    // Update UI with latest results
    updateUI(result.skinData);
    
    // Only call backend if confidence is low
    if (result.needsFallback) {
      await sendToBackend(result.skinData);
    }
  }, 2000); // Every 2 seconds
}

function stopContinuousAnalysis() {
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
}

function updateUI(skinData) {
  document.getElementById('tone').textContent = skinData.fitzpatrick?.tone;
  document.getElementById('oiliness').textContent = skinData.oiliness?.overall;
  // ... update other fields
}

async function sendToBackend(skinData) {
  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append('image', blob, 'face.jpg');
    formData.append('mlData', JSON.stringify(skinData));
    
    const response = await fetch('/api/analyzeSkinML', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    updateUI(data.skinData);
  }, 'image/jpeg', 0.8);
}

// Start analyzing
startContinuousAnalysis();

// Stop when user leaves
window.addEventListener('beforeunload', () => {
  stopContinuousAnalysis();
});
*/

// ============================================================
// EXAMPLE 5: Error Handling & Retry Logic
// ============================================================

/*
async function robustAnalysis(video, canvas, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const result = await runLiveSkinAnalysis(video, canvas);
      
      if (result.error) {
        if (result.error.includes('No face detected')) {
          // User might have moved, wait and retry
          await new Promise(r => setTimeout(r, 500));
          attempt++;
          continue;
        }
        throw new Error(result.error);
      }
      
      return result;
      
    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed:`, err);
      attempt++;
      
      if (attempt >= maxRetries) {
        throw new Error('Analysis failed after ' + maxRetries + ' attempts');
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Usage
try {
  const result = await robustAnalysis(video, canvas);
  console.log('Success:', result.skinData);
} catch (err) {
  console.error('Final error:', err);
  alert('Please ensure your face is visible and try again');
}
*/

// ============================================================
// EXAMPLE 6: Progressive Enhancement
// ============================================================

/*
async function analyzeWithFallback(video, canvas) {
  // Try ML first
  const mlResult = await runLiveSkinAnalysis(video, canvas);
  
  if (!mlResult.error && !mlResult.needsFallback) {
    // ML worked perfectly
    return {
      data: mlResult.skinData,
      source: 'ml',
      cost: 0
    };
  }
  
  // ML failed or low confidence - try Gemini
  console.log('Falling back to Gemini...');
  
  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', 0.8);
  });
  
  const formData = new FormData();
  formData.append('image', blob, 'face.jpg');
  formData.append('mlData', JSON.stringify(mlResult.skinData || {}));
  
  const response = await fetch('/api/analyzeSkinML', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  
  return {
    data: data.skinData,
    source: 'gemini',
    cost: 0.0025 // ~$0.0025 per image
  };
}

// Usage with cost tracking
let totalCost = 0;

const result = await analyzeWithFallback(video, canvas);
totalCost += result.cost;

console.log('Result:', result.data);
console.log('Source:', result.source);
console.log('Total cost today:', totalCost);
*/

// ============================================================
// EXAMPLE 7: Integration with Existing Upload Flow
// ============================================================

/*
// If you already have an image upload system, you can add ML preprocessing:

async function handleImageUpload(file) {
  // Create temporary video/canvas for ML processing
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  // Try ML analysis on static image
  const video = document.createElement('video');
  video.srcObject = canvas.captureStream();
  
  await initFaceMesh();
  const mlResult = await runLiveSkinAnalysis(video, canvas);
  
  // If ML confidence is good, skip Gemini entirely
  if (!mlResult.error && !mlResult.needsFallback) {
    return mlResult.skinData;
  }
  
  // Otherwise, send to backend as before
  const formData = new FormData();
  formData.append('image', file);
  formData.append('mlData', JSON.stringify(mlResult.skinData || {}));
  
  const response = await fetch('/api/analyzeSkinML', {
    method: 'POST',
    body: formData
  });
  
  return (await response.json()).skinData;
}
*/

console.log('ML Integration examples loaded. Uncomment the example you need!');
