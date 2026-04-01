let audioCtx;
let source;

let bassFilter, midFilter, trebleFilter;

// Initialize EQ
function initEQ(video) {
  if (audioCtx) return;

  audioCtx = new AudioContext();
  source = audioCtx.createMediaElementSource(video);

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 100;

  midFilter = audioCtx.createBiquadFilter();
  midFilter.type = "peaking";
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;

  trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = "highshelf";
  trebleFilter.frequency.value = 3000;

  source
    .connect(bassFilter)
    .connect(midFilter)
    .connect(trebleFilter)
    .connect(audioCtx.destination);

  // Apply saved settings after init
  applySavedEQ();
}

function applySavedEQ() {
  chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (tabId) => {
    chrome.storage.local.get([String(tabId)], (data) => {
      const settings = data[tabId] || {};

      bassFilter.gain.value = Number(settings.bass) || 0;
      midFilter.gain.value = Number(settings.mid) || 0;
      trebleFilter.gain.value = Number(settings.treble) || 0;
    });
  });
}

// Detect YouTube video element
function getVideo() {
  return document.querySelector("video");
}

// Watch for video changes (YouTube is SPA)
const observer = new MutationObserver(() => {
  const video = getVideo();
  if (video) {
    initEQ(video);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Also try immediately (in case video already exists)
const initialVideo = getVideo();
if (initialVideo) {
  initEQ(initialVideo);
}

// Listen for popup slider updates
chrome.runtime.onMessage.addListener((msg) => {
  if (!bassFilter) return;

  bassFilter.gain.value = Number(msg.bass) || 0;
  midFilter.gain.value = Number(msg.mid) || 0;
  trebleFilter.gain.value = Number(msg.treble) || 0;
});