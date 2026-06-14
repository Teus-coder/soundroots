const recordBtn = document.getElementById('recordBtn');
const status = document.getElementById('status');
const result = document.getElementById('result');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const songOrigin = document.getElementById('songOrigin');
const streamLinks = document.getElementById('streamLinks');
const mediaImage = document.getElementById('mediaImage');
const appearancesDiv = document.getElementById('appearances');
const correctBtn = document.getElementById('correctBtn');
const correctForm = document.getElementById('correctForm');
const correctCancel = document.getElementById('correctCancel');
const correctSubmit = document.getElementById('correctSubmit');
const correctStatus = document.getElementById('correctStatus');
const correctTitle = document.getElementById('correctTitle');
const correctArtist = document.getElementById('correctArtist');

let currentSong = { title: '', artist: ''};
let mediaRecorder;
let audioChunks = [];
let recording = false;

recordBtn.addEventListener('click', toggleRecording);
recordBtn.addEventListener('touchend', (e) => { e.preventDefault(); toggleRecording(); });

async function toggleRecording() {
  if (!recording) {
    await startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  recording = true;
  audioChunks = [];
  status.textContent = '🎤 Humming... press again when done';
  recordBtn.textContent = '⏹ Stop';
  recordBtn.classList.add('recording');
  document.querySelector('.how-it-works').classList.remove('hidden');
  result.classList.add('hidden');
  document.getElementById('otherCandidates').innerHTML = '';
  document.getElementById('appearances').innerHTML = '';

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = sendAudio;
  mediaRecorder.start();
}

function stopRecording() {
  recording = false;
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t => t.stop());
  status.textContent = '⏳ Identifying...';
  recordBtn.textContent = '🎤 Hum a melody';
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

  const sorted = candidates.sort((a, b) => b.score - a.score).slice(0, 5);

  // Priorizar versión de estudio sobre lives, remixes y versiones en otros idiomas
  const preferredKeywords = ['original', 'studio', 'remaster'];
  const avoidKeywords = ['live', 'remix', 'karaoke', 'cover', 'instrumental', 'version', 'mix'];

  const original = sorted.find(c => {
    const titleLower = c.title.toLowerCase();
    const albumLower = (c.album?.name || '').toLowerCase();
    return !avoidKeywords.some(k => titleLower.includes(k) || albumLower.includes(k));
  });

  const best = original || sorted[0];

  // Marcar cuál es el original en los candidatos alternativos
  const others = sorted.filter(c => c !== best);

  applyCorrectionAndDisplay(best, sorted, others);
  gtag('event', 'song_identified', {
    song_title: best.title,
    artist: best.artists?.[0]?.name || 'Unknown'
  });
}

async function fetchOrigin(title, artist, album = '') {
  songOrigin.textContent = '🔍 Looking for origin...';
  mediaImage.classList.add('hidden');
  try {
    const response = await fetch('/origin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist, album })
    });
    const data = await response.json();
    if (data.original_title && data.original_title !== title) {
      songTitle.textContent = data.original_title;
    }
    if (data.original_year) {
      const currentText = songArtist.textContent;
      // Reemplazar el año que puso ACRCloud por el original
      songArtist.textContent = currentText.replace(/· \d{4}/, `· ${data.original_year}`);
    }
    songOrigin.textContent = data.origin;

    if (data.imageUrl) {
      mediaImage.src = data.imageUrl;
      mediaImage.classList.remove('hidden');
    }

    appearancesDiv.innerHTML = '';
    if (data.appearances?.length > 0) {
      appearancesDiv.innerHTML = '<p class="appearances-title">Also appears in:</p>';
      data.appearances.forEach(a => {
        const icon = a.type === 'movie' ? '🎬' : a.type === 'tv' ? '📺' : a.type === 'game' ? '🎮' : a.type === 'advertisement' ? '📢' : '🎵';
        appearancesDiv.innerHTML += `
      <div class="appearance-item">
        <span class="appearance-icon">${icon}</span>
        <span class="appearance-info">
          <span class="appearance-title">${a.title}</span>
          ${a.year ? `<span class="appearance-year">${a.year}</span>` : ''}
          ${a.detail ? `<span class="appearance-detail">${a.detail}</span>` : ''}
        </span>
      </div>`;
      });
    }
  } catch (err) {
    songOrigin.textContent = '🎬 Origin could not be determined';
  }
}

function selectCandidate(c) {
  songTitle.textContent = c.title;
  currentSong = { title: c.title, artist: c.artists?.[0]?.name || '' };
  correctForm.classList.add('hidden');
  const year = c.release_date ? c.release_date.substring(0, 4) : null;
  songArtist.textContent = `by ${c.artists?.[0]?.name || 'Unknown'}` +
    (c.album?.name ? ` · ${c.album.name}` : '') +
    (year ? ` · ${year}` : '');
  fetchOrigin(c.title, c.artists?.[0]?.name || '', c.album?.name || '');
  const spotify = c.external_metadata?.spotify?.track?.id;
  const youtube = c.external_metadata?.youtube?.vid;
  streamLinks.innerHTML = '';
  if (spotify) streamLinks.innerHTML += `<a href="https://open.spotify.com/track/${spotify}" target="_blank">▶ Spotify</a>`;
  if (youtube) streamLinks.innerHTML += `<a href="https://www.youtube.com/watch?v=${youtube}" target="_blank">▶ YouTube</a>`;
  document.getElementById('otherCandidates').innerHTML = '';
}

correctBtn.addEventListener('click', () => {
  correctForm.classList.toggle('hidden');
  correctStatus.textContent = '';
});

correctCancel.addEventListener('click', () => {
  correctForm.classList.add('hidden');
  correctTitle.value = '';
  correctArtist.value = '';
});

correctSubmit.addEventListener('click', async () => {
  const corrected_title = correctTitle.value.trim();
  const corrected_artist = correctArtist.value.trim();

  if (!corrected_title || !corrected_artist) {
    correctStatus.textContent = 'Please fill in both fields';
    return;
  }

  correctStatus.textContent = 'Submitting...';

  try {
    const response = await fetch('/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_title: currentSong.title,
        original_artist: currentSong.artist,
        corrected_title,
        corrected_artist
      })
    });
    const data = await response.json();

    if (data.approved) {
      correctStatus.textContent = '✅ Correction approved! Thanks for helping.';
    } else {
      correctStatus.textContent = `✅ Thanks! ${data.votes} ${data.votes === 1 ? 'vote' : 'votes'} so far.`;
    }

    correctTitle.value = '';
    correctArtist.value = '';
  } catch (err) {
    correctStatus.textContent = '❌ Something went wrong, try again later.';
  }
});
async function applyCorrectionAndDisplay(best, sorted, others) {
  currentSong = { title: best.title, artist: best.artists?.[0]?.name || '' };
  let title = best.title;
  let artist = best.artists?.[0]?.name || 'Unknown';
  try {
    const response = await fetch('/check-correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: best.title, artist: best.artists?.[0]?.name || '' })
    });
    const data = await response.json();
    if (data.correction) {
      title = data.correction.corrected_title;
      artist = data.correction.corrected_artist;
    }
  } catch (e) {
    console.error('Correction check failed:', e);
  }

  songTitle.textContent = title;
  const year = best.release_date ? best.release_date.substring(0, 4) : null;
  songArtist.textContent = `by ${artist}` + (best.album?.name ? ` · ${best.album.name}` : '') + (year ? ` · ${year}` : '');
  fetchOrigin(title, artist, best.album?.name || '');

  const spotify = best.external_metadata?.spotify?.track?.id;
  const youtube = best.external_metadata?.youtube?.vid;
  streamLinks.innerHTML = '';
  if (spotify) streamLinks.innerHTML += `<a href="https://open.spotify.com/track/${spotify}" target="_blank">▶ Spotify</a>`;
  if (youtube) streamLinks.innerHTML += `<a href="https://www.youtube.com/watch?v=${youtube}" target="_blank">▶ YouTube</a>`;

  const othersDiv = document.getElementById('otherCandidates');
  othersDiv.innerHTML = '';
  if (sorted.length > 1) {
    othersDiv.innerHTML = '<p class="others-title">Not what you were looking for?</p>';
    others.forEach(c => {
      const score = Math.round(c.score * 100);
      const candidateArtist = c.artists?.[0]?.name || 'Unknown';
      const isOriginalVersion = c === sorted[0] && c !== best;
      othersDiv.innerHTML += `
        <div class="candidate" onclick="selectCandidate(${JSON.stringify(c).split('"').join("'")})">
          <span class="candidate-title">${c.title}${isOriginalVersion ? ' <span class="original-badge">Original</span>' : ''}</span>
          <span class="candidate-artist">by ${candidateArtist}</span>
          <span class="candidate-score">${score}%</span>
        </div>`;
    });
  }

  document.querySelector('.how-it-works').classList.add('hidden');
  result.classList.remove('hidden');
  status.textContent = '✅ Found!';
}