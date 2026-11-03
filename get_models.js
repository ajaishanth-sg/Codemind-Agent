const https = require('https');

const options = {
  hostname: 'api.groq.com',
  path: '/openai/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.GROQ_API_KEY || ''}`
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.data) {
        console.log("AVAILABLE MODELS:");
        json.data.forEach(m => console.log(m.id));
      } else {
        console.log("Response:", data);
      }
    } catch (e) {
      console.log("Parse Error:", data);
    }
  });
});
req.on('error', e => console.error(e));
req.end();
