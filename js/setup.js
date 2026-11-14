const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const infoEl = document.getElementById('infoText');

// resize the actual drawing surface to fill the screen - all game code reads
// canvas.width/canvas.height dynamically, so this "just works" for camera
// centering, HUD placement, and dialogue box sizing at any resolution
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));

// detect touch capability so the on-screen controls read at full opacity on
// phones/tablets and stay faint (but still usable) on desktop
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.body.classList.add('touch');
}
