require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createClient } = require('@supabase/supabase-js');

const ACR_HOST = 'identify-eu-west-1.acrcloud.com';
const ACR_ACCESS_KEY = process.env.ACR_ACCESS_KEY;
const ACR_ACCESS_SECRET = process.env.ACR_ACCESS_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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
    } else if (req.url === '/cookies.js') {
      serveFile(res, path.join(__dirname, 'cookies.js'), 'application/javascript');
    } else {
      res.writeHead(404); res.end();
    }
    return;
  }

  // Ruta: identificar canción
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

  // Ruta: buscar origen con Claude
  if (req.method === 'POST' && req.url === '/origin') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const { title, artist, album } = JSON.parse(Buffer.concat(chunks).toString());
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
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `The song "${title}" by "${artist}"${album ? ` from the album "${album}"` : ''} was identified by humming recognition. The title may be in a non-original language due to regional indexing.

First, determine the original language of this song. If the provided title is a translation or transliteration and the original song is in English (or another language different from the provided title), use the original title in your response instead.

Respond ONLY with a valid JSON object, no extra text, no markdown, no backticks. Example format:
{
  "original_title": "All Star",
  "original_year": 1999,
  "origin": "One sentence summary of the most well-known origin of this song.",
  "media_type": "movie" | "tv" | "game" | "none",
  "media_title": "Most well-known movie, show or game title, or null if none",
  "media_year": 1994 or null,
  "appearances": [
    { "type": "movie" | "tv" | "game" | "advertisement" | "original", "title": "Title", "year": 1994, "detail": "e.g. opening theme, end credits, background music" }
  ]
}

Always use the original title in original_title field, never a translation. Also determine the original release year of the song, not any remaster or re-release year. Put it in original_year.`
            }]
          })
        });

        const data = await response.json();
        console.log('Claude response:', JSON.stringify(data, null, 2));

        let parsed;
        try {
          const text = data.content?.[0]?.text || '{}';
          parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        } catch (e) {
          parsed = { origin: 'Origin unknown', media_type: 'none', media_title: null, media_year: null };
        }

        let imageUrl = null;

        if (parsed.media_type === 'movie' && parsed.media_title) {
          try {
            const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(parsed.media_title)}&year=${parsed.media_year || ''}`);
            const tmdbData = await tmdbRes.json();
            const poster = tmdbData.results?.[0]?.poster_path;
            if (poster) imageUrl = `https://image.tmdb.org/t/p/w300${poster}`;
          } catch (e) { console.error('TMDB movie error:', e.message); }
        }

        if (parsed.media_type === 'tv' && parsed.media_title) {
          try {
            const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(parsed.media_title)}`);
            const tmdbData = await tmdbRes.json();
            const poster = tmdbData.results?.[0]?.poster_path;
            if (poster) imageUrl = `https://image.tmdb.org/t/p/w300${poster}`;
          } catch (e) { console.error('TMDB tv error:', e.message); }
        }

        if (parsed.media_type === 'game' && parsed.media_title) {
          try {
            const rawgRes = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(parsed.media_title)}&page_size=1`);
            const rawgData = await rawgRes.json();
            const img = rawgData.results?.[0]?.background_image;
            if (img) imageUrl = img;
          } catch (e) { console.error('RAWG error:', e.message); }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          origin: parsed.origin,
          original_title: parsed.original_title || title,
          original_year: parsed.original_year || null,
          imageUrl,
          appearances: parsed.appearances || []
        }));
      } catch (err) {
        console.error('Origin error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ origin: 'Origin could not be determined' }));
      }
    });
    return;
  }

  // Ruta: enviar una corrección
  if (req.method === 'POST' && req.url === '/correct') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const { original_title, original_artist, corrected_title, corrected_artist } = JSON.parse(Buffer.concat(chunks).toString());

        const { data: existing } = await supabase
          .from('corrections')
          .select('*')
          .eq('original_title', original_title)
          .eq('original_artist', original_artist)
          .eq('corrected_title', corrected_title)
          .eq('corrected_artist', corrected_artist)
          .eq('status', 'pending')
          .maybeSingle();

        if (existing) {
          const newVotes = existing.votes + 1;
          const newStatus = newVotes >= 3 ? 'approved' : 'pending';

          await supabase
            .from('corrections')
            .update({ votes: newVotes, status: newStatus })
            .eq('id', existing.id);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, votes: newVotes, approved: newStatus === 'approved' }));
        } else {
          await supabase
            .from('corrections')
            .insert({ original_title, original_artist, corrected_title, corrected_artist });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, votes: 1, approved: false }));
        }
      } catch (err) {
        console.error('Correction error:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Ruta: comprobar si hay una corrección aprobada para una canción
  if (req.method === 'POST' && req.url === '/check-correction') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const { title, artist } = JSON.parse(Buffer.concat(chunks).toString());

        const { data } = await supabase
          .from('corrections')
          .select('corrected_title, corrected_artist')
          .eq('original_title', title)
          .eq('original_artist', artist)
          .eq('status', 'approved')
          .order('votes', { ascending: false })
          .limit(1)
          .maybeSingle();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ correction: data || null }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ correction: null }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(3000, () => console.log('SoundRoots running on http://localhost:3000'));