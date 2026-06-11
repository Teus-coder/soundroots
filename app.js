const recordBtn = document.getElementById('recordBtn');
const status = document.getElementById('status');
const result = document.getElementById('result');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const songOrigin = document.getElementById('songOrigin');
const streamLinks = document.getElementById('streamLinks');

let mediaRecorder;
let audioChunks = [];
let recording = false;

recordBtn.addEventListener('mousedown', startRecording);
recordBtn.addEventListener('mouseup', stopRecording);
recordBtn.addEventListener('touchstart', startRecording);
recordBtn.addEventListener('touchend', stopRecording);

async function startRecording() {
  if (recording) return;
  recording = true;
  audioChunks = [];
  status.textContent = '🎤 Humming... release when done';
  recordBtn.classList.add('recording');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = sendAudio;
  mediaRecorder.start();
}

function stopRecording() {
  if (!recording) return;
  recording = false;
  mediaRecorder.stop();
  status.textContent = '⏳ Identifying...';
  recordBtn.classList.remove('recording');
}

async function sendAudio() {
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
  
  const arrayBuffer = await audioBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  try {
    const response = await fetch('/identify', {
      method: 'POST',
      body: base64
    });

    const data = await response.json();
    console.log('ACRCloud response:', JSON.stringify(data, null, 2));
    handleResult(data);
  } catch (err) {
    status.textContent = '❌ Connection error. Is the server running?';
    console.error(err);
  }
}

function handleResult(data) {
  if (data.status?.code !== 0) {
    status.textContent = '🤔 No match found. Try humming a bit longer!';
    result.classList.add('hidden');
    return;
  }

  const candidates = data.metadata?.music || data.metadata?.humming || [];
  
  if (candidates.length === 0) {
    status.textContent = '🤔 No match found. Try humming a bit longer!';
    result.classList.add('hidden');
    return;
  }

  const sorted = candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  const best = sorted[0];

  songTitle.textContent = best.title;
  songArtist.textContent = `by ${best.artists?.[0]?.name || 'Unknown'}` + (best.album?.name ? ` · ${best.album.name}` : '');
  fetchOrigin(best.title, best.artists?.[0]?.name || '');

  const spotify = best.external_metadata?.spotify?.track?.id;
  const youtube = best.external_metadata?.youtube?.vid;
  streamLinks.innerHTML = '';
  if (spotify) streamLinks.innerHTML += `<a href="https://open.spotify.com/track/${spotify}" target="_blank">▶ Spotify</a>`;
  if (youtube) streamLinks.innerHTML += `<a href="https://www.youtube.com/watch?v=${youtube}" target="_blank">▶ YouTube</a>`;

  // Otras opciones
  const othersDiv = document.getElementById('otherCandidates');
  othersDiv.innerHTML = '';
  if (sorted.length > 1) {
    othersDiv.innerHTML = '<p class="others-title">Not what you were looking for?</p>';
    sorted.slice(1).forEach(c => {
      const score = Math.round(c.score * 100);
      const artist = c.artists?.[0]?.name || 'Unknown';
      othersDiv.innerHTML += `
        <div class="candidate" onclick="selectCandidate(${JSON.stringify(c).split('"').join("'")})">
          <span class="candidate-title">${c.title}</span>
          <span class="candidate-artist">by ${artist}</span>
          <span class="candidate-score">${score}%</span>
        </div>`;
    });
  }

  result.classList.remove('hidden');
  status.textContent = '✅ Found!';
}

async function fetchOrigin(title, artist) {
  songOrigin.textContent = '🔍 Looking for origin...';
  try {
    const response = await fetch('/origin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist })
    });
    const data = await response.json();
    songOrigin.textContent = data.origin;
  } catch (err) {
    songOrigin.textContent = '🎬 Origin could not be determined';
  }
}

function selectCandidate(c) {
  songTitle.textContent = c.title;
  songArtist.textContent = `by ${c.artists?.[0]?.name || 'Unknown'}` + (c.album?.name ? ` · ${c.album.name}` : '');
  songOrigin.textContent = `🎯 Confidence: ${Math.round(c.score * 100)}%`;
  streamLinks.innerHTML = '';
  document.getElementById('otherCandidates').innerHTML = '';
}