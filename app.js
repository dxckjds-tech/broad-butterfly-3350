const stage = document.getElementById("stage");
const icon = document.getElementById("icon");
const glare = document.getElementById("glare");
const extrusion = document.getElementById("extrusion");

const LAYERS = 24;
for (let i = 1; i <= LAYERS; i += 1) {
  const layer = document.createElement("span");
  const t = i / LAYERS;
  layer.style.transform = `translateZ(${(-i * 38) / LAYERS}px)`;
  layer.style.filter = `brightness(${1 - t * 0.42}) saturate(${1.15 - t * 0.35})`;
  extrusion.appendChild(layer);
}

const MAX_X = 28;
const MAX_Y = 16;
const REST_X = -26;
const REST_Y = 18;

let targetX = REST_X;
let targetY = REST_Y;
let currentX = REST_X;
let currentY = REST_Y;

function tick() {
  currentX += (targetX - currentX) * 0.14;
  currentY += (targetY - currentY) * 0.14;
  icon.style.transform = `rotateX(${currentY}deg) rotateY(${currentX}deg)`;
  requestAnimationFrame(tick);
}

stage.addEventListener("pointermove", (event) => {
  const rect = stage.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  targetX = REST_X + (px - 0.5) * MAX_X * 2;
  targetY = REST_Y + (0.5 - py) * MAX_Y * 2;
  glare.style.background = `linear-gradient(115deg, rgba(255,255,255,${0.18 + px * 0.18}) 0%, rgba(255,255,255,0.05) ${22 + px * 18}%, transparent 55%)`;
});

stage.addEventListener("pointerleave", () => {
  targetX = REST_X;
  targetY = REST_Y;
});

tick();

const compare = document.getElementById("compare");
const beforeClip = document.getElementById("beforeClip");
const handle = document.getElementById("compareHandle");
const range = document.getElementById("compareRange");

function syncCompareWidth() {
  beforeClip.querySelector("img").style.width = `${compare.clientWidth}px`;
}

function setCompare(value) {
  const pct = Number(value);
  beforeClip.style.width = `${pct}%`;
  handle.style.left = `${pct}%`;
}

range.addEventListener("input", (event) => setCompare(event.target.value));
window.addEventListener("resize", syncCompareWidth);
syncCompareWidth();
setCompare(range.value);
