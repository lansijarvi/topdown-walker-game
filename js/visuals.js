// =====================================================================
// Visual layer: ground textures, scattered decor, street furniture,
// building/tree detailing, night lighting, cloud shadows, interiors.
//
// Pure presentation - nothing here affects collision or game state.
// Everything expensive (textures, sprites, decor placement) is built
// once at load; per frame we only blit what's on screen.
// =====================================================================

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  return [c, c.getContext('2d')];
}

// small seeded RNG so textures/decor come out the same on every load
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickFrom = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// ---------------------------------------------------------------------
// Ground textures (256px seamless tiles, anchored to world coordinates)
// ---------------------------------------------------------------------
const GROUND_TILE = 256;

function makeGroundTile(base, o) {
  const S = GROUND_TILE;
  const [c, g] = makeCanvas(S, S);
  const rnd = seededRandom(o.seed);
  const wrap = fn => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);

  // soft mottling so the base color isn't one flat sheet
  for (let i = 0; i < (o.blotches || 50); i++) {
    const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 30;
    const light = rnd() < (o.lightBias ?? 0.45);
    let col = light ? `rgba(255,250,200,${(0.03 + rnd() * 0.04).toFixed(3)})` : `rgba(0,15,0,${(0.05 + rnd() * 0.06).toFixed(3)})`;
    if (o.blotchColor && rnd() < 0.35) col = o.blotchColor;
    // soft-edged so they read as mottling, not polka dots
    wrap((dx, dy) => {
      const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grad.addColorStop(0, col); grad.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = grad; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }

  // blades / needles / grit
  g.lineCap = 'round';
  for (let i = 0; i < (o.blades || 0); i++) {
    const x = rnd() * S, y = rnd() * S;
    const len = (o.bladeLen || 4) * (0.5 + rnd());
    const ang = o.anyAngle ? rnd() * Math.PI * 2 : -Math.PI / 2 + (rnd() - 0.5) * 0.9;
    g.strokeStyle = pickFrom(rnd, o.bladeColors);
    g.globalAlpha = 0.15 + rnd() * 0.25;
    g.lineWidth = o.bladeWidth || 1;
    wrap((dx, dy) => {
      g.beginPath(); g.moveTo(x + dx, y + dy);
      g.lineTo(x + dx + Math.cos(ang) * len, y + dy + Math.sin(ang) * len); g.stroke();
    });
  }
  g.globalAlpha = 1;

  // pebbles
  for (let i = 0; i < (o.pebbles || 0); i++) {
    const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * (o.pebbleSize || 2.5);
    const col = pickFrom(rnd, o.pebbleColors || ['#7a7a70', '#5a5a52', '#8a8478']);
    wrap((dx, dy) => {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(x + dx + 0.6, y + dy + 0.8, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.ellipse(x + dx, y + dy, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
    });
  }

  // tiny flower dots
  for (let i = 0; i < (o.flowers || 0); i++) {
    const x = rnd() * S, y = rnd() * S;
    const col = pickFrom(rnd, ['#e8e4d6', '#e6d690']);
    wrap((dx, dy) => { g.fillStyle = col; g.fillRect(x + dx, y + dy, 2, 2); });
  }
  return g.createPattern(c, 'repeat');
}

// big low-frequency light/dark patches, drawn at 3x scale over the ground
// so the 256px tiles never visibly repeat
function makeMacroTile() {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  const rnd = seededRandom(991);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, r = 40 + rnd() * 110;
    const light = rnd() < 0.5;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grad.addColorStop(0, light ? 'rgba(255,255,210,0.035)' : 'rgba(0,20,10,0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  return g.createPattern(c, 'repeat');
}

const GROUND_PATTERNS = {
  rock: makeGroundTile('#6a6a62', { seed: 11, blotches: 40, pebbles: 260, pebbleSize: 3, blades: 120, bladeLen: 3, bladeColors: ['#5a6a4a', '#4a5a3e'] }),
  forest: makeGroundTile('#3a4a2e', { seed: 12, blotches: 70, lightBias: 0.3, blotchColor: 'rgba(70,50,25,0.12)', blades: 1500, bladeLen: 4, anyAngle: true, bladeColors: ['#5a4a2a', '#2c3a22', '#4a5a34', '#6a5a36', '#25301c'], pebbles: 25 }),
  grass: makeGroundTile('#4a7c3c', { seed: 13, blotches: 60, blades: 1600, bladeLen: 4.5, bladeColors: ['#3a6a2e', '#5c9248', '#2f5a26', '#6aa055', '#447a36'], flowers: 0 }),
  park: makeGroundTile('#3f7538', { seed: 14, blotches: 60, blades: 1800, bladeLen: 4.5, bladeColors: ['#336a2c', '#579046', '#2a5a24', '#64a052'], flowers: 0 }),
  country: makeGroundTile('#5a8a4a', { seed: 15, blotches: 60, blades: 1500, bladeLen: 5, bladeColors: ['#4a7a3a', '#6e9e58', '#3e6a30', '#7aac62', '#8a9a4a'], flowers: 2 }),
  south: makeGroundTile('#52564a', { seed: 16, blotches: 70, lightBias: 0.3, blotchColor: 'rgba(90,75,50,0.14)', blades: 700, bladeLen: 3.5, bladeColors: ['#6a6a50', '#45493d', '#7a7458', '#5a6044'], pebbles: 60, pebbleColors: ['#6a665a', '#4a4840'] })
};
const MACRO_PATTERN = makeMacroTile();

// fill a screen-space rect with a world-anchored pattern
function fillWorldPattern(pattern, camX, camY, x, y, w, h, scale) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.translate(-camX, -camY);
  if (scale) ctx.scale(scale, scale);
  ctx.fillStyle = pattern;
  const s = scale || 1;
  ctx.fillRect((x + camX) / s, (y + camY) / s, w / s, h / s);
  ctx.restore();
}

// replaces the old flat color bands + grid + speckle
function drawGroundLayer(camX, camY) {
  const bands = [
    { y0: WORLD_TOP, y1: MOUNTAIN_Y, p: 'rock' },
    { y0: MOUNTAIN_Y, y1: 0, p: 'forest' },
    { y0: 0, y1: RIVER_Y + RIVER_H, p: 'grass' },
    { y0: RIVER_Y + RIVER_H, y1: WORLD_H, p: 'south' }
  ];
  bands.forEach(band => {
    const top = Math.max(0, band.y0 - camY);
    const bottom = Math.min(canvas.height, band.y1 - camY);
    if (bottom > top) fillWorldPattern(GROUND_PATTERNS[band.p], camX, camY, 0, top, canvas.width, bottom - top);
  });
  // country west of downtown
  const westRight = Math.min(canvas.width, 0 - camX);
  if (westRight > 0) {
    const cTop = Math.max(0, 0 - camY);
    const cBottom = Math.min(canvas.height, WORLD_H - camY);
    if (cBottom > cTop) fillWorldPattern(GROUND_PATTERNS.country, camX, camY, 0, cTop, westRight, cBottom - cTop);
  }
  fillWorldPattern(MACRO_PATTERN, camX, camY, 0, 0, canvas.width, canvas.height, 3);
}

// ---------------------------------------------------------------------
// Decor sprites (pre-rendered once; anchor = bottom-center)
// ---------------------------------------------------------------------
function makeSprite(w, h, draw) {
  const [c, g] = makeCanvas(w, h);
  draw(g, w, h);
  return { c, ax: w / 2, ay: h - 3 };
}
function groundShadow(g, cx, cy, rx, ry, a) {
  g.fillStyle = `rgba(0,0,0,${a || 0.22})`;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

const DECOR_SPRITES = (() => {
  const S = {};
  const rnd = seededRandom(4242);

  const tuft = (colors, h) => makeSprite(16, h + 4, (g, w, H) => {
    g.lineCap = 'round';
    const n = 5 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const bx = w / 2 + (rnd() - 0.5) * 7;
      const lean = (rnd() - 0.5) * 7;
      const hh = h * (0.55 + rnd() * 0.45);
      g.strokeStyle = pickFrom(rnd, colors);
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(bx, H - 3);
      g.quadraticCurveTo(bx + lean * 0.3, H - 3 - hh * 0.6, bx + lean, H - 3 - hh); g.stroke();
    }
  });
  S.tuft = [0, 1, 2, 3].map(() => tuft(['#2f5f26', '#4f8a3e', '#3d7232', '#62a04e'], 9));
  S.tuftCountry = [0, 1, 2].map(() => tuft(['#4a7a3a', '#76a85c', '#5a8c44', '#8aa850'], 10));
  S.tuftForest = [0, 1, 2].map(() => tuft(['#2a4022', '#3c5a2c', '#4a6a34'], 10));
  S.dryWeed = [0, 1, 2].map(() => tuft(['#8a7a4a', '#6a6040', '#a08a54', '#5a5a3a'], 11));

  S.flowers = ['#e8e4d6', '#e6d690', '#c8bcd8'].map(col => makeSprite(26, 20, (g, w, h) => {
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const fx = 5 + rnd() * (w - 10), fy = 5 + rnd() * (h - 10);
      g.strokeStyle = '#3a6a2e'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(fx, fy + 1); g.lineTo(fx, fy + 4); g.stroke();
      g.fillStyle = col;
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2;
        g.beginPath(); g.arc(fx + Math.cos(a) * 1.7, fy + Math.sin(a) * 1.7, 1.4, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = col === '#f6d955' ? '#c07a20' : '#f8d040';
      g.fillRect(fx - 0.6, fy - 0.6, 1.4, 1.4);
    }
  }));

  S.rock = [5, 7, 10].map(r => makeSprite(r * 2 + 8, r * 1.6 + 8, (g, w, h) => {
    const cx = w / 2, cy = h - 3 - r * 0.6;
    groundShadow(g, cx + 1.5, h - 4, r + 1, r * 0.45, 0.28);
    g.fillStyle = '#7a7a72';
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5e5e58';
    g.beginPath(); g.ellipse(cx + r * 0.25, cy + r * 0.2, r * 0.75, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.3, r * 0.4, r * 0.22, -0.3, 0, Math.PI * 2); g.fill();
  }));

  const bush = (r, base) => makeSprite(r * 2 + 10, r * 1.8 + 8, (g, w, h) => {
    const cx = w / 2, cy = h - 4 - r * 0.75;
    groundShadow(g, cx + 3, h - 4, r + 2, r * 0.4, 0.3);
    const blobs = [[0, 0, 1], [-0.55, 0.15, 0.7], [0.55, 0.15, 0.7], [-0.25, -0.35, 0.7], [0.3, -0.3, 0.65]];
    g.fillStyle = shadeColor(base, -14);
    blobs.forEach(([bx, by, s]) => { g.beginPath(); g.arc(cx + bx * r, cy + by * r, r * s * 0.72 + 1.2, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = base;
    blobs.forEach(([bx, by, s]) => { g.beginPath(); g.arc(cx + bx * r, cy + by * r, r * s * 0.72, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = shadeColor(base, 14);
    g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.4, r * 0.32, 0, Math.PI * 2); g.fill();
    g.fillStyle = shadeColor(base, 26);
    g.beginPath(); g.arc(cx - r * 0.4, cy - r * 0.5, r * 0.14, 0, Math.PI * 2); g.fill();
  });
  S.bush = [bush(9, '#3a6e30'), bush(12, '#2f6230'), bush(14, '#457a36')];
  S.bushFlower = [bush(11, '#3a6e30'), bush(13, '#2f6230')].map(sp => {
    const g = sp.c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      g.fillStyle = pickFrom(rnd, ['#e8e4d6', '#e6d690']);
      g.beginPath(); g.arc(sp.c.width * (0.25 + rnd() * 0.5), sp.c.height * (0.2 + rnd() * 0.45), 1.6, 0, Math.PI * 2); g.fill();
    }
    return sp;
  });
  S.bushForest = [bush(11, '#2a4a24'), bush(14, '#33552a')];
  S.bushDry = [bush(9, '#5a6038'), bush(11, '#6a6a40')];

  S.fern = [0, 1].map(() => makeSprite(30, 22, (g, w, h) => {
    const cx = w / 2, cy = h - 5;
    groundShadow(g, cx + 2, cy + 1, 11, 3, 0.2);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI + (rnd() - 0.5) * 0.2;
      const len = 9 + rnd() * 5;
      g.strokeStyle = i % 2 ? '#3f6e30' : '#4f8a3a';
      g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.9 - 2, cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.7);
      g.stroke();
    }
  }));

  S.log = [makeSprite(44, 16, (g, w, h) => {
    groundShadow(g, w / 2 + 2, h - 4, 19, 3.5, 0.3);
    g.fillStyle = '#5a3c22';
    g.beginPath(); g.roundRect(4, 3, w - 10, 9, 4); g.fill();
    g.fillStyle = '#6e4a2c';
    g.fillRect(6, 4, w - 14, 3);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    for (let x = 10; x < w - 10; x += 7) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 3, 10); g.stroke(); }
    g.fillStyle = '#b08a5a';
    g.beginPath(); g.ellipse(w - 6, 7.5, 2.5, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a5a34';
    g.beginPath(); g.ellipse(w - 6, 7.5, 1.2, 2.4, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#4a7a34';
    g.beginPath(); g.arc(14, 4, 2.5, 0, Math.PI * 2); g.arc(19, 3.5, 2, 0, Math.PI * 2); g.fill();
  })];

  S.mushroom = ['#c8402e', '#c89a5a'].map(cap => makeSprite(16, 14, (g, w, h) => {
    [[5, 0], [10, 2]].forEach(([mx, off], i) => {
      const s = i ? 0.75 : 1;
      groundShadow(g, mx + 1, h - 4, 3 * s, 1.2, 0.25);
      g.fillStyle = '#efe6d0';
      g.fillRect(mx - 1, h - 9 * s - 3 + off, 2.2, 6 * s);
      g.fillStyle = cap;
      g.beginPath(); g.ellipse(mx, h - 9 * s - 3 + off, 4 * s, 2.8 * s, 0, Math.PI, 0); g.fill();
      if (cap === '#c8402e') { g.fillStyle = '#fff'; g.fillRect(mx - 1.5, h - 11 * s - 2 + off, 1.2, 1.2); }
    });
  }));

  S.leaves = [0, 1, 2].map(() => makeSprite(28, 20, (g, w, h) => {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = pickFrom(rnd, ['#a8642a', '#c8902e', '#8a4a22', '#b8a040', '#6a5a2a']);
      g.save(); g.translate(3 + rnd() * (w - 6), 3 + rnd() * (h - 6)); g.rotate(rnd() * Math.PI);
      g.beginPath(); g.ellipse(0, 0, 2.6, 1.3, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }));

  S.litter = [
    makeSprite(14, 10, (g) => { g.save(); g.translate(7, 5); g.rotate(0.4); g.fillStyle = '#e8e4d8'; g.fillRect(-4, -3, 8, 6); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-4, 0, 8, 1); g.restore(); }),
    makeSprite(12, 10, (g) => { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3, 6, 7, 2); g.fillStyle = '#9aa0a8'; g.fillRect(2, 3, 7, 4); g.fillStyle = '#c84a3a'; g.fillRect(4, 3, 3, 4); }),
    makeSprite(14, 10, (g) => { g.fillStyle = '#6a8a5a'; g.beginPath(); g.ellipse(7, 6, 5, 2, 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(5, 5, 3, 1); })
  ];
  return S;
})();

// street furniture sprites (h = horizontal sidewalk, v = vertical)
const PROP_SPRITES = (() => {
  const P = {};
  P.benchH = makeSprite(34, 20, (g, w, h) => {
    groundShadow(g, w / 2 + 2, h - 4, 15, 3, 0.3);
    g.fillStyle = '#2a2a2a'; g.fillRect(5, 8, 3, 9); g.fillRect(w - 8, 8, 3, 9);
    g.fillStyle = '#7a5434'; g.fillRect(3, 9, w - 6, 5);
    g.fillStyle = '#8f6440'; g.fillRect(3, 3, w - 6, 4);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(3, 3, w - 6, 1);
  });
  P.benchV = makeSprite(14, 34, (g, w, h) => {
    groundShadow(g, w / 2 + 2, h - 4, 6, 4, 0.3);
    g.fillStyle = '#2a2a2a'; g.fillRect(2, 5, 2, h - 9); g.fillRect(w - 4, 5, 2, h - 9);
    g.fillStyle = '#7a5434'; g.fillRect(3, 3, 6, h - 8);
    g.fillStyle = '#8f6440'; g.fillRect(9, 3, 3, h - 8);
  });
  P.trash = makeSprite(16, 20, (g, w, h) => {
    groundShadow(g, w / 2 + 1.5, h - 4, 6, 2.5, 0.3);
    g.fillStyle = '#3c4a3c'; g.fillRect(3, 6, 10, 11);
    g.fillStyle = '#4e604e'; g.fillRect(3, 6, 3, 11);
    g.fillStyle = '#2a342a'; g.beginPath(); g.ellipse(8, 6, 6, 2.5, 0, 0, Math.PI * 2); g.fill();
  });
  P.hydrant = makeSprite(14, 18, (g, w, h) => {
    groundShadow(g, w / 2 + 1.5, h - 4, 5, 2, 0.3);
    g.fillStyle = '#c8322a'; g.fillRect(4, 6, 6, 9);
    g.fillRect(2, 9, 10, 3);
    g.fillStyle = '#e8584a'; g.fillRect(4, 6, 2, 9);
    g.fillStyle = '#9a2420'; g.beginPath(); g.arc(7, 6, 3.5, Math.PI, 0); g.fill();
  });
  P.planter = makeSprite(24, 30, (g, w, h) => {
    groundShadow(g, w / 2 + 2, h - 4, 10, 3, 0.3);
    g.fillStyle = '#8a7a66'; g.fillRect(3, h - 13, w - 6, 10);
    g.fillStyle = '#a0907a'; g.fillRect(3, h - 13, w - 6, 3);
    g.fillStyle = '#3d6e34';
    [[12, 10, 8], [7, 13, 5], [17, 13, 5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#5a9248'; g.beginPath(); g.arc(10, 8, 3.5, 0, Math.PI * 2); g.fill();
    
  });
  P.newsbox = makeSprite(14, 20, (g, w, h) => {
    groundShadow(g, w / 2 + 1.5, h - 4, 6, 2, 0.3);
    g.fillStyle = '#2a5a9a'; g.fillRect(2, 4, 10, 13);
    g.fillStyle = '#d8e0e8'; g.fillRect(3, 6, 8, 5);
    g.fillStyle = '#1a3a6a'; g.fillRect(2, 4, 10, 2);
  });
  return P;
})();

// ---------------------------------------------------------------------
// Decor placement (once, at load), bucketed for fast on-screen lookup
// ---------------------------------------------------------------------
const DECOR_BUCKET = 256;
const DECOR_BUCKETS = new Map();
function addDecor(sprite, x, y, flip) {
  const key = Math.floor(x / DECOR_BUCKET) + ',' + Math.floor(y / DECOR_BUCKET);
  let list = DECOR_BUCKETS.get(key);
  if (!list) DECOR_BUCKETS.set(key, list = []);
  list.push({ s: sprite, x, y, flip });
}

(function buildDecor() {
  const rnd = seededRandom(777);
  const inRect = (x, y, r, pad) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
  const nearPath = (x, y, pts, d) => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (pointToSegmentDist(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < d) return true;
    }
    return false;
  };
  const buildingRects = buildings.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h + (b.wallH || 0) }));
  const ring = { x: PARK.x + PARK_POND.x - 50, y: PARK.y + PARK_POND.y - 50, w: PARK_POND.w + 100, h: PARK_POND.h + 100 };

  function blocked(x, y) {
    if (y < MOUNTAIN_Y + 30) return true;
    // downtown roads + sidewalks
    if (x >= 0 && x <= DOWNTOWN_W && y >= 0) {
      if (NUMBERED_STREETS.some(s => y > s.y - SIDEWALK_W - 6 && y < s.y + ROAD_W + SIDEWALK_W + 6)) return true;
      if (NAMED_STREETS.some(s => x > s.x - SIDEWALK_W - 6 && x < s.x + ROAD_W + SIDEWALK_W + 6)) return true;
    }
    if (y < 0 && NORTH_ROADS.some(s => x > s.x - 10 && x < s.x + ROAD_W + 10)) return true;
    if (RIDGE_ROADS.some(s => y > s.y - 10 && y < s.y + ROAD_W + 10)) return true;
    if (LOOP_SEGMENTS.some(s => s.horizontal
      ? (y > s.y - 10 && y < s.y + ROAD_W + 10 && x > s.x0 - 10 && x < s.x1 + 10)
      : (x > s.x - 10 && x < s.x + ROAD_W + 10 && y > Math.min(s.y0, s.y1) - 10 && y < Math.max(s.y0, s.y1) + 10))) return true;
    if (x < 0 && x > WEST_ROAD_X0 - 10 && y > WEST_ROAD_Y - 10 && y < WEST_ROAD_Y + ROAD_W + 10) return true;
    // water
    if (y > RIVER_Y - 8 && y < RIVER_Y + RIVER_H + 8) return true;
    if (y > RIVER2_Y - 8 && y < RIVER2_Y + RIVER2_H + 8) return true;
    if (inLake(x, y) || inLake2(x, y) || inLake3(x, y)) return true;
    if (inRect(x, y, { x: LAKE.x, y: LAKE.y, w: LAKE.w, h: LAKE.h }, 0) && inLake(x, y)) return true;
    if (x < BOARDWALK.x + BOARDWALK.w + 8 && y >= OCEAN_Y0) return true;
    // fields, buildings, trails
    if (FARM_FIELDS.some(f => inRect(x, y, f, 6))) return true;
    if (buildingRects.some(r => inRect(x, y, r, 12))) return true;
    if (nearPath(x, y, HIKING_TRAIL, 22)) return true;
    if (LAKE_PATHS.some(p => nearPath(x, y, p, 20))) return true;
    if (FARM_PATHS.some(p => nearPath(x, y, p, 16))) return true;
    if (inRect(x, y, { x: LAKE_DOCK.x, y: LAKE_DOCK.y, w: LAKE_DOCK.w, h: LAKE_DOCK.h }, 10)) return true;
    // park paths + pond
    if (inRect(x, y, PARK, 0)) {
      const lx = x - PARK.x, ly = y - PARK.y;
      if (Math.abs(lx - PARK.w / 2) < 18 || Math.abs(ly - PARK.h / 2) < 18) return true;
      if (inRect(x, y, ring, 8)) return true;
    }
    return false;
  }

  function biome(x, y) {
    if (y < 0) return 'forest';
    if (x < 0) return 'country';
    if (y > RIVER_Y + RIVER_H) return 'south';
    if (inRect(x, y, PARK, 0)) return 'park';
    return 'city';
  }

  const D = DECOR_SPRITES;
  // [cumulative chance, sprite list] per biome
  const TABLE = {
    city:    [[0.08, D.tuft], [0.09, D.rock], [0.105, D.bush]],
    park:    [[0.08, D.tuft], [0.095, D.flowers], [0.10, D.rock], [0.12, D.bush]],
    country: [[0.09, D.tuftCountry], [0.105, D.flowers], [0.115, D.rock], [0.13, D.bush]],
    forest:  [[0.07, D.tuftForest], [0.12, D.fern], [0.14, D.leaves], [0.16, D.rock], [0.18, D.bushForest], [0.187, D.log], [0.19, D.mushroom]],
    south:   [[0.07, D.dryWeed], [0.09, D.litter], [0.10, D.rock], [0.11, D.bushDry]]
  };

  const STEP = 40;
  for (let gx = WORLD_LEFT; gx < WORLD_W; gx += STEP) {
    for (let gy = MOUNTAIN_Y; gy < WORLD_H; gy += STEP) {
      const x = gx + rnd() * STEP, y = gy + rnd() * STEP;
      const roll = rnd();
      const table = TABLE[biome(x, y)];
      const hit = table.find(([p]) => roll < p);
      if (!hit || blocked(x, y)) continue;
      addDecor(pickFrom(rnd, hit[1]), x, y, rnd() < 0.5);
    }
  }

  // street furniture along downtown sidewalks
  const P = PROP_SPRITES;
  const nearCross = (v, streets) => streets.some(s => v > s.x - 60 && v < s.x + ROAD_W + 60);
  const nearCrossY = (v, streets) => streets.some(s => v > s.y - 60 && v < s.y + ROAD_W + 60);
  const nearThing = (x, y) => STREET_LAMPS.some(l => Math.abs(l.x - x) < 30 && Math.abs(l.y - y) < 30) ||
    TRAFFIC_LIGHTS.some(l => Math.abs(l.x - x) < 40 && Math.abs(l.y - y) < 40) ||
    buildings.some(b => b.doorZone && Math.abs(b.doorZone.x + b.doorZone.w / 2 - x) < 50 && Math.abs(b.y + b.h + (b.wallH || 0) - y) < 50);
  const inRiver = y => y > RIVER_Y - 40 && y < RIVER_Y + RIVER_H + 40;
  const pickProp = (r, horizontal) => r < 0.25 ? (horizontal ? P.benchH : P.benchV) : r < 0.5 ? P.trash : r < 0.68 ? P.hydrant : r < 0.88 ? P.planter : P.newsbox;

  NUMBERED_STREETS.forEach(s => {
    [s.y - SIDEWALK_W / 2 + 4, s.y + ROAD_W + SIDEWALK_W / 2 + 4].forEach(py => {
      for (let x = 80; x < DOWNTOWN_W - 40; x += 150 + rnd() * 120) {
        if (nearCross(x, NAMED_STREETS) || nearThing(x, py) || inRiver(py)) continue;
        if (rnd() < 0.65) continue;
        addDecor(pickProp(rnd(), true), x, py, false);
      }
    });
  });
  NAMED_STREETS.forEach(s => {
    [s.x - SIDEWALK_W / 2, s.x + ROAD_W + SIDEWALK_W / 2].forEach(px => {
      for (let y = 80; y < WORLD_H - 40; y += 150 + rnd() * 120) {
        if (nearCrossY(y, NUMBERED_STREETS) || nearThing(px, y) || inRiver(y)) continue;
        if (rnd() < 0.65) continue;
        addDecor(pickProp(rnd(), false), px, y, false);
      }
    });
  });

  // keep each bucket sorted by y so overlapping sprites stack correctly
  DECOR_BUCKETS.forEach(list => list.sort((a, b) => a.y - b.y));
})();

function drawDecor(camX, camY) {
  const x0 = Math.floor((camX - 40) / DECOR_BUCKET), x1 = Math.floor((camX + canvas.width + 40) / DECOR_BUCKET);
  const y0 = Math.floor((camY - 40) / DECOR_BUCKET), y1 = Math.floor((camY + canvas.height + 60) / DECOR_BUCKET);
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      const list = DECOR_BUCKETS.get(bx + ',' + by);
      if (!list) continue;
      for (const d of list) {
        const sx = Math.round(d.x - camX - d.s.ax), sy = Math.round(d.y - camY - d.s.ay);
        if (d.flip) {
          ctx.save(); ctx.translate(sx + d.s.c.width, sy); ctx.scale(-1, 1);
          ctx.drawImage(d.s.c, 0, 0); ctx.restore();
        } else {
          ctx.drawImage(d.s.c, sx, sy);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------
// Trees (pre-rendered in a few tints, scaled at draw time)
// ---------------------------------------------------------------------
const TREE_TINTS = [-12, -6, 0, 6, 12, 18];
const LEAFY_TREE_SPRITES = TREE_TINTS.map((v, i) => {
  const rnd = seededRandom(300 + i);
  return makeSprite(64, 76, (g, w, h) => {
    const cx = w / 2, base = h - 8;
    // shadow cast down-right
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(cx + 6, base + 1, 19, 6, 0, 0, Math.PI * 2); g.fill();
    // trunk
    g.fillStyle = '#5e4026'; g.fillRect(cx - 4, base - 18, 8, 19);
    g.fillStyle = '#7a5434'; g.fillRect(cx - 4, base - 18, 3, 19);
    // canopy: dark rim, mid body, light top-left clusters
    const cy = base - 36;
    const blobs = [];
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + rnd() * 0.5;
      blobs.push([cx + Math.cos(a) * 11, cy + Math.sin(a) * 9, 10 + rnd() * 4]);
    }
    blobs.push([cx, cy, 14]);
    g.fillStyle = shadeColor('#24481f', v);
    blobs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x + 1, y + 2, r + 1.5, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = shadeColor('#2f5a2a', v);
    blobs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = shadeColor('#3d6e37', v);
    blobs.slice(0, 5).forEach(([x, y, r]) => { g.beginPath(); g.arc(x - 3, y - 4, r * 0.7, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = shadeColor('#4f8445', v);
    [[cx - 9, cy - 9, 5], [cx + 2, cy - 12, 4], [cx - 13, cy + 1, 3.5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = shadeColor('#6aa05a', v);
    [[cx - 10, cy - 11, 2], [cx + 1, cy - 14, 1.6]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  });
});
const PINE_TREE_SPRITES = TREE_TINTS.map(v => makeSprite(48, 70, (g, w, h) => {
  const cx = w / 2, base = h - 8;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(cx + 5, base + 1, 15, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a3020'; g.fillRect(cx - 3, base - 12, 6, 13);
  const tiers = [[base - 56, base - 30, 14], [base - 44, base - 18, 17], [base - 32, base - 6, 20]];
  tiers.forEach(([top, bot, half], i) => {
    const col = ['#26502a', '#2c5a2e', '#316232'][i];
    g.fillStyle = shadeColor(col, v - 10);
    g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - half - 1, bot + 1); g.lineTo(cx + half + 1, bot + 1); g.closePath(); g.fill();
    g.fillStyle = shadeColor(col, v);
    g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - half, bot); g.lineTo(cx + half, bot); g.closePath(); g.fill();
    // lit left face
    g.fillStyle = shadeColor(col, v + 12);
    g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - half, bot); g.lineTo(cx - 2, bot); g.closePath(); g.fill();
    // jagged needle edge along the bottom of each tier
    g.fillStyle = shadeColor(col, v - 8);
    for (let x = cx - half + 2; x < cx + half - 2; x += 4) {
      g.beginPath(); g.moveTo(x, bot); g.lineTo(x + 2, bot + 3); g.lineTo(x + 4, bot); g.fill();
    }
  });
}));

function drawTreeSprite(sprites, px, py, camX, camY, scale) {
  const sp = sprites[Math.floor(hashNoise(px, py) * sprites.length)];
  const s = scale || 1;
  const x = px - camX, y = py - camY;
  if (x < -60 || x > canvas.width + 60 || y < -20 || y > canvas.height + 90) return;
  ctx.drawImage(sp.c, x - sp.ax * s, y + 6 - sp.ay * s, sp.c.width * s, sp.c.height * s);
}

// ---------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------
const BRICK_PATTERN = (() => {
  const [c, g] = makeCanvas(24, 12);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.fillRect(0, 5, 24, 1); g.fillRect(0, 11, 24, 1);
  g.fillRect(6, 0, 1, 5); g.fillRect(18, 6, 1, 5);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(0, 0, 24, 1); g.fillRect(0, 6, 24, 1);
  return ctx.createPattern(c, 'repeat');
})();
const SIDING_PATTERN = (() => {
  const [c, g] = makeCanvas(8, 8);
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, 7, 8, 1);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 0, 8, 1);
  return ctx.createPattern(c, 'repeat');
})();
const SHINGLE_PATTERN = (() => {
  const [c, g] = makeCanvas(16, 10);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 9, 16, 1); g.fillRect(4, 0, 1, 4); g.fillRect(12, 5, 1, 4);
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 5, 16, 1);
  return ctx.createPattern(c, 'repeat');
})();
const GRAVEL_PATTERN = (() => {
  const [c, g] = makeCanvas(32, 32);
  const rnd = seededRandom(55);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
    g.fillRect(rnd() * 32, rnd() * 32, 1.5, 1.5);
  }
  return ctx.createPattern(c, 'repeat');
})();

function isResidential(b) { return RESIDENTIAL_BUILDINGS.includes(b.name) || /House|Cabin|Farmhouse|Cottage/.test(b.name || ''); }

function fillAnchored(pattern, ax, ay, x, y, w, h) {
  ctx.save(); ctx.translate(ax, ay); ctx.fillStyle = pattern; ctx.fillRect(x - ax, y - ay, w, h); ctx.restore();
}

// window rects (world coords) for a building - shared by the facade and the night light pass
function buildingWindows(b) {
  if (b._windows) return b._windows;
  const dz = b.doorZone;
  const out = [];
  // fewer, larger windows: one per ~54px of wall, one row per ~48px of height
  const winW = 17, winH = 22, pitchX = 54, pitchY = 48;
  const wallTop = b.y + b.h, wallBottom = wallTop + b.wallDepth;
  const cols = Math.max(1, Math.floor((b.w - 20) / pitchX));
  const startX = b.x + (b.w - (cols - 1) * pitchX - winW) / 2;
  for (let wy = wallTop + 14; wy + winH <= wallBottom - 12 || wy === wallTop + 14; wy += pitchY) {
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * pitchX;
      if (dz && wx + winW > dz.x - 8 && wx < dz.x + dz.w + 8) continue;
      out.push({ x: wx, y: wy, w: winW, h: winH, lit: hashNoise(wx, wy) > 0.22 });
    }
    if (wy + pitchY + winH > wallBottom - 12) break;
  }
  b._windows = out;
  return out;
}

function drawBuildingWall(b, sx, sy) {
  const top = sy + b.h, h = b.wallDepth;
  fillAnchored(isResidential(b) ? SIDING_PATTERN : BRICK_PATTERN, sx, top, sx, top, b.w, h);
  // eave shadow under the roof + darker base near the ground
  let g = ctx.createLinearGradient(0, top, 0, top + 10);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(sx, top, b.w, 10);
  g = ctx.createLinearGradient(0, top + h - 12, 0, top + h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(sx, top + h - 12, b.w, 12);
  // corner trim
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, top, 3, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(sx + b.w - 3, top, 3, h);
}

function drawBuildingWindows(b, camX, camY, nightFactor) {
  buildingWindows(b).forEach(win => {
    const x = win.x - camX, y = win.y - camY;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x - 2, y - 2, win.w + 4, win.h + 4);
    const lit = win.lit && nightFactor > 0.25;
    if (lit) {
      ctx.fillStyle = `rgba(255,${210 + Math.floor(hashNoise(win.x, 7) * 30)},140,${(0.55 + nightFactor * 0.45).toFixed(3)})`;
      ctx.fillRect(x, y, win.w, win.h);
    } else {
      const glass = ctx.createLinearGradient(x, y, x + win.w, y + win.h);
      const d = 1 - nightFactor;
      glass.addColorStop(0, `rgb(${Math.round(120 * d + 25)},${Math.round(160 * d + 30)},${Math.round(190 * d + 45)})`);
      glass.addColorStop(1, `rgb(${Math.round(60 * d + 15)},${Math.round(85 * d + 20)},${Math.round(110 * d + 35)})`);
      ctx.fillStyle = glass;
      ctx.fillRect(x, y, win.w, win.h);
      ctx.fillStyle = `rgba(255,255,255,${(0.35 * d).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(x + 2, y + win.h - 4); ctx.lineTo(x + win.w - 6, y + 2); ctx.lineTo(x + win.w - 3, y + 2); ctx.lineTo(x + 2, y + win.h - 1); ctx.fill();
    }
    // mullions + sill
    ctx.fillStyle = 'rgba(40,30,25,0.7)';
    ctx.fillRect(x + win.w / 2 - 0.5, y, 1, win.h);
    ctx.fillRect(x, y + win.h / 2 - 0.5, win.w, 1);
    ctx.fillStyle = 'rgba(230,225,210,0.75)';
    ctx.fillRect(x - 3, y + win.h + 1, win.w + 6, 2);
  });
}

function drawBuildingDoor(b, camX, camY, sy, nightFactor) {
  const dz = b.doorZone;
  const doorH = Math.min(b.wallDepth, 56);
  const x = dz.x - camX, y = sy + b.h + b.wallDepth - doorH, w = dz.w;
  // awning over shop doors
  if (!isResidential(b) && b.wallDepth > 40) {
    const hue = Math.floor(hashNoise(b.x, b.y) * 6);
    const cols = [['#c8402e', '#f0ead8'], ['#2e6ac8', '#f0ead8'], ['#2e8a4a', '#f0ead8'], ['#c89a2e', '#5a3a1a'], ['#7a3a8a', '#f0ead8'], ['#333', '#c8402e']][hue];
    const aw = w + 26, ax = x - 13, ay = y - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(ax + 2, ay + 12, aw, 5);
    for (let i = 0; i < aw; i += 8) { ctx.fillStyle = cols[(i / 8) % 2]; ctx.fillRect(ax + i, ay, Math.min(8, aw - i), 11); }
    ctx.fillStyle = cols[0];
    for (let i = 0; i < aw; i += 8) { ctx.beginPath(); ctx.arc(ax + i + 4, ay + 11, 4, 0, Math.PI); ctx.fill(); }
  }
  // frame, door, panels, knob, step
  ctx.fillStyle = '#d8d0bc'; ctx.fillRect(x - 3, y - 3, w + 6, doorH + 3);
  ctx.fillStyle = '#2a1f18'; ctx.fillRect(x, y, w, doorH);
  ctx.fillStyle = shadeColor('#5a3a24', (hashNoise(b.x + 3, b.y) - 0.5) * 30);
  ctx.fillRect(x + 2, y + 2, w - 4, doorH - 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 6, y + 6, w - 12, doorH * 0.35);
  ctx.strokeRect(x + 6, y + doorH * 0.5, w - 12, doorH * 0.4);
  ctx.fillStyle = '#e8c860'; ctx.beginPath(); ctx.arc(x + w - 7, y + doorH * 0.55, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9a9488'; ctx.fillRect(x - 5, y + doorH, w + 10, 4);
  // porch light
  if (nightFactor > 0.25) {
    ctx.fillStyle = `rgba(255,230,160,${nightFactor.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x + w + 7, y + 8, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBuildingRoof(b, sx, sy) {
  if (isResidential(b)) {
    fillAnchored(SHINGLE_PATTERN, sx, sy, sx, sy, b.w, b.h);
    // gable: lit upper slope, shaded lower slope, ridge line
    const mid = sy + b.h * 0.45;
    let g = ctx.createLinearGradient(0, sy, 0, mid);
    g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = g; ctx.fillRect(sx, sy, b.w, mid - sy);
    g = ctx.createLinearGradient(0, mid, 0, sy + b.h);
    g.addColorStop(0, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g; ctx.fillRect(sx, mid, b.w, sy + b.h - mid);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx + 4, mid, b.w - 8, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx + 4, mid - 1, b.w - 8, 1);
    // chimney
    if (b.w > 120) {
      const cx = sx + b.w * (0.2 + hashNoise(b.x, b.y + 1) * 0.6), cy = sy + b.h * 0.18;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx + 3, cy + 3, 12, 14);
      ctx.fillStyle = '#7a4a3a'; ctx.fillRect(cx, cy, 12, 14);
      ctx.fillStyle = '#5a3428'; ctx.fillRect(cx - 1, cy, 14, 3);
    }
  } else {
    // flat roof: parapet rim, gravel, rooftop units
    const inset = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(sx + inset, sy + inset, b.w - inset * 2, b.h - inset * 2);
    fillAnchored(GRAVEL_PATTERN, sx, sy, sx + inset, sy + inset, b.w - inset * 2, b.h - inset * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx + inset, sy + inset, b.w - inset * 2, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx, sy, b.w, 2);
    const units = b.w > 180 ? 2 : (b.w > 90 ? 1 : 0);
    for (let i = 0; i < units; i++) {
      const ux = sx + 16 + hashNoise(b.x + i * 31, b.y) * (b.w - 60), uy = sy + 14 + hashNoise(b.y, b.x + i) * Math.max(4, b.h - 44);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ux + 4, uy + 4, 24, 18);
      ctx.fillStyle = '#a8aca8'; ctx.fillRect(ux, uy, 24, 18);
      ctx.fillStyle = '#8a8e8a'; ctx.fillRect(ux, uy + 12, 24, 6);
      ctx.strokeStyle = '#6a6e6a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ux + 12, uy + 7, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ux + 7, uy + 7); ctx.lineTo(ux + 17, uy + 7); ctx.stroke();
    }
    if (b.h > 50) {
      const vx = sx + b.w - 22, vy = sy + b.h - 20;
      ctx.fillStyle = '#6a6a6a'; ctx.beginPath(); ctx.arc(vx, vy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(vx, vy, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------
// Atmosphere: drifting cloud shadows (day) + light-mapped night
// ---------------------------------------------------------------------
const CLOUD_SPRITE = (() => {
  const [c, g] = makeCanvas(420, 300);
  const rnd = seededRandom(71);
  for (let i = 0; i < 9; i++) {
    const x = 110 + rnd() * 200, y = 90 + rnd() * 120, r = 60 + rnd() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
})();

function drawCloudShadows(camX, camY, nightFactor) {
  const strength = 0.22 * (1 - nightFactor);
  if (strength < 0.02) return;
  const t = performance.now() / 1000;
  const CELL = 1400;
  const driftX = t * 9, driftY = t * 4;
  ctx.save();
  ctx.globalAlpha = strength;
  const gx0 = Math.floor((camX - driftX - 500) / CELL), gx1 = Math.floor((camX - driftX + canvas.width + 100) / CELL);
  const gy0 = Math.floor((camY - driftY - 400) / CELL), gy1 = Math.floor((camY - driftY + canvas.height + 100) / CELL);
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      if (hashNoise(gx * 3.1, gy * 7.7) < 0.35) continue;
      const s = 1 + hashNoise(gy, gx) * 1.2;
      const wx = gx * CELL + hashNoise(gx, gy * 2) * 700 + driftX;
      const wy = gy * CELL + hashNoise(gx * 5, gy) * 700 + driftY;
      ctx.drawImage(CLOUD_SPRITE, wx - camX, wy - camY, 420 * s, 300 * s);
    }
  }
  ctx.restore();
}

let lightCanvas = null, lightCtx = null;
function punchLight(x, y, r, strength) {
  const g = lightCtx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lightCtx.fillStyle = g;
  lightCtx.fillRect(x - r, y - r, r * 2, r * 2);
}
function glowLight(x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('ALPHA', alpha.toFixed(3)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawNightLighting(camX, camY, nightFactor) {
  if (nightFactor < 0.03) return;
  if (!lightCanvas || lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) {
    [lightCanvas, lightCtx] = makeCanvas(canvas.width, canvas.height);
  }
  const W = canvas.width, H = canvas.height;
  const onScreen = (x, y, pad) => x > -pad && x < W + pad && y > -pad && y < H + pad;
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.clearRect(0, 0, W, H);
  lightCtx.fillStyle = `rgba(6,10,34,${(nightFactor * 0.82).toFixed(3)})`;
  lightCtx.fillRect(0, 0, W, H);
  lightCtx.globalCompositeOperation = 'destination-out';

  const warm = [];
  STREET_LAMPS.forEach(l => {
    const x = l.x - camX, y = l.y - camY;
    if (!onScreen(x, y, 140)) return;
    punchLight(x, y - 10, 110, 0.85);
    warm.push([x, y - 20, 90, 'rgba(255,200,120,ALPHA)', 0.16]);
  });
  buildings.forEach(b => {
    const bx = b.x - camX, by = b.y - camY;
    if (!onScreen(bx + b.w / 2, by + b.h, Math.max(b.w, 200))) return;
    buildingWindows(b).forEach(win => {
      if (!win.lit) return;
      const x = win.x - camX + win.w / 2, y = win.y - camY + win.h / 2;
      punchLight(x, y, 26, 0.9);
      punchLight(x, y + 26, 34, 0.35);
    });
    if (b.doorZone) {
      const dx = b.doorZone.x - camX + b.doorZone.w / 2, dy = by + b.h + b.wallDepth;
      punchLight(dx, dy, 55, 0.7);
      warm.push([dx, dy, 50, 'rgba(255,210,140,ALPHA)', 0.12]);
    }
    const neon = NIGHTLIFE_SIGN_COLORS[b.name];
    if (neon) {
      punchLight(bx + b.w / 2, by - 10, 80, 0.6);
      warm.push([bx + b.w / 2, by - 10, 80, hexToRgbaTemplate(neon), 0.22]);
    }
  });
  const carLights = (car, facing) => {
    const x = car.x - camX, y = car.y - camY;
    if (!onScreen(x, y, 160)) return;
    const d = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[facing] || [0, 1];
    punchLight(x + d[0] * 50, y - 8 + d[1] * 50, 60, 0.8);
    punchLight(x + d[0] * 100, y - 8 + d[1] * 100, 55, 0.5);
    warm.push([x + d[0] * 60, y - 8 + d[1] * 60, 60, 'rgba(255,245,200,ALPHA)', 0.1]);
  };
  trafficCars.forEach(car => carLights(car, car.axis === 'h' ? (car.dir > 0 ? 'right' : 'left') : (car.dir > 0 ? 'down' : 'up')));
  trafficBikes.forEach(bike => carLights(bike, bike.axis === 'h' ? (bike.dir > 0 ? 'right' : 'left') : (bike.dir > 0 ? 'down' : 'up')));
  if (player.onCar || player.onMotorcycle) {
    carLights({ x: player.x + player.w / 2, y: player.y + player.h }, player.facing);
  }
  // the player always carries a little light so you never lose yourself
  punchLight(player.x + player.w / 2 - camX, player.y - camY, 90, 0.55);

  ctx.drawImage(lightCanvas, 0, 0);

  // additive warm glows on top
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  warm.forEach(([x, y, r, col, a]) => glowLight(x, y, r, col, a * nightFactor));
  ctx.restore();
}

function hexToRgbaTemplate(hex) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},ALPHA)`;
}

// ---------------------------------------------------------------------
// Interiors
// ---------------------------------------------------------------------
const PLANK_PATTERN = (() => {
  const [c, g] = makeCanvas(96, 72);
  const rnd = seededRandom(81);
  for (let row = 0; row < 6; row++) {
    const y = row * 12;
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`;
    g.fillRect(0, y, 96, 12);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, y + 11, 96, 1);
    const off = (row * 37) % 96;
    g.fillRect(off, y, 1, 11); g.fillRect((off + 48) % 96, y, 1, 11);
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, y + 3 + k * 3 + rnd()); g.lineTo(96, y + 3 + k * 3 + rnd()); g.stroke(); }
  }
  return ctx.createPattern(c, 'repeat');
})();
const TILE_PATTERN = (() => {
  const [c, g] = makeCanvas(64, 64);
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 31, 64, 1); g.fillRect(0, 63, 64, 1); g.fillRect(31, 0, 1, 64); g.fillRect(63, 0, 1, 64);
  return ctx.createPattern(c, 'repeat');
})();
const WALLPAPER_PATTERN = (() => {
  const [c, g] = makeCanvas(18, 18);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 0, 6, 18);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.beginPath(); g.arc(12, 9, 1.5, 0, Math.PI * 2); g.fill();
  return ctx.createPattern(c, 'repeat');
})();

const BACK_WALL_H = 46;
function interiorUsesPlanks(b) {
  return isResidential(b) || /Bar|Tavern|Club|Casino|Saloon|Diner|Pizza|Cabin|Lodge|Spa|Barber|Museum/.test(b.name || '');
}

// background, back wall, floor, side walls, doorway - replaces the flat box
function drawInteriorShell(rx, ry, b) {
  const W = ROOM_W, H = ROOM_H, T = WALL_THICK;
  ctx.fillStyle = '#0c0c10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // soft glow around the room so it doesn't float in a void
  const halo = ctx.createRadialGradient(rx + W / 2, ry + H / 2, Math.min(W, H) * 0.4, rx + W / 2, ry + H / 2, Math.max(W, H) * 0.95);
  halo.addColorStop(0, 'rgba(60,55,50,0.35)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // floor
  ctx.fillStyle = b.floor;
  ctx.fillRect(rx, ry, W, H);
  fillAnchored(interiorUsesPlanks(b) ? PLANK_PATTERN : TILE_PATTERN, rx, ry, rx + T, ry + T, W - 2 * T, H - 2 * T);
  // ceiling light pool
  const pool = ctx.createRadialGradient(rx + W / 2, ry + H * 0.45, 10, rx + W / 2, ry + H * 0.45, W * 0.6);
  pool.addColorStop(0, 'rgba(255,240,210,0.10)'); pool.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = pool; ctx.fillRect(rx + T, ry + T, W - 2 * T, H - 2 * T);
  // contact shadows along the walls
  const edge = (x, y, w, h, x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  };
  edge(rx + T, ry + T, W - 2 * T, 22, 0, ry + T, 0, ry + T + 22);
  edge(rx + T, ry + T, 14, H - 2 * T, rx + T, 0, rx + T + 14, 0);
  edge(rx + W - T - 14, ry + T, 14, H - 2 * T, rx + W - T, 0, rx + W - T - 14, 0);

  // back wall face (3/4 view), rising above the room
  const wallCol = shadeColor(b.wall || '#6a6a6a', 18);
  const fy = ry - BACK_WALL_H, fh = BACK_WALL_H + T;
  ctx.fillStyle = wallCol; ctx.fillRect(rx, fy, W, fh);
  fillAnchored(WALLPAPER_PATTERN, rx, fy, rx, fy, W, fh);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(rx, fy + fh * 0.6, W, fh * 0.4); // wainscot
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(rx, fy + fh * 0.6, W, 2);
  ctx.fillStyle = 'rgba(40,28,20,0.85)'; ctx.fillRect(rx, ry + T - 5, W, 5); // baseboard
  drawBackWallDecor(rx, fy, fh, b);

  // wall caps (seen from above): sides, top lip, bottom
  const cap = '#26221e', capHi = '#3a342e';
  ctx.fillStyle = cap;
  ctx.fillRect(rx - 4, fy - 8, W + 8, 8);
  ctx.fillRect(rx - 4, fy - 8, T + 4, H + BACK_WALL_H + 8);
  ctx.fillRect(rx + W - T, fy - 8, T + 4, H + BACK_WALL_H + 8);
  ctx.fillRect(rx - 4, ry + H - T, W + 8, T + 4);
  ctx.fillStyle = capHi;
  ctx.fillRect(rx - 4, fy - 8, W + 8, 2);
  ctx.fillRect(rx + T - 2, fy, 2, H + BACK_WALL_H - T);
  ctx.fillRect(rx + W - T, fy, 2, H + BACK_WALL_H - T);
  ctx.fillRect(rx + T, ry + H - T, W - 2 * T, 2);

  // doorway with daylight spilling in + doormat
  const ex = rx + W / 2 - 30, ey = ry + H - T;
  const spill = ctx.createLinearGradient(0, ey + T, 0, ey - 40);
  spill.addColorStop(0, 'rgba(255,240,200,0.18)'); spill.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = spill;
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 60, ey); ctx.lineTo(ex + 76, ey - 40); ctx.lineTo(ex - 16, ey - 40); ctx.fill();
  ctx.fillStyle = '#1a140f'; ctx.fillRect(ex, ey, 60, T + 4);
  ctx.fillStyle = 'rgba(200,190,160,0.25)'; ctx.fillRect(ex, ey + T, 60, 4);
  ctx.fillStyle = '#6a3a2a'; ctx.fillRect(ex + 8, ey - 14, 44, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(ex + 10, ey - 12, 40, 1); ctx.fillRect(ex + 10, ey - 5, 40, 1);
}

function drawBackWallDecor(rx, fy, fh, b) {
  const rnd = seededRandom(Math.floor(hashNoise(b.x, b.y) * 1e6));
  const items = 2 + Math.floor(rnd() * 3);
  const slots = [];
  for (let i = 0; i < items; i++) {
    const x = rx + 50 + (i + 0.5) * ((ROOM_W - 100) / items) + (rnd() - 0.5) * 30;
    // keep clear of the centered name plaque
    if (Math.abs(x - (rx + ROOM_W / 2)) < 70) continue;
    slots.push(x);
  }
  const nightlife = /Bar|Tavern|Club|Casino|Saloon/.test(b.name || '');
  slots.forEach((x, i) => {
    const kind = nightlife ? (i % 2 ? 'neon' : 'frame') : pickFrom(rnd, ['frame', 'frame', 'window', 'clock', 'shelf']);
    const y = fy + 8;
    if (kind === 'frame') {
      const w = 22 + rnd() * 14, h = 16 + rnd() * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - w / 2 + 2, y + 2, w, h);
      ctx.fillStyle = pickFrom(rnd, ['#8a6a3a', '#2a2a2a', '#c8b070']); ctx.fillRect(x - w / 2, y, w, h);
      const art = ctx.createLinearGradient(0, y, 0, y + h);
      const c1 = pickFrom(rnd, ['#6aa0d8', '#e8a060', '#5a8a5a', '#c87a9a']);
      art.addColorStop(0, c1); art.addColorStop(1, shadeColor(c1, -30));
      ctx.fillStyle = art; ctx.fillRect(x - w / 2 + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = 'rgba(30,50,30,0.6)';
      ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y + h - 3); ctx.lineTo(x - 2, y + h * 0.45); ctx.lineTo(x + w / 2 - 3, y + h - 3); ctx.fill();
    } else if (kind === 'window') {
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(x - 16, y - 2, 32, 26);
      const sky = ctx.createLinearGradient(0, y, 0, y + 22);
      sky.addColorStop(0, '#8ec0e8'); sky.addColorStop(1, '#cde4f0');
      ctx.fillStyle = sky; ctx.fillRect(x - 14, y, 28, 22);
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(x - 1, y, 2, 22); ctx.fillRect(x - 14, y + 10, 28, 2);
    } else if (kind === 'clock') {
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(x, y + 11, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.arc(x, y + 11, 8, 0, Math.PI * 2); ctx.fill();
      const t = performance.now() / 1000;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y + 11); ctx.lineTo(x + Math.cos(t / 60) * 6, y + 11 + Math.sin(t / 60) * 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 11); ctx.lineTo(x + Math.cos(t) * 7, y + 11 + Math.sin(t) * 7); ctx.stroke();
    } else if (kind === 'shelf') {
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 22, y + 18, 44, 3);
      ['#c84a3a', '#3a6ac8', '#e8c860', '#4a8a4a'].forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(x - 18 + k * 9, y + 6 + (k % 2) * 3, 6, 12 - (k % 2) * 3); });
    } else if (kind === 'neon') {
      const col = pickFrom(rnd, ['#ff4fa0', '#4fe0ff', '#ffd24f']);
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y + 12, 9, Math.PI * 0.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, y + 8); ctx.lineTo(x + 4, y + 16); ctx.stroke();
      ctx.restore();
    }
  });
  // room name sits above the wall, clear of NPC name labels standing in front of it
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(b.name, rx + ROOM_W / 2 + 1, fy - 17);
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(b.name, rx + ROOM_W / 2, fy - 18);
}

const PLANT_SPRITE = makeSprite(26, 34, (g, w, h) => {
  groundShadow(g, w / 2 + 2, h - 4, 9, 3, 0.35);
  g.fillStyle = '#9a5a3a'; g.beginPath(); g.moveTo(6, h - 15); g.lineTo(w - 6, h - 15); g.lineTo(w - 8, h - 4); g.lineTo(8, h - 4); g.fill();
  g.fillStyle = '#b06a46'; g.fillRect(5, h - 16, w - 10, 3);
  const leaves = [[13, 6, -0.2], [7, 10, -0.9], [19, 10, 0.9], [10, 14, -0.5], [16, 14, 0.5]];
  leaves.forEach(([x, y, a], i) => {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = i % 2 ? '#3d7a34' : '#4f9440';
    g.beginPath(); g.ellipse(0, 0, 3.5, 8, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  });
});

// potted plants in whichever room corners are actually free
function drawInteriorDecor(rx, ry, b) {
  const blockers = getBuildingFurnitureObstacles(b).slice();
  if (b.bar) blockers.push(b.bar);
  if (b.stage) blockers.push(b.stage);
  (b.displayBikes || []).forEach(bk => blockers.push({ x: bk.x - 30, y: bk.y - 20, w: 60, h: 30 }));
  (b.npcs || []).forEach(n => blockers.push({ x: (n.homeX ?? n.x) - 20, y: (n.homeY ?? n.y) - 30, w: 40, h: 40 }));
  const T = WALL_THICK;
  const spots = [[T + 4, T + 2], [ROOM_W - T - 30, T + 2], [T + 4, ROOM_H - T - 36], [ROOM_W - T - 30, ROOM_H - T - 36]];
  spots.forEach(([x, y]) => {
    const r = { x, y, w: 26, h: 34 };
    if (blockers.some(o => rectsOverlap(r, o))) return;
    ctx.drawImage(PLANT_SPRITE.c, rx + x, ry + y);
  });
}

// ---------------------------------------------------------------------
// Dirt roads, sand, crop fields
// ---------------------------------------------------------------------
const DIRT_PATTERN = makeGroundTile('rgba(0,0,0,0)', { seed: 21, blotches: 45, lightBias: 0.5, blotchColor: 'rgba(60,40,20,0.10)', pebbles: 140, pebbleSize: 1.8, pebbleColors: ['#9a8468', '#6e5a42', '#a8967a'], blades: 120, bladeLen: 2.5, anyAngle: true, bladeColors: ['#6a5638', '#a08a68'] });
const SAND_PATTERN = makeGroundTile('rgba(0,0,0,0)', { seed: 22, blotches: 40, lightBias: 0.6, pebbles: 70, pebbleSize: 1.3, pebbleColors: ['#c8b07a', '#e8dcb0', '#b8a070'], blades: 260, bladeLen: 6, bladeWidth: 1, anyAngle: false, bladeColors: ['rgba(160,135,90,0.35)', 'rgba(255,250,230,0.35)'] });
function dirtTexture(camX, camY, x, y, w, h) {
  fillWorldPattern(DIRT_PATTERN, camX, camY, x, y, w, h);
  // faint wheel ruts along the long axis
  ctx.fillStyle = 'rgba(60,42,24,0.16)';
  if (w >= h) { ctx.fillRect(x, y + h * 0.3, w, 5); ctx.fillRect(x, y + h * 0.66, w, 5); }
  else { ctx.fillRect(x + w * 0.3, y, 5, h); ctx.fillRect(x + w * 0.66, y, 5, h); }
}
function sandTexture(camX, camY, x, y, w, h) { fillWorldPattern(SAND_PATTERN, camX, camY, x, y, w, h); }

const FIELD_PATTERNS = {
  // wheat: dense upright stalks in rows
  '#b8952e': (() => { const [c, g] = makeCanvas(24, 22); const r = seededRandom(31);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, 18, 24, 4);
    for (let i = 0; i < 16; i++) { const x = r() * 24, y = 4 + r() * 13; g.strokeStyle = r() < 0.5 ? '#d8b850' : '#9a7a22'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x + (r() - 0.5) * 2, y); g.stroke(); g.fillStyle = '#e8c860'; g.fillRect(x - 1, y - 2, 2, 3); }
    return ctx.createPattern(c, 'repeat'); })(),
  // cover crop: leafy clumps in rows
  '#6a8f3a': (() => { const [c, g] = makeCanvas(22, 22); const r = seededRandom(32);
    g.fillStyle = 'rgba(60,40,20,0.35)'; g.fillRect(0, 17, 22, 5);
    for (let i = 0; i < 6; i++) { g.fillStyle = r() < 0.5 ? '#7aa848' : '#4f7a2a'; g.beginPath(); g.arc(2 + i * 3.6, 10 + (r() - 0.5) * 4, 3 + r() * 1.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,255,220,0.25)'; g.beginPath(); g.arc(8, 8, 1.5, 0, Math.PI * 2); g.fill();
    return ctx.createPattern(c, 'repeat'); })(),
  // tilled soil: furrows with highlight ridges
  '#8a6a3a': (() => { const [c, g] = makeCanvas(32, 14); const r = seededRandom(33);
    g.fillStyle = 'rgba(40,25,10,0.35)'; g.fillRect(0, 9, 32, 4);
    g.fillStyle = 'rgba(255,230,180,0.12)'; g.fillRect(0, 3, 32, 2);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(50,30,15,0.4)'; g.fillRect(r() * 32, r() * 14, 1.5, 1.5); }
    return ctx.createPattern(c, 'repeat'); })()
};
