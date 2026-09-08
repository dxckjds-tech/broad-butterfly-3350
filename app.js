const stage = document.getElementById("stage");
const icon = document.getElementById("icon");
const glare = document.getElementById("glare");

const MAX_X = 16;
const MAX_Y = 12;
const REST = "rotateX(10deg) rotateY(-16deg)";

let frame = 0;
let targetX = -16;
let targetY = 10;
let currentX = -16;
let currentY = 10;
let hovering = false;

function setTransform() {
  icon.style.transform = `rotateX(${currentY}deg) rotateY(${currentX}deg)`;
}

function tick() {
  currentX += (targetX - currentX) * 0.12;
  currentY += (targetY - currentY) * 0.12;
  setTransform();
  frame = requestAnimationFrame(tick);
}

stage.addEventListener("pointermove", (event) => {
  hovering = true;
  const rect = stage.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  targetX = (px - 0.5) * MAX_X * 2;
  targetY = (0.5 - py) * MAX_Y * 2;
  glare.style.background = `radial-gradient(180px 140px at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.32), transparent 70%)`;
});

stage.addEventListener("pointerleave", () => {
  hovering = false;
  targetX = -16;
  targetY = 10;
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

if (!hovering) {
  icon.style.transform = REST;
}
