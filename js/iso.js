// =====================================================================
// Isometric outdoor renderer.
//
// The game world, collision, traffic, quests etc. all stay on the plain
// 2D (x, y) grid. This file only changes how the outside is *drawn*:
//   - flat things (ground, roads, water, fields) are drawn by the regular
//     draw functions through a 2:1 isometric canvas transform
//   - buildings become extruded boxes (roof + south face + east face),
//     reusing the regular facade/roof art mapped onto each face
//   - people, trees, lamps, vehicles stand upright at projected points
// Keys still move along the world axes, so "up" walks up-right along a
// street on screen. V toggles back to the classic top-down view.
// =====================================================================

let ISO_VIEW = true;
try { ISO_VIEW = localStorage.getItem('topdownWalkerIso') !== '0'; } catch (e) {}
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'v' || e.repeat || awaitingName || awaitingTier || dialogueOpen) return;
  ISO_VIEW = !ISO_VIEW;
  try { localStorage.setItem('topdownWalkerIso', ISO_VIEW ? '1' : '0'); } catch (err) {}
  showFlavorMessage(ISO_VIEW ? 'Isometric view (V to switch)' : 'Top-down view (V to switch)');
});

const ISO_K = 0.9;                 // world units -> logical px along each axis
const iso = { ax: 0, ay: 0, W: 0, H: 0, Z: 1 };

// camera zoom: auto-fit to the screen size, times a user factor (+ / - keys)
let isoUserZoom = 1;
try { isoUserZoom = parseFloat(localStorage.getItem('topdownWalkerZoom')) || 1; } catch (e) {}
function isoZoom(realW, realH) {
  const auto = Math.max(0.9, Math.min(2.2, Math.min(realW, realH) / 530));
  return auto * isoUserZoom;
}
window.addEventListener('keydown', e => {
  if (awaitingName || awaitingTier || dialogueOpen || e.repeat) return;
  const k = e.key;
  if (k !== '=' && k !== '+' && k !== '-' && k !== '_') return;
  isoUserZoom = Math.max(0.6, Math.min(1.8, isoUserZoom * (k === '-' || k === '_' ? 1 / 1.15 : 1.15)));
  try { localStorage.setItem('topdownWalkerZoom', String(isoUserZoom)); } catch (err) {}
  showFlavorMessage('Zoom ' + Math.round(isoUserZoom * 100) + '%');
});

function isoS(x, y, z) {
  const dx = x - iso.ax, dy = y - iso.ay;
  return { x: (dx - dy) * ISO_K + iso.W / 2, y: (dx + dy) * ISO_K / 2 + iso.H / 2 - (z || 0) };
}
function isoToWorld(sx, sy) {
  const X = (sx - iso.W / 2) / ISO_K, Y = (sy - iso.H / 2) * 2 / ISO_K;
  return { x: (X + Y) / 2 + iso.ax, y: (Y - X) / 2 + iso.ay };
}

// The regular ground draw functions cull against canvas.width/height in
// their own (top-down) space. During the ground pass the visible world
// region is a rotated diamond, so we temporarily report its bounding box
// size instead of the real canvas size.
const _isoWidthDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
const _isoHeightDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');
let isoViewSize = null;
Object.defineProperty(canvas, 'width', {
  configurable: true,
  get() { return isoViewSize ? isoViewSize.w : _isoWidthDesc.get.call(this); },
  set(v) { _isoWidthDesc.set.call(this, v); }
});
Object.defineProperty(canvas, 'height', {
  configurable: true,
  get() { return isoViewSize ? isoViewSize.h : _isoHeightDesc.get.call(this); },
  set(v) { _isoHeightDesc.set.call(this, v); }
});

function isoWorldBounds(pad) {
  const pts = [[0, 0], [iso.W, 0], [0, iso.H], [iso.W, iso.H]].map(([a, b]) => isoToWorld(a, b));
  return {
    x0: Math.min(...pts.map(p => p.x)) - pad, x1: Math.max(...pts.map(p => p.x)) + pad,
    y0: Math.min(...pts.map(p => p.y)) - pad, y1: Math.max(...pts.map(p => p.y)) + pad
  };
}

// draw something that lies flat on the ground (boards, etc.) in the ground plane
function withGroundPlane(S, fn) {
  ctx.save();
  ctx.translate(S.x, S.y);
  ctx.transform(ISO_K, ISO_K / 2, -ISO_K, ISO_K / 2, 0, 0);
  fn();
  ctx.restore();
}

// ---------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------
function isoBuildingHeight(b) {
  if (b._isoH) return b._isoH;
  let h = Math.max(56, b.wallDepth * 1.3);
  if (/Apartments|Hotel|Hospital|Police|Court|Bank|Office|Tower|Casino|Mega|Museum|City Hall|Jail/.test(b.name || '')) {
    h += 50 + hashNoise(b.x, b.y) * 40;
  } else if (!isResidential(b)) {
    h += hashNoise(b.x, b.y) * 30;
  }
  return (b._isoH = Math.round(h));
}
function isoFootprint(b) {
  return { x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h + b.wallDepth };
}
function isoBuildingScreenBox(b) {
  const f = isoFootprint(b), H = isoBuildingHeight(b);
  return {
    left: isoS(f.x0, f.y1).x, right: isoS(f.x1, f.y0).x,
    top: isoS(f.x0, f.y0, H).y - 24, bottom: isoS(f.x1, f.y1).y
  };
}
function isoFacadeProxies(b) {
  if (b._isoProxies) return b._isoProxies;
  const f = isoFootprint(b), H = isoBuildingHeight(b), D = f.y1 - f.y0;
  const base = { name: b.name, seedy: b.seedy, wall: b.wall, roof: b.roof };
  return (b._isoProxies = {
    south: { ...base, x: f.x0, y: 0, w: b.w, h: 0, wallDepth: H, doorZone: { x: b.doorZone.x, w: b.doorZone.w } },
    east: { ...base, x: f.x1 * 7 + 13, y: 0, w: D, h: 0, wallDepth: H, doorZone: null },
    roof: { ...base, x: f.x0, y: 0, w: b.w, h: D }
  });
}

function drawIsoBuilding(b, nightFactor, faded) {
  const f = isoFootprint(b), H = isoBuildingHeight(b), D = f.y1 - f.y0;
  const px = isoFacadeProxies(b);
  const K = ISO_K;
  ctx.save();
  if (faded) ctx.globalAlpha = 0.35;
  ctx.save();

  // south face (front-left on screen) - carries the door
  const T = isoS(f.x0, f.y1, H);
  ctx.restore(); ctx.save();
  ctx.transform(K, K / 2, 0, 1, T.x - K * f.x0, T.y - (K / 2) * f.x0);
  ctx.fillStyle = b.wall;
  ctx.fillRect(f.x0, 0, b.w, H);
  drawBuildingWall(px.south, f.x0, 0);
  drawBuildingWindows(px.south, 0, 0, nightFactor);
  drawBuildingDoor(px.south, 0, 0, 0, nightFactor);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.strokeRect(f.x0, 0, b.w, H);

  // east face (front-right on screen), a shade darker
  const E = isoS(f.x1, f.y1, H);
  ctx.restore(); ctx.save();
  ctx.transform(K, -K / 2, 0, 1, E.x - K * px.east.x, E.y + (K / 2) * px.east.x);
  ctx.fillStyle = b.wall;
  ctx.fillRect(px.east.x, 0, D, H);
  drawBuildingWall(px.east, px.east.x, 0);
  drawBuildingWindows(px.east, 0, 0, nightFactor);
  ctx.fillStyle = 'rgba(20,10,30,0.22)';
  ctx.fillRect(px.east.x, 0, D, H);
  ctx.strokeStyle = INK;
  ctx.strokeRect(px.east.x, 0, D, H);

  // roof, in the ground plane but lifted by H
  const R = isoS(0, f.y0, H);
  ctx.restore(); ctx.save();
  ctx.transform(K, K / 2, -K, K / 2, R.x, R.y);
  ctx.fillStyle = b.roof;
  ctx.fillRect(f.x0, 0, b.w, D);
  drawBuildingRoof(px.roof, f.x0, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.strokeRect(f.x0, 0, b.w, D);
  // lit cornice along the two front roof edges
  ctx.fillStyle = 'rgba(255,240,220,0.18)';
  ctx.fillRect(f.x0, D - 3, b.w, 3);
  ctx.fillRect(f.x0 + b.w - 3, 0, 3, D);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.strokeRect(f.x0, 0, b.w, D);

  ctx.restore();

  // name sign floating over the roof
  if (b.name) {
    const c = isoS((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, H);
    const neon = NIGHTLIFE_SIGN_COLORS[b.name];
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(b.name).width;
    if (neon && nightFactor > 0.15) {
      const flicker = hashNoise(b.x, Math.floor(performance.now() / 120)) > 0.12 ? 1 : 0.35;
      ctx.shadowColor = neon; ctx.shadowBlur = 12 * nightFactor * flicker;
      ctx.fillStyle = 'rgba(10,5,15,0.75)';
      ctx.fillRect(c.x - tw / 2 - 7, c.y - 16, tw + 14, 19);
      ctx.fillStyle = neon;
      ctx.fillText(b.name, c.x, c.y - 2);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(c.x - tw / 2 - 6, c.y - 15, tw + 12, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(b.name, c.x, c.y - 2);
    }
  }
  ctx.restore();
}

// yards/walkways and cast shadows, drawn flat inside the ground pass
function drawIsoBuildingGround(camX, camY, bb) {
  buildings.forEach(b => {
    const f = isoFootprint(b);
    if (f.x1 < bb.x0 || f.x0 > bb.x1 || f.y1 + 40 < bb.y0 || f.y0 > bb.y1) return;
    const H = isoBuildingHeight(b);
    // shadow falls to the east (screen down-right)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(f.x1 - camX, f.y0 - camY);
    ctx.lineTo(f.x1 + H * 0.55 - camX, f.y0 + H * 0.25 - camY);
    ctx.lineTo(f.x1 + H * 0.55 - camX, f.y1 - camY);
    ctx.lineTo(f.x1 - camX, f.y1 - camY);
    ctx.fill();
    if (b.yardDepth > 0) {
      const yy = f.y1 - camY;
      ctx.fillStyle = b.seedy ? '#4a4438' : '#5a8f4f';
      ctx.fillRect(f.x0 - camX, yy, b.w, b.yardDepth);
      ctx.fillStyle = b.seedy ? '#5a5548' : '#a89c80';
      ctx.fillRect(b.doorZone.x - camX, yy, b.doorZone.w, b.yardDepth);
    }
  });
}

// ---------------------------------------------------------------------
// Night lighting in screen space
// ---------------------------------------------------------------------
function drawIsoNightLighting(nightFactor, visibleBuildings) {
  if (nightFactor < 0.03) return;
  const W = Math.ceil(iso.W), H = Math.ceil(iso.H);
  if (!lightCanvas || lightCanvas.width !== W || lightCanvas.height !== H) {
    [lightCanvas, lightCtx] = makeCanvas(W, H);
  }
  const on = (p, pad) => p.x > -pad && p.x < W + pad && p.y > -pad && p.y < H + pad;
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.clearRect(0, 0, W, H);
  lightCtx.fillStyle = `rgba(6,10,34,${(nightFactor * 0.82).toFixed(3)})`;
  lightCtx.fillRect(0, 0, W, H);
  lightCtx.globalCompositeOperation = 'destination-out';
  const warm = [];

  STREET_LAMPS.forEach(l => {
    const p = isoS(l.x, l.y);
    if (!on(p, 150)) return;
    punchLight(p.x, p.y - 6, 105, 0.85);
    warm.push([p.x, p.y - 40, 70, 'rgba(255,200,120,ALPHA)', 0.18]);
  });
  visibleBuildings.forEach(b => {
    const f = isoFootprint(b), Hh = isoBuildingHeight(b), px = isoFacadeProxies(b);
    buildingWindows(px.south).forEach(win => {
      if (!win.lit) return;
      const p = isoS(win.x + win.w / 2, f.y1, Hh - (win.y + win.h / 2));
      punchLight(p.x, p.y, 20, 0.9);
    });
    buildingWindows(px.east).forEach(win => {
      if (!win.lit) return;
      const along = win.x + win.w / 2 - px.east.x;
      const p = isoS(f.x1, f.y1 - along, Hh - (win.y + win.h / 2));
      punchLight(p.x, p.y, 20, 0.9);
    });
    const d = isoS(b.doorZone.x + b.doorZone.w / 2, f.y1 + 6);
    punchLight(d.x, d.y, 55, 0.7);
    warm.push([d.x, d.y - 10, 45, 'rgba(255,210,140,ALPHA)', 0.12]);
    const neon = NIGHTLIFE_SIGN_COLORS[b.name];
    if (neon) {
      const c = isoS((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, Hh);
      punchLight(c.x, c.y, 80, 0.6);
      warm.push([c.x, c.y, 80, hexToRgbaTemplate(neon), 0.22]);
    }
  });
  const vehicleLight = (x, y, facing) => {
    const dir = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[facing] || [0, 1];
    const a = isoS(x + dir[0] * 55, y + dir[1] * 55), b2 = isoS(x + dir[0] * 110, y + dir[1] * 110);
    if (!on(a, 160)) return;
    punchLight(a.x, a.y, 55, 0.8);
    punchLight(b2.x, b2.y, 50, 0.5);
    warm.push([a.x, a.y, 55, 'rgba(255,245,200,ALPHA)', 0.1]);
  };
  const axisFacing = v => v.axis === 'h' ? (v.dir > 0 ? 'right' : 'left') : (v.dir > 0 ? 'down' : 'up');
  trafficCars.forEach(c => vehicleLight(c.x, c.y, axisFacing(c)));
  trafficBikes.forEach(c => vehicleLight(c.x, c.y, axisFacing(c)));
  if (player.onCar || player.onMotorcycle) vehicleLight(player.x + player.w / 2, player.y + player.h, player.facing);
  const me = isoS(player.x + player.w / 2, player.y + player.h);
  punchLight(me.x, me.y - 20, 90, 0.55);

  ctx.drawImage(lightCanvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  warm.forEach(([x, y, r, col, a]) => glowLight(x, y, r, col, a * nightFactor));
  ctx.restore();
}

// ---------------------------------------------------------------------
// The outside scene
// ---------------------------------------------------------------------
function drawOutsideIso() {
  const realW = canvas.width, realH = canvas.height;
  iso.Z = isoZoom(realW, realH);
  iso.W = realW / iso.Z; iso.H = realH / iso.Z;
  iso.ax = player.x + player.w / 2;
  iso.ay = player.y + player.h;
  const now = performance.now();
  const nightFactor = getNightFactor(now);

  ctx.fillStyle = '#1e2620';
  ctx.fillRect(0, 0, realW, realH);
  ctx.save();
  ctx.scale(iso.Z, iso.Z);

  // ---- ground pass: regular draw functions through the iso transform ----
  const bb = isoWorldBounds(120);
  const camX = bb.x0, camY = bb.y0;
  const o = isoS(camX, camY);
  ctx.save();
  ctx.transform(ISO_K, ISO_K / 2, -ISO_K, ISO_K / 2, o.x, o.y);
  isoViewSize = { w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 };
  try {
    drawGroundLayer(camX, camY);
    drawFarmFields(camX, camY);
    drawLakePaths(camX, camY);
    drawFarmPaths(camX, camY);
    drawHikingTrail(camX, camY);
    drawRoads(camX, camY);
    drawNorthRoads(camX, camY);
    drawWestRoad(camX, camY);
    drawRiver(camX, camY);
    drawRiver(camX, camY, RIVER2_Y, RIVER2_H, NORTH_ROADS, 'wood');
    drawParkGround(camX, camY);
    drawLake(camX, camY);
    drawLake(camX, camY, LAKE2);
    drawLake(camX, camY, LAKE3);
    drawDock(camX, camY);
    drawShoreAndBoardwalk(camX, camY);
    drawOcean(camX, camY);
    drawRidgeRoad(camX, camY);
    drawLoopTrails(camX, camY);
    drawTrackRamps(camX, camY);
    drawMountainWall(camX, camY);
    drawMountainWallEast(camX, camY);
    drawIsoBuildingGround(camX, camY, bb);
  } finally {
    isoViewSize = null;
    ctx.restore();
  }

  // ---- low decor (flowers, rocks, props) standing upright ----
  const x0 = Math.floor(bb.x0 / DECOR_BUCKET), x1 = Math.floor(bb.x1 / DECOR_BUCKET);
  const y0 = Math.floor(bb.y0 / DECOR_BUCKET), y1 = Math.floor(bb.y1 / DECOR_BUCKET);
  for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
    const list = DECOR_BUCKETS.get(bx + ',' + by);
    if (!list) continue;
    for (const d of list) {
      const S = isoS(d.x, d.y);
      if (S.x < -40 || S.x > iso.W + 40 || S.y < -40 || S.y > iso.H + 40) continue;
      const sx = Math.round(S.x - d.s.ax), sy = Math.round(S.y - d.s.ay);
      if (d.flip) { ctx.save(); ctx.translate(sx + d.s.c.width, sy); ctx.scale(-1, 1); ctx.drawImage(d.s.c, 0, 0); ctx.restore(); }
      else ctx.drawImage(d.s.c, sx, sy);
    }
  }

  // ---- upright pass ----
  const inView = (x, y, pad) => x > bb.x0 - pad && x < bb.x1 + pad && y > bb.y0 - pad && y < bb.y1 + pad;
  const points = [];
  const add = (x, y, draw, wide) => { if (inView(x, y, 80)) points.push({ x, y, draw, wide }); };
  const phase = getLightPhase(now);
  const axisFacing = v => v.axis === 'h' ? (v.dir > 0 ? 'right' : 'left') : (v.dir > 0 ? 'down' : 'up');
  const person = (x, y, ent, opts, label, bloodOff) => add(x, y, S => {
    const bo = bloodOff || { x: 0, y: 0 };
    if (ent && ent.bloodX !== undefined) {
      const B = isoS(ent.bloodX + bo.x, ent.bloodY + bo.y);
      drawBloodSpot(ent, ent.bloodX - B.x, ent.bloodY - B.y);
    }
    drawDude(S.x, S.y, opts.color, label || null, opts);
  });
  const look = (c, extra) => ({ color: c.color, gender: c.gender, hairColor: c.hairColor, hairstyle: c.hairstyle, skinTone: c.skinTone, skirt: c.skirt, skirtColor: c.skirtColor, dirty: c.dirty, ...extra });
  const down = c => c.knockedDownUntil && now < c.knockedDownUntil;

  TRAFFIC_LIGHTS.forEach(l => add(l.x, l.y, S => drawTrafficLight(l.x, l.y, phase[l.axis], l.x - S.x, l.y - S.y)));
  STREET_LAMPS.forEach(l => add(l.x, l.y, S => drawStreetLamp(l.x, l.y, l.x - S.x, l.y - S.y, nightFactor)));
  PARK_TREES.forEach(t => { const x = PARK.x + t.x, y = PARK.y + t.y; add(x, y, S => drawTree(x, y, x - S.x, y - S.y)); });
  [...CITY_TREES, ...FOREST_TREES, ...WEST_FOREST_TREES].forEach(t => add(t.x, t.y, S => t.pine ? drawPineTree(t.x, t.y, t.x - S.x, t.y - S.y, t.scale) : drawTree(t.x, t.y, t.x - S.x, t.y - S.y, t.scale)));
  LIFEGUARD_STANDS.forEach(s => add(s.x, s.y, S => drawLifeguardStand(s.x, s.y, s.x - S.x, s.y - S.y)));
  QUEST_SPOTS.filter(s => questSpotVisible(s, player)).forEach(s => add(s.x, s.y, S => drawQuestSpot(s, s.x - S.x, s.y - S.y)));

  citizens.filter(c => c.state !== 'inside').forEach(c => person(c.x, c.y, c, look(c, { facing: c.facing, knockedDown: down(c), moving: !!c.path })));
  parkWalkers.forEach(w => person(PARK.x + w.x, PARK.y + w.y, w, look(w, { knockedDown: down(w), moving: Math.hypot(w.targetX - w.x, w.targetY - w.y) > 2 }), null, { x: PARK.x, y: PARK.y }));
  farmhands.forEach(w => person(w.x, w.y, w, look(w, { knockedDown: down(w), moving: Math.hypot(w.targetX - w.x, w.targetY - w.y) > 2 })));
  lakeSwimmers.forEach(w => person(w.x, w.y, w, look(w, { knockedDown: down(w), swimming: !down(w), moving: Math.hypot(w.targetX - w.x, w.targetY - w.y) > 2 })));

  const parkedMoto = (p) => add(p.x, p.y, S => drawIsoMotorcycle(S, p.facing, p.color, false), true);
  const parkedCar = (p) => add(p.x, p.y, S => drawIsoCar(S, p.facing, p.color, false, nightFactor), true);
  if (motorcycleParked) parkedMoto(motorcycleParked);
  if (!player.hasMotorcycle) parkedMoto(MOTO_SHOWROOM_SPOT);
  if (carParked) parkedCar(carParked);
  if (!player.hasCar) parkedCar(CAR_SHOWROOM_SPOT);
  if (boatParked) add(boatParked.x, boatParked.y, S => withGroundPlane(S, () => drawPaddleboard(0, 0, boatParked.facing, player.boatColor)), true);
  if (surfboardParked) add(surfboardParked.x, surfboardParked.y, S => withGroundPlane(S, () => drawSurfboard(0, 0, surfboardParked.facing, player.surfboardColor)), true);
  trafficCars.forEach(car => add(car.x, car.y, S => drawIsoCar(S, axisFacing(car), car.color, car.police, nightFactor), true));
  trafficBikes.forEach(bike => add(bike.x, bike.y, S => {
    const f = axisFacing(bike), r = bike.rider;
    drawIsoMotorcycle(S, f, bike.color, nightFactor > 0.3);
    drawIsoRider(S, f, { color: r.color, gender: r.gender, hairColor: r.hairColor, hairstyle: r.hairstyle, skinTone: r.skinTone });
  }, true));

  // the player
  const ppx = player.x + player.w / 2, ppy = player.y + player.h;
  add(ppx, ppy, S => drawIsoPlayer(S, nightFactor, now), player.onCar);

  // buildings + depth ordering
  const vis = buildings.filter(b => { const f = isoFootprint(b); return f.x1 > bb.x0 - 60 && f.x0 < bb.x1 + 60 && f.y1 > bb.y0 - 60 && f.y0 < bb.y1 + 260; });
  vis.forEach(b => { const f = isoFootprint(b); b._isoKey = (f.x0 + f.x1) / 2 + (f.y0 + f.y1) / 2; b._isoBox = isoBuildingScreenBox(b); });
  vis.sort((a, b) => a._isoKey - b._isoKey);
  const slots = vis.map(() => []);
  const before = [];
  const me = isoS(ppx, ppy);
  points.forEach(p => {
    const S = isoS(p.x, p.y);
    p.S = S;
    const hw = p.wide ? 70 : 30;
    let slot = -1;
    vis.forEach((b, i) => {
      const box = b._isoBox;
      if (S.x + hw < box.left || S.x - hw > box.right || S.y < box.top || S.y - 90 > box.bottom) return;
      const f = isoFootprint(b);
      const inFront = p.x >= f.x1 - 1 || p.y >= f.y1 - 1;
      if (inFront && i > slot) slot = i;
    });
    (slot < 0 ? before : slots[slot]).push(p);
  });
  const drawPts = list => list.sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(p => p.draw(p.S));
  drawPts(before);
  vis.forEach((b, i) => {
    const f = isoFootprint(b), box = b._isoBox;
    const behind = !(ppx >= f.x1 - 1 || ppy >= f.y1 - 1) &&
      me.x > box.left + 10 && me.x < box.right - 10 && me.y < box.bottom - 10 && me.y > box.top;
    drawIsoBuilding(b, nightFactor, behind);
    drawPts(slots[i]);
  });

  // bullets
  bullets.forEach(b => {
    if (b.scene !== 'outside') return;
    const S = isoS(b.x, b.y);
    ctx.save();
    ctx.translate(S.x, S.y);
    ctx.rotate(Math.atan2((b.vx + b.vy) * 0.5, b.vx - b.vy));
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  drawCloudShadows(iso.ax, iso.ay, nightFactor);
  drawIsoNightLighting(nightFactor, vis);

  ctx.restore(); // back to real screen pixels for vignette + HUD prompts

  const vignette = ctx.createRadialGradient(realW / 2, realH / 2, Math.min(realW, realH) * 0.35, realW / 2, realH / 2, Math.max(realW, realH) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, realW, realH);

  drawRideHints();
  drawDialogueUI();
}

function drawIsoPlayer(S, nightFactor, now) {
  const look = { facing: player.facing, gender: player.gender, hairColor: player.hairColor, hairstyle: player.hairstyle, skinTone: player.skinTone, gunEquipped: player.gunEquipped, knockedDown: now < playerHitUntil };
  if (player.bloodX !== undefined) { const B = isoS(player.bloodX, player.bloodY); drawBloodSpot(player, player.bloodX - B.x, player.bloodY - B.y); }

  if (player.onCar) {
    drawIsoCar(S, player.facing, player.carColor, false, nightFactor);
    return;
  }
  if (player.onBoat) {
    withGroundPlane(S, () => drawPaddleboard(0, 0, player.facing, player.boatColor));
    drawDude(S.x, S.y, '#3a6fd8', null, { ...look, moving: false });
    return;
  }
  if (player.onSurfboard) {
    const distLeft = OCEAN_X1 - (player.x + player.w / 2);
    const prog = player.ridingWave ? 1 - Math.min(1, Math.max(0, distLeft / player.ridingStartDist)) : 0;
    const lift = player.ridingWave ? Math.sin(prog * Math.PI) * 22 * WAVE_TALL_MULT : 0;
    const L = { x: S.x, y: S.y - lift };
    withGroundPlane(L, () => drawSurfboard(0, 0, player.facing, player.surfboardColor));
    drawDude(L.x, L.y, '#3a6fd8', null, { ...look, moving: false });
    return;
  }

  // on foot or on the motorcycle (with jump / wheelie)
  const jumpLeft = player.jumpUntil - now;
  const isJumping = player.onMotorcycle && jumpLeft > 0;
  let lift = 0;
  if (isJumping) {
    const jp = 1 - jumpLeft / player.jumpTotalMs;
    const j = Math.sin(jp * Math.PI) * player.jumpHeightMult;
    lift = j * 34;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(S.x, S.y + 2, 22 * Math.max(0.3, 1 - j * 0.5), 9 * Math.max(0.3, 1 - j * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  } else if (player.onMotorcycle) {
    lift = rampGroundLift(player.x + player.w / 2, player.y + player.h / 2) * 0.4 * 34;
  }
  ctx.save();
  ctx.translate(S.x, S.y - lift);
  const wheelieLeft = player.wheelieUntil - now;
  if (player.onMotorcycle && wheelieLeft > 0) {
    // tip back around the rear wheel, toward the screen side the bike's tail points at
    const tailScreenX = isoVehPt({ x: 0, y: 0 }, ISO_DIRS[player.facing] || ISO_DIRS.right, -1, 0, 0).x;
    const prog = 1 - wheelieLeft / WHEELIE_DURATION;
    ctx.rotate((tailScreenX < 0 ? 1 : -1) * Math.sin(prog * Math.PI) * 0.35);
  }
  if (player.onMotorcycle) {
    drawIsoMotorcycle({ x: 0, y: 0 }, player.facing, player.motoColor, nightFactor > 0.3);
    drawIsoRider({ x: 0, y: 0 }, player.facing, { ...look, color: '#3a6fd8', gunEquipped: false });
  } else {
    drawDude(0, 0, '#3a6fd8', null, {
      ...look,
      muzzleFlash: now < muzzleFlashUntil, swimming: player.swimming, moving: player.moving
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// 3D vehicles built from shaded boxes
// ---------------------------------------------------------------------
const ISO_DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

// project a point given in vehicle space (s = forward, w = across, z = up)
function isoVehPt(S, dir, s, w, z) {
  const u = s * dir[0] - w * dir[1], v = s * dir[1] + w * dir[0];
  return { x: S.x + (u - v) * ISO_K, y: S.y + (u + v) * ISO_K / 2 - z };
}
function isoPoly(pts, fill, ink) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fill();
  if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = 0.75; ctx.lineJoin = 'round'; ctx.stroke(); }
}
// box in vehicle space; only faces turned toward the camera (+x / +y world) are drawn
function isoVehBox(S, dir, s0, s1, w0, w1, z0, z1, top, side, opts) {
  opts = opts || {};
  const ink = opts.outline === false ? null : INK;
  const P = (s, w, z) => isoVehPt(S, dir, s, w, z);
  const across = [-dir[1], dir[0]];
  const faces = [
    { n: dir, pts: [P(s1, w0, z0), P(s1, w1, z0), P(s1, w1, z1), P(s1, w0, z1)], key: 'front' },
    { n: [-dir[0], -dir[1]], pts: [P(s0, w0, z0), P(s0, w1, z0), P(s0, w1, z1), P(s0, w0, z1)], key: 'back' },
    { n: across, pts: [P(s0, w1, z0), P(s1, w1, z0), P(s1, w1, z1), P(s0, w1, z1)], key: 'right' },
    { n: [-across[0], -across[1]], pts: [P(s0, w0, z0), P(s1, w0, z0), P(s1, w0, z1), P(s0, w0, z1)], key: 'left' }
  ];
  faces.forEach(f => {
    if (f.n[0] + f.n[1] <= 0) return;
    // +y faces catch more light than +x faces
    const col = (opts[f.key]) || (f.n[1] > 0 ? side : shadeColor(side, -14));
    isoPoly(f.pts, col, ink);
  });
  isoPoly([P(s0, w0, z1), P(s1, w0, z1), P(s1, w1, z1), P(s0, w1, z1)], top, ink);
}
// which side-faces of a vehicle are visible from the camera
function isoVehVisible(dir) {
  const across = [-dir[1], dir[0]];
  return { front: dir[0] + dir[1] > 0, back: dir[0] + dir[1] < 0, right: across[0] + across[1] > 0, left: across[0] + across[1] < 0 };
}

function drawIsoCar(S, facing, color, police, nightFactor) {
  const dir = ISO_DIRS[facing] || ISO_DIRS.right;
  const vis = isoVehVisible(dir);
  const L = 33, Wd = 15;                       // half-length / half-width
  const body = police ? '#f2f2f0' : (color || '#8f2e2e');
  const lit = nightFactor > 0.3;

  // contact shadow
  isoPoly([isoVehPt(S, dir, -L - 2, -Wd - 2, 0), isoVehPt(S, dir, L + 2, -Wd - 2, 0), isoVehPt(S, dir, L + 4, Wd + 4, 0), isoVehPt(S, dir, -L + 2, Wd + 4, 0)], 'rgba(0,0,0,0.32)');

  const wheel = (s, side) => {
    const w0 = side > 0 ? Wd - 5 : -Wd - 1, w1 = side > 0 ? Wd + 1 : -Wd + 5;
    isoVehBox(S, dir, s - 7, s + 7, w0, w1, 0, 11, '#1a1a1a', '#202020');
    // hubcap on the outer face when it faces us
    const outerVisible = side > 0 ? vis.right : vis.left;
    if (outerVisible) {
      const c = isoVehPt(S, dir, s, side > 0 ? w1 : w0, 5.5);
      ctx.fillStyle = '#b8bcc0';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 3, 3.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
    }
  };
  const wheels = [[-L + 10, -1], [L - 10, -1], [-L + 10, 1], [L - 10, 1]];
  const nearSide = vis.right ? 1 : -1;
  wheels.filter(([, sd]) => sd !== nearSide).forEach(([s, sd]) => wheel(s, sd));

  // lower body with a darker rocker panel
  isoVehBox(S, dir, -L, L, -Wd, Wd, 3, 7, shadeColor(body, -30), shadeColor(body, -30));
  isoVehBox(S, dir, -L, L, -Wd, Wd, 7, 15, shadeColor(body, 10), police ? '#1c1c1c' : body);
  if (police) isoVehBox(S, dir, -L * 0.45, L * 0.35, -Wd - 0.2, Wd + 0.2, 7, 15, '#f2f2f0', '#f2f2f0');
  wheels.filter(([, sd]) => sd === nearSide).forEach(([s, sd]) => wheel(s, sd));

  // lights on whichever end faces us
  if (vis.front) {
    [-Wd + 3, Wd - 7].forEach(w => isoVehBox(S, dir, L - 0.5, L + 0.5, w, w + 4, 10, 13, '#fff6c8', lit ? '#fff8d0' : '#e8e0b0'));
    isoVehBox(S, dir, L - 0.5, L + 1, -Wd + 1, Wd - 1, 4, 6, '#8a8e92', '#a0a4a8'); // bumper
  }
  if (vis.back) {
    [-Wd + 3, Wd - 7].forEach(w => isoVehBox(S, dir, -L - 0.5, -L + 0.5, w, w + 4, 10, 13, '#ff4a3a', lit ? '#ff5040' : '#c82a20'));
    isoVehBox(S, dir, -L - 1, -L + 0.5, -Wd + 1, Wd - 1, 4, 6, '#8a8e92', '#a0a4a8');
  }

  // cabin: glass sides with a body-colored roof
  const glass = { front: '#3a5068', back: '#34485e', right: '#40566e', left: '#40566e' };
  isoVehBox(S, dir, -L * 0.42, L * 0.22, -Wd + 2, Wd - 2, 15, 26, police ? '#f2f2f0' : shadeColor(body, 14), '#40566e', glass);
  // glass glint + pillars
  const gl = vis.right ? Wd - 2 : -Wd + 2;
  const a = isoVehPt(S, dir, -L * 0.1, gl, 25), b = isoVehPt(S, dir, L * 0.05, gl, 17);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = police ? '#f2f2f0' : body; ctx.lineWidth = 1.6;
  const p1 = isoVehPt(S, dir, -L * 0.1, gl, 15), p2 = isoVehPt(S, dir, -L * 0.1, gl, 26);
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

  if (police) {
    const on = Math.floor(performance.now() / 250) % 2 === 0;
    isoVehBox(S, dir, -L * 0.2, L * 0.02, -Wd + 3, -1, 26, 29, on ? '#ff3a3a' : '#7a1a1a', on ? '#ff3a3a' : '#7a1a1a');
    isoVehBox(S, dir, -L * 0.2, L * 0.02, 1, Wd - 3, 26, 29, on ? '#1a2a7a' : '#3a6aff', on ? '#1a2a7a' : '#3a6aff');
  }
}

function drawIsoMotorcycle(S, facing, color, lit) {
  const dir = ISO_DIRS[facing] || ISO_DIRS.right;
  const vis = isoVehVisible(dir);
  const body = color || '#8f2e2e';
  const P = (s, w, z) => isoVehPt(S, dir, s, w, z);
  isoPoly([P(-20, -4, 0), P(20, -4, 0), P(21, 5, 0), P(-19, 5, 0)], 'rgba(0,0,0,0.3)');

  // wheels: tire = two offset rims for thickness, then spokes
  const wheel = (s) => {
    const R = 8;
    [-1.8, 1.8].forEach(w => {
      ctx.save();
      const o = P(s, w, R);
      const ax = P(s + 1, w, R), az = P(s, w, R + 1);
      // relative transform so it composes with jump/wheelie transforms
      ctx.translate(o.x, o.y);
      ctx.transform(ax.x - o.x, ax.y - o.y, az.x - o.x, az.y - o.y, 0, 0);
      ctx.fillStyle = '#161616';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.7; ctx.stroke();
      if (w > 0 === vis.right) {
        ctx.fillStyle = '#9aa0a6';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  };
  const line = (a, b, col, wdt) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

  wheel(-14);
  // frame, swingarm, engine
  line(P(-14, 0, 8), P(-2, 0, 10), '#2a2a2a', 2.2);
  isoVehBox(S, dir, -5, 6, -3.5, 3.5, 4, 12, '#5a5e64', '#4a4e54');
  // exhaust on the visible side
  const ex = vis.right ? 4.5 : -4.5;
  line(P(2, ex, 6), P(-15, ex, 9), '#b8b8b8', 2.4);
  // seat + tank + tail
  isoVehBox(S, dir, -15, -2, -3.5, 3.5, 12, 15, '#1e1e1e', '#2a2a2a');
  isoVehBox(S, dir, -1, 9, -4.5, 4.5, 12, 18, shadeColor(body, 16), body);
  isoVehBox(S, dir, -19, -14, -3, 3, 12, 16, shadeColor(body, 10), body);
  wheel(14);
  // fork, handlebars, headlight
  line(P(14, 0, 8), P(10, 0, 22), '#c0c4c8', 2.2);
  line(P(10, -9, 23), P(10, 9, 23), '#1c1c1c', 2);
  if (vis.front) {
    const h = P(13, 0, 19);
    ctx.fillStyle = lit ? '#fff8d0' : '#e8e0b0';
    ctx.beginPath(); ctx.arc(h.x, h.y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  if (vis.back) {
    const tl = P(-19.5, 0, 14);
    ctx.fillStyle = '#e83a2a'; ctx.fillRect(tl.x - 2, tl.y - 1, 4, 2.4);
  }
}

// rider seated on an iso bike
function drawIsoRider(S, facing, look) {
  drawDude(S.x, S.y - 4, look.color, null, { ...look, facing, riding: true, isoRide: true });
}
