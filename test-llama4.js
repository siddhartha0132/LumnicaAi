const axios = require('axios');
const apiKey = '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';
const model = 'meta/llama-4-maverick-17b-128e-instruct';
const baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

async function test() {
  try {
    const res = await axios.post(baseUrl, {
      model,
      messages: [{ role: 'user', content: 'Say hello world' }],
      max_tokens: 512,
      temperature: 1.0,
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    console.log('Success:', res.data.choices[0].message.content);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
test();
