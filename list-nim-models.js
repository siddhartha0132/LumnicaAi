const axios = require('axios');
const apiKey = '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';

async function listModels() {
  try {
    const res = await axios.get('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const models = res.data.data;
    // Filter for vision models
    const visionModels = models.filter(m => m.id.toLowerCase().includes('vision') || m.id.toLowerCase().includes('omni'));
    console.log('Vision Models:');
    visionModels.forEach(m => console.log(' - ' + m.id));
    
    // Also show top 10 general models
    console.log('\nOther Models (sample):');
    models.slice(0, 10).forEach(m => console.log(' - ' + m.id));
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
listModels();
