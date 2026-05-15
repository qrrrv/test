// ===== State =====
let videoInfo = null;
let selectedQuality = '';
let appState = 'idle'; // idle | loading | loaded | downloading | error | success
let progressInterval = null;

// ===== DOM Elements =====
const $ = (id) => document.getElementById(id);

const urlInput    = $('urlInput');
const mainBtn     = $('mainBtn');
const mainBtnText = $('mainBtnText');
const hero        = $('hero');
const platforms   = $('platforms');
const errorBlock  = $('errorBlock');
const errorMsg    = $('errorMsg');
const retryBtn    = $('retryBtn');
const videoBlock  = $('videoBlock');
const thumbImg    = $('thumbImg');
const thumbWrap   = $('thumbWrap');
const durationBadge = $('durationBadge');
const durationText  = $('durationText');
const videoTitle  = $('videoTitle');
const videoUploader = $('videoUploader');
const uploaderText  = $('uploaderText');
const videoDesc   = $('videoDesc');
const qualityGrid = $('qualityGrid');
const downloadBtn = $('downloadBtn');
const downloadBtnText = $('downloadBtnText');
const progressBlock = $('progressBlock');
const progressFill  = $('progressFill');
const successBlock  = $('successBlock');

// ===== API Base =====
// When served from the same Next.js server, use relative paths.
// For standalone, change to the server URL, e.g. 'http://localhost:3000'
const API_BASE = '';

// ===== Helpers =====
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function setState(newState) {
  appState = newState;

  // Input states
  const disabled = newState === 'loading' || newState === 'downloading';
  urlInput.disabled = disabled;

  // Main button
  if (newState === 'loading') {
    mainBtn.disabled = true;
    mainBtnText.textContent = 'Поиск...';
  } else if (newState === 'downloading') {
    mainBtn.disabled = true;
    mainBtnText.textContent = 'Найти';
  } else if (videoInfo) {
    mainBtn.disabled = false;
    mainBtnText.textContent = 'Новый запрос';
  } else {
    mainBtn.disabled = !urlInput.value.trim();
    mainBtnText.textContent = 'Найти';
  }

  // Hero & platforms
  if (videoInfo || newState === 'error') {
    hide(hero);
    hide(platforms);
  } else {
    show(hero);
    show(platforms);
  }

  // Error
  if (newState === 'error') {
    show(errorBlock);
  } else {
    hide(errorBlock);
  }

  // Video block
  if (newState === 'loaded' || newState === 'downloading' || newState === 'success') {
    show(videoBlock);
  } else {
    hide(videoBlock);
  }

  // Download button
  if (newState === 'downloading') {
    downloadBtn.disabled = true;
    downloadBtnText.textContent = `Скачивание...`;
  } else if (newState === 'success') {
    downloadBtn.disabled = false;
    downloadBtnText.textContent = 'Скачано! Скачать ещё раз';
  } else {
    downloadBtn.disabled = !selectedQuality;
    downloadBtnText.textContent = 'Скачать видео';
  }

  // Progress
  if (newState === 'downloading') {
    show(progressBlock);
  } else {
    hide(progressBlock);
  }

  // Success
  if (newState === 'success') {
    show(successBlock);
  } else {
    hide(successBlock);
  }
}

function resetState() {
  videoInfo = null;
  selectedQuality = '';
  urlInput.value = '';
  progressFill.style.width = '0%';
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  setState('idle');
}

// ===== Get Video Info =====
async function getInfo() {
  const url = urlInput.value.trim();
  if (!url) return;

  setState('loading');
  videoInfo = null;
  selectedQuality = '';
  progressFill.style.width = '0%';

  try {
    const res = await fetch(`${API_BASE}/api/video/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось получить информацию');

    videoInfo = data;
    renderVideoInfo(data);
    if (data.qualities?.length > 0) {
      selectedQuality = data.qualities[0].id;
      renderQualities(data.qualities);
    }
    setState('loaded');
  } catch (err) {
    errorMsg.textContent = err.message;
    setState('error');
  }
}

function renderVideoInfo(info) {
  // Thumbnail
  if (info.thumbnail) {
    thumbImg.src = info.thumbnail;
    show(thumbWrap);
  } else {
    hide(thumbWrap);
  }

  // Duration
  if (info.duration > 0) {
    durationText.textContent = formatDuration(info.duration);
    show(durationBadge);
  } else {
    hide(durationBadge);
  }

  // Title
  videoTitle.textContent = info.title || 'Unknown';

  // Uploader
  if (info.uploader) {
    uploaderText.textContent = info.uploader;
    show(videoUploader);
  } else {
    hide(videoUploader);
  }

  // Description
  if (info.description) {
    videoDesc.textContent = info.description;
    show(videoDesc);
  } else {
    hide(videoDesc);
  }
}

function renderQualities(qualities) {
  qualityGrid.innerHTML = '';
  qualities.forEach((q) => {
    const btn = document.createElement('button');
    btn.className = 'quality-btn' + (q.id === selectedQuality ? ' active' : '');
    btn.dataset.id = q.id;

    const isAudio = !q.hasVideo;
    const iconSvg = isAudio
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>`;
    const iconColor = isAudio ? '#2dd4bf' : '#34d399';
    const sizeText = q.filesize ? `<span class="quality-btn-size">${formatFileSize(q.filesize)}</span>` : '';

    btn.innerHTML = `
      <div class="quality-btn-label">
        <span style="color:${iconColor}">${iconSvg}</span>
        ${q.label}
      </div>
      <div>
        <span class="quality-btn-ext">${q.ext.toUpperCase()}</span>
        ${sizeText}
      </div>
      ${q.id === selectedQuality ? '<svg class="quality-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : ''}
    `;

    btn.addEventListener('click', () => {
      selectedQuality = q.id;
      renderQualities(qualities);
      if (appState === 'loaded' || appState === 'success') {
        downloadBtn.disabled = false;
      }
    });

    qualityGrid.appendChild(btn);
  });
}

// ===== Download Video =====
async function downloadVideo() {
  if (!videoInfo || !selectedQuality) return;

  setState('downloading');
  let progress = 0;
  progressFill.style.width = '0%';

  progressInterval = setInterval(() => {
    if (progress >= 90) { clearInterval(progressInterval); return; }
    progress += Math.random() * 12;
    progress = Math.min(progress, 90);
    progressFill.style.width = `${progress}%`;
  }, 400);

  try {
    const quality = videoInfo.qualities.find(q => q.id === selectedQuality);

    const res = await fetch(`${API_BASE}/api/video/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: urlInput.value.trim(),
        formatId: selectedQuality,
        qualityLabel: quality?.label || '',
      }),
    });

    clearInterval(progressInterval);

    if (!res.ok) {
      let errMsg = 'Скачивание не удалось';
      try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
      throw new Error(errMsg);
    }

    progressFill.style.width = '100%';

    // Get filename
    const cd = res.headers.get('Content-Disposition');
    let filename = 'video.mp4';
    if (cd) {
      const match = cd.match(/filename\*=UTF-8''(.+)/);
      if (match) filename = decodeURIComponent(match[1]);
      else {
        const sm = cd.match(/filename="?([^"]+)"?/);
        if (sm) filename = sm[1];
      }
    }

    // Download
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    setState('success');
  } catch (err) {
    clearInterval(progressInterval);
    errorMsg.textContent = err.message;
    setState('error');
  }
}

// ===== Event Listeners =====
mainBtn.addEventListener('click', () => {
  if (videoInfo && appState !== 'loading') {
    resetState();
  } else {
    getInfo();
  }
});

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && appState !== 'loading' && appState !== 'downloading') {
    if (videoInfo) resetState();
    else getInfo();
  }
});

urlInput.addEventListener('input', () => {
  if (!videoInfo) {
    mainBtn.disabled = !urlInput.value.trim();
  }
});

downloadBtn.addEventListener('click', downloadVideo);
retryBtn.addEventListener('click', resetState);

// Initial state
setState('idle');
