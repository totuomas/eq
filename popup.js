const canvas = document.getElementById("eqCanvas");
const ctx = canvas.getContext("2d");

let currentTabId = null;
let draggingPoint = null;

// Initial points
let points = [ { x: 0, y: 80 }, { x: 310, y: 80 }, { x: 620, y: 80 } ];

// Frequency data for bars
let frequencyData = new Array(64).fill(0);

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTabId = tabs[0].id;

  // Load saved points
  chrome.storage.local.get([String(currentTabId), `eqEnabled_${currentTabId}`], (data) => {
    if (data[currentTabId]?.points) {
      points = data[currentTabId].points;
    }

    // Load saved toggle state
    eqEnabled = data[`eqEnabled_${currentTabId}`] ?? false; // default false

    // Update canvas & button
    canvas.classList.toggle("disabled", !eqEnabled);
    toggleBtn.textContent = eqEnabled ? "Disable EQ" : "Enable EQ";

    draw();
    sendEQ();
  });
});

// Receive real-time audio data
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "AUDIO_DATA") {
    frequencyData = msg.data;
  }
});

// Map X → frequency
function xToFrequency(x) {
  const min = 20;
  const max = 20000;
  const percent = x / canvas.width;
  return min * Math.pow(max / min, percent);
}

// Map Y → gain
function yToGain(y) {
  return Math.round((canvas.height / 2 - y) / 2.5);
}

// Send EQ data to content.js
function sendEQ() {
  if (currentTabId === null) return;

  const bands = points.map(p => ({
    freq: xToFrequency(p.x),
    gain: yToGain(p.y)
  }));

  chrome.storage.local.set({ [currentTabId]: { points } });
  chrome.tabs.sendMessage(currentTabId, { bands });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Grid ---
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= canvas.height; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
  for (let i = 0; i <= canvas.width; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }

  // --- Midline ---
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // --- Rainbow bars with visible top, left, and right lines ---
  const barCount = Math.min(frequencyData.length, 50);
  const barWidth = canvas.width / barCount;

  for (let i = 0; i < barCount; i++) {
    const x = i * barWidth;
    const value = frequencyData[i];
    const height = (value / 255) * (canvas.height - 20);

    // Bar fill color
    const hue = (i / barCount) * 360;
    ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.25)`;
    const width = i === barCount - 1 ? canvas.width - x : barWidth;
    ctx.fillRect(x, canvas.height - height, width, height);

    // White lines on top, left, and right (drawn after fill)
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Top line
    ctx.moveTo(x, canvas.height - height);
    ctx.lineTo(x + width, canvas.height - height);

    // Left line (all bars)
    ctx.moveTo(x, canvas.height - height);
    ctx.lineTo(x, canvas.height);

    // Right line
    ctx.moveTo(x + width, canvas.height - height);
    ctx.lineTo(x + width, canvas.height);

    ctx.stroke();
  }

  // --- Smooth curve points using Catmull-Rom ---
  points.sort((a, b) => a.x - b.x);
  const curvePoints = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    for (let t = 0; t <= 1; t += 0.05) {
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * ((2*p1.x) + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3);
      const y = 0.5 * ((2*p1.y) + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3);

      curvePoints.push({ x, y });
    }
  }

  // Include first and last points explicitly
  if (points.length) {
    curvePoints.unshift({ x: points[0].x, y: points[0].y });
    curvePoints.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
  }

  // --- Fill under curve ---
  if (curvePoints.length) {
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, canvas.height / 2);
    curvePoints.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(curvePoints[curvePoints.length - 1].x, canvas.height / 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
    ctx.fill();
  }

  // --- Curve line with glow ---
  if (curvePoints.length) {
    ctx.save();
    ctx.shadowColor = "rgba(0,255,255,0.7)";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
    curvePoints.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  }

  // --- Draw draggable points ---
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = draggingPoint === p ? "#0ff" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  requestAnimationFrame(draw);
}

// --- Mouse events ---
canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  draggingPoint = points.find(p => Math.hypot(p.x - mx, p.y - my) < 12);
});

window.addEventListener("mousemove", e => {
  if (!draggingPoint) return;
  const rect = canvas.getBoundingClientRect();
  let mx = e.clientX - rect.left;
  let my = e.clientY - rect.top;

  // Clamp Y always
  my = Math.max(0, Math.min(canvas.height, my));

  // Clamp X for non-edge points
  if (draggingPoint === points[0]) {
    // first point locked to very left
    mx = 0;
  } else if (draggingPoint === points[points.length - 1]) {
    // last point locked to very right
    mx = canvas.width;
  } else {
    mx = Math.max(0, Math.min(canvas.width, mx));
  }

  draggingPoint.x = mx;
  draggingPoint.y = my;

  points.sort((a, b) => a.x - b.x);
  sendEQ();
});

window.addEventListener("mouseup", () => draggingPoint = null);

// Right-click add/remove
canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const index = points.findIndex(p => Math.hypot(p.x - mx, p.y - my) < 12);
  if (index !== -1 && points.length > 2) points.splice(index, 1);
  else points.push({ x: mx, y: my });
  points.sort((a, b) => a.x - b.x);
  sendEQ();
});

const resetBtn = document.getElementById("resetBtn");
resetBtn.addEventListener("click", () => {
  // Reset points to middle line
  points = [
    { x: 0, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: canvas.width, y: canvas.height / 2 }
  ];
  sendEQ();
});

const presetSelect = document.getElementById("presetSelect");

presetSelect.addEventListener("change", () => {
  const preset = presetSelect.value;
  if (!preset) return;

  switch (preset) {
    case "flat":
      points = [
        { x: 0, y: canvas.height / 2 },
        { x: canvas.width / 2, y: canvas.height / 2 },
        { x: canvas.width, y: canvas.height / 2 }
      ];
      break;
    case "bassBoost":
      points = [
        { x: 0, y: canvas.height / 3 },       // Boost bass
        { x: canvas.width / 2, y: canvas.height / 2 },
        { x: canvas.width, y: canvas.height / 2 }
      ];
      break;
    case "trebleBoost":
      points = [
        { x: 0, y: canvas.height / 2 },
        { x: canvas.width / 2, y: canvas.height / 2 },
        { x: canvas.width, y: canvas.height / 3 } // Boost treble
      ];
      break;
  }

  sendEQ();
});

const toggleBtn = document.getElementById("toggleBtn");
let eqEnabled = false; // default EQ state

toggleBtn.addEventListener("click", () => {
  eqEnabled = !eqEnabled;

  // Save state per tab
  if (currentTabId !== null) {
    chrome.storage.local.set({ [`eqEnabled_${currentTabId}`]: eqEnabled });
  }

  // Update badge
  chrome.action.setBadgeText({ text: eqEnabled ? "on" : "off", tabId: currentTabId });

  // Enable/disable canvas
  canvas.classList.toggle("disabled", !eqEnabled);

  // Notify content script
  if (currentTabId !== null) {
    chrome.tabs.sendMessage(currentTabId, { type: "TOGGLE_EQ", enabled: eqEnabled });
  }
});