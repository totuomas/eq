const bass = document.getElementById("bass");
const mid = document.getElementById("mid");
const treble = document.getElementById("treble");

let currentTabId = null;

// Get current tab ID first
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTabId = tabs[0].id;

  // Load saved settings for THIS tab
  chrome.storage.local.get([String(currentTabId)], (data) => {
    const settings = data[currentTabId] || {};

    if (settings.bass !== undefined) bass.value = settings.bass;
    if (settings.mid !== undefined) mid.value = settings.mid;
    if (settings.treble !== undefined) treble.value = settings.treble;

    sendEQ(); // apply immediately
  });
});

function sendEQ() {
  if (currentTabId === null) return;

  const settings = {
    bass: bass.value,
    mid: mid.value,
    treble: treble.value
  };

  // Save settings PER TAB
  chrome.storage.local.set({
    [currentTabId]: settings
  });

  // Send to content script
  chrome.tabs.sendMessage(currentTabId, settings);
}

bass.oninput = sendEQ;
mid.oninput = sendEQ;
treble.oninput = sendEQ;