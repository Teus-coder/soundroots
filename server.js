require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ACR_HOST = 'identify-eu-west-1.acrcloud.com';
const ACR_ACCESS_KEY = process.env.ACR_ACCESS_KEY;
const ACR_ACCESS_SECRET = process.env.ACR_ACCESS_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function buildSignature() {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `POST\n/v1/identify\n${ACR_ACCESS_KEY}\naudio\n1\n${timestamp}`;
  const signature = crypto.createHmac('sha1', ACR_ACCESS_SECRET)
    .update(Buffer.from(stringToSign, 'utf-8'))
    .digest('base64');
  return { signature, timestamp };
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET') {
    if (req.url === '/' || req.url === '/index.html') {
      serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
    } else if (req.url === '/app.js') {
      serveFile(res, path.join(__dirname, 'app.js'), 'application/javascript');
    } else if (req.url === '/style.css') {
      serveFile(res, path.join(__dirname, 'style.css'), 'text/css');
    } else {
      res.writeHead(404); res.end();
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/identify') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const { signature, timestamp } = buildSignature();
        const audioBuffer = Buffer.from(Buffer.concat(chunks).toString(), 'base64');
        const FormData = (await import('formdata-node')).FormData;
        const form = new FormData();
        form.set('sample', new Blob([audioBuffer]), 'sample.wav');
        form.set('access_key', ACR_ACCESS_KEY);
        form.set('data_type', 'audio');
        form.set('signature_version', '1');
        form.set('signature', signature);
        form.set('sample_bytes', audioBuffer.length);
        form.set('timestamp', timestamp);

        const response = await fetch(`https://${ACR_HOST}/v1/identify`, { method: 'POST', body: form });
        const result = await response.json();
        console.log('ACRCloud response:', JSON.stringify(result, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/origin') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const { title, artist } = JSON.parse(Buffer.concat(chunks).toString());
        console.log(`Looking up origin for: "${title}" by "${artist}"`);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 150,
            messages: [{
              role: 'user',
              content: `The song "${title}" by "${artist}" was identified by humming recognition. In ONE short sentence, tell me if this song is from a movie, TV show, video game, or advertisement. If it's an original song not tied to any of those, say so briefly. Be concise and direct. Examples: "This is the theme from the Pokémon video game series." or "Original song, not tied to any film or show."`
            }]
          })
        });

        const data = await response.json();
        console.log('Claude response:', JSON.stringify(data, null, 2));
        const origin = data.content?.[0]?.text || 'Origin unknown';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ origin }));
      } catch (err) {
        console.error('Origin error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ origin: 'Origin could not be determined' }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(3000, () => console.log('SoundRoots running on http://localhost:3000'));