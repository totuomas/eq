let audioCtx;
let source;
let filters = [];
let analyser;
let dataArray;

// Initialize EQ for a video element
function initEQ(video) {
  if (audioCtx) return;

  audioCtx = new AudioContext();
  source = audioCtx.createMediaElementSource(video);

  // Create analyser for visualization
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  // Initially connect source -> analyser -> destination
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Connect filters if any exist
  if (filters.length > 0) {
    let node = source;
    filters.forEach(f => {
      node.connect(f);
      node = f;
    });
    node.connect(analyser);
  }

  // Start sending audio data
  sendAudioData();
}

// Update EQ bands
function updateEQ(bands) {
  if (!audioCtx || !source) return;

  if (filters.length !== bands.length) {
    try {
      source.disconnect();
      filters.forEach(f => f.disconnect());
    } catch {}

    filters = bands.map(b => {
      const f = audioCtx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = b.freq;
      f.Q.value = 1;
      f.gain.setTargetAtTime(b.gain, audioCtx.currentTime, 0.01);
      return f;
    });

    let node = source;
    filters.forEach(f => {
      node.connect(f);
      node = f;
    });
    node.connect(analyser);
  } else {
    bands.forEach((b, i) => {
      if (!filters[i]) return;
      filters[i].gain.setTargetAtTime(b.gain, audioCtx.currentTime, 0.01);
      filters[i].frequency.value = b.freq;
    });
  }
}

// Send audio data to popup
function sendAudioData() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  chrome.runtime.sendMessage({ type: "AUDIO_DATA", data: Array.from(dataArray) });
  requestAnimationFrame(sendAudioData);
}

// Helpers to map UI coords → audio values
function xToFrequency(x) {
  const min = 20;
  const max = 20000;
  const percent = x / 420; // popup canvas width
  return min * Math.pow(max / min, percent);
}

function yToGain(y) {
  const canvasHeight = 260;
  return Math.round((canvasHeight / 2 - y) / 4);
}

// Detect YouTube video
function getVideo() {
  return document.querySelector("video");
}

// Watch for video changes
const observer = new MutationObserver(() => {
  const video = getVideo();
  if (video) initEQ(video);
});

observer.observe(document.body, { childList: true, subtree: true });

const initialVideo = getVideo();
if (initialVideo) initEQ(initialVideo);

// Listen for EQ updates from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.bands) {
    updateEQ(msg.bands);
  }
});

let eqActive = true; // initially active

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TOGGLE_EQ") {
    eqActive = msg.enabled;
    // Connect/disconnect filters dynamically
    if (audioCtx && source) {
      try {
        source.disconnect();
        filters.forEach(f => f.disconnect());
        analyser.disconnect();

        if (eqActive) {
          // Connect filters -> analyser -> destination
          let node = source;
          filters.forEach(f => {
            node.connect(f);
            node = f;
          });
          node.connect(analyser);
        } else {
          // Bypass filters: source -> analyser -> destination
          source.connect(analyser);
        }
        analyser.connect(audioCtx.destination);
      } catch (e) {
        console.error("EQ toggle error:", e);
      }
    }
  }
});