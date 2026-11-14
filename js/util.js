// Small pure helpers used both at load time (world setup) and at runtime.
// Loaded before world.js because world setup calls them directly.

// deterministic pseudo-random 0..1 from a pair of numbers (usually world
// coordinates) - same inputs always give the same output, so texture speckle
// stays put instead of flickering like it would with Math.random() per frame
function hashNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function randomPersonStyle() {
  const hairColors = ['#2a1e14', '#4a3020', '#6b4a2a', '#1a1a1a', '#8a6a3a', '#c2a05f'];
  const skirtColors = ['#c25f8f', '#8f5fc2', '#c2905f', '#5f8fc2', '#c25f5f', '#5fc2a0'];
  const maleHairstyles = ['square', 'bowl', 'bald', 'long'];
  const femaleHairstyles = ['square', 'bowl', 'long'];
  const gender = Math.random() < 0.5 ? 'f' : 'm';

  // mostly the default light skin tone, with a real minority of light
  // brown and brown tones so the town isn't uniformly one shade
  const skinRoll = Math.random();
  const skinTone = skinRoll < 0.7 ? '#f0c090' : skinRoll < 0.9 ? '#d9a066' : '#8a5a34';

  const hairstyles = gender === 'f' ? femaleHairstyles : maleHairstyles;
  return {
    gender,
    hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
    hairstyle: hairstyles[Math.floor(Math.random() * hairstyles.length)],
    skinTone,
    skirt: gender === 'f' && Math.random() < 0.5,
    skirtColor: skirtColors[Math.floor(Math.random() * skirtColors.length)]
  };
}

function freeSegments(totalLen, zones) {
  const sorted = zones.slice().sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  sorted.forEach(z => {
    if (z.start > cursor) segments.push({ start: cursor, end: z.start });
    cursor = Math.max(cursor, z.end);
  });
  if (cursor < totalLen) segments.push({ start: cursor, end: totalLen });
  return segments;
}

// distance from point (px,py) to the segment (x1,y1)-(x2,y2) - used so a
// fast-moving bullet still registers a hit against anything it passed over
// this frame, not just whatever is exactly at its new position. Without
// this, a bullet covering more than 2*HIT_RADIUS in one frame (easy with a
// dt spike from a mobile frame-rate hiccup) can tunnel straight through a
// target without ever sampling a point close enough to it.
function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
