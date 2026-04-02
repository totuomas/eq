const canvas = document.getElementById("eqCanvas");
const ctx = canvas.getContext("2d");

let currentTabId = null;
let draggingPoint = null;

// Start with 3 default points
let points = [
  { x: 60, y: 130 },
  { x: 200, y: 130 },
  { x: 340, y: 130 }
];

// Load tab + saved state
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentTabId = tabs[0].id;

  chrome.storage.local.get([String(currentTabId)], (data) => {
    if (data[currentTabId]?.points) {
      points = data[currentTabId].points;
    }

    draw();
    sendEQ();
  });
});

// 🎯 Convert Y ↔ Gain
function yToGain(y) {
  return Math.round((canvas.height / 2 - y) / 3);
}

// 🎯 Convert X → frequency (log scale)
function xToFrequency(x) {
  const min = 20;
  const max = 20000;

  const percent = x / canvas.width;
  return min * Math.pow(max / min, percent);
}

// 🎨 Smooth curve (Catmull-Rom)
function drawSmoothCurve() {
  if (points.length < 2) return;

  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    for (let t = 0; t < 1; t += 0.05) {
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        ((2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      const y =
        0.5 *
        ((2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      if (i === 0 && t === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }

  ctx.stroke();
}

// 🎨 Draw everything
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = "#2a2a2a";
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

  // Mid line (0 dB)
  ctx.strokeStyle = "#444";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // Sort before drawing
  points.sort((a, b) => a.x - b.x);

  drawSmoothCurve();

  // Draw points
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
  });
}

// 🖱 START DRAG
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  draggingPoint = points.find(p =>
    Math.hypot(p.x - mx, p.y - my) < 12
  );
});

// 🖱 DRAGGING
canvas.addEventListener("mousemove", (e) => {
  if (!draggingPoint) return;

  const rect = canvas.getBoundingClientRect();
  let mx = e.clientX - rect.left;
  let my = e.clientY - rect.top;

  // Clamp
  mx = Math.max(0, Math.min(canvas.width, mx));
  my = Math.max(0, Math.min(canvas.height, my));

  draggingPoint.x = mx;
  draggingPoint.y = my;

  // Keep order stable
  points.sort((a, b) => a.x - b.x);

  draw();
  sendEQ();
});

// 🖱 STOP DRAG
canvas.addEventListener("mouseup", () => draggingPoint = null);
canvas.addEventListener("mouseleave", () => draggingPoint = null);

// 🖱 RIGHT CLICK → add/remove
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const index = points.findIndex(p =>
    Math.hypot(p.x - mx, p.y - my) < 12
  );

  if (index !== -1) {
    if (points.length > 2) {
      points.splice(index, 1);
    }
  } else {
    points.push({ x: mx, y: my });
  }

  points.sort((a, b) => a.x - b.x);

  draw();
  sendEQ();
});

// 🚀 Send EQ data
function sendEQ() {
  if (currentTabId === null) return;

  const bands = points.map(p => ({
    freq: xToFrequency(p.x),
    gain: yToGain(p.y)
  }));

  chrome.storage.local.set({
    [currentTabId]: { points }
  });

  chrome.tabs.sendMessage(currentTabId, { bands });
}

// Initial draw
draw();