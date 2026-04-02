// content.js
let audioCtx;
let source;
let filters = [];

// Initialize EQ for a video element
function initEQ(video) {
  if (audioCtx) return;

  audioCtx = new AudioContext();
  source = audioCtx.createMediaElementSource(video);

  // Initially connect directly to destination
  source.connect(audioCtx.destination);
}

// Apply dynamic bands
function updateEQ(bands) {
  if (!audioCtx || !source) return;

  // If filter count changed (add/remove band), rebuild filters
  if (filters.length !== bands.length) {
    try {
      source.disconnect();
      filters.forEach(f => f.disconnect());
    } catch {}

    filters = bands.map(b => {
      const f = audioCtx.createBiquadFilter();
      f.type = "peaking"; // generic EQ band
      f.frequency.value = b.freq;
      f.Q.value = 1;

      // Initialize gain smoothly
      f.gain.setTargetAtTime(b.gain, audioCtx.currentTime, 0.01);

      return f;
    });

    // Connect source → filters → destination
    let node = source;
    filters.forEach(f => {
      node.connect(f);
      node = f;
    });
    node.connect(audioCtx.destination);
  } else {
    // Only update gains smoothly
    bands.forEach((b, i) => {
      if (!filters[i]) return;
      filters[i].gain.setTargetAtTime(b.gain, audioCtx.currentTime, 0.01);
      filters[i].frequency.value = b.freq; // optional: update frequency if band moves horizontally
    });
  }
}

// Helpers to map UI coords → audio values
function xToFrequency(x) {
  const min = 20;
  const max = 20000;
  const canvasWidth = 420; // match your popup canvas width
  const percent = x / canvasWidth;
  return min * Math.pow(max / min, percent);
}

function yToGain(y) {
  const canvasHeight = 260; // match popup canvas height
  return Math.round((canvasHeight / 2 - y) / 3); // same scale as popup
}

// Detect YouTube video element (SPA)
function getVideo() {
  return document.querySelector("video");
}

// Watch for video changes
const observer = new MutationObserver(() => {
  const video = getVideo();
  if (video) initEQ(video);
});

observer.observe(document.body, { childList: true, subtree: true });

// Try immediately in case video already exists
const initialVideo = getVideo();
if (initialVideo) initEQ(initialVideo);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.bands) {
    updateEQ(msg.bands);
  }
});