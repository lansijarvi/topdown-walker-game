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

const ISO_K = 0.9;                 // screen px per world unit along each axis
const iso = { ax: 0, ay: 0, W: 0, H: 0 };

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

// map a facing (world axis) onto the side-profile art + a skew that lines
// the profile up with that axis on screen
const ISO_ART = { right: ['right', 0.5], left: ['left', 0.5], down: ['left', -0.5], up: ['right', -0.5] };
function isoArt(facing) { return (ISO_ART[facing] || ISO_ART.right)[0]; }
function withIsoSkew(S, facing, fn) {
  const [art, slope] = ISO_ART[facing] || ISO_ART.right;
  ctx.save();
  ctx.translate(S.x, S.y);
  ctx.transform(1, slope, 0, 1, 0, 0);
  fn(art);
  ctx.restore();
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

  // south face (front-left on screen) - carries the door
  const T = isoS(f.x0, f.y1, H);
  ctx.setTransform(K, K / 2, 0, 1, T.x - K * f.x0, T.y - (K / 2) * f.x0);
  ctx.fillStyle = b.wall;
  ctx.fillRect(f.x0, 0, b.w, H);
  drawBuildingWall(px.south, f.x0, 0);
  drawBuildingWindows(px.south, 0, 0, nightFactor);
  drawBuildingDoor(px.south, 0, 0, 0, nightFactor);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(f.x0, 0, b.w, H);

  // east face (front-right on screen), a shade darker
  const E = isoS(f.x1, f.y1, H);
  ctx.setTransform(K, -K / 2, 0, 1, E.x - K * px.east.x, E.y + (K / 2) * px.east.x);
  ctx.fillStyle = b.wall;
  ctx.fillRect(px.east.x, 0, D, H);
  drawBuildingWall(px.east, px.east.x, 0);
  drawBuildingWindows(px.east, 0, 0, nightFactor);
  ctx.fillStyle = 'rgba(20,10,30,0.22)';
  ctx.fillRect(px.east.x, 0, D, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeRect(px.east.x, 0, D, H);

  // roof, in the ground plane but lifted by H
  const R = isoS(0, f.y0, H);
  ctx.setTransform(K, K / 2, -K, K / 2, R.x, R.y);
  ctx.fillStyle = b.roof;
  ctx.fillRect(f.x0, 0, b.w, D);
  drawBuildingRoof(px.roof, f.x0, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.strokeRect(f.x0, 0, b.w, D);
  // lit cornice along the two front roof edges
  ctx.fillStyle = 'rgba(255,240,220,0.18)';
  ctx.fillRect(f.x0, D - 3, b.w, 3);
  ctx.fillRect(f.x0 + b.w - 3, 0, 3, D);

  ctx.setTransform(1, 0, 0, 1, 0, 0);

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
  if (!lightCanvas || lightCanvas.width !== iso.W || lightCanvas.height !== iso.H) {
    [lightCanvas, lightCtx] = makeCanvas(iso.W, iso.H);
  }
  const W = iso.W, H = iso.H;
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
  iso.W = canvas.width; iso.H = canvas.height;
  iso.ax = player.x + player.w / 2;
  iso.ay = player.y + player.h;
  const now = performance.now();
  const nightFactor = getNightFactor(now);

  ctx.fillStyle = '#1e2620';
  ctx.fillRect(0, 0, iso.W, iso.H);

  // ---- ground pass: regular draw functions through the iso transform ----
  const bb = isoWorldBounds(120);
  const camX = bb.x0, camY = bb.y0;
  const o = isoS(camX, camY);
  ctx.save();
  ctx.setTransform(ISO_K, ISO_K / 2, -ISO_K, ISO_K / 2, o.x, o.y);
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

  const parkedMoto = (p) => add(p.x, p.y, S => withIsoSkew(S, p.facing, art => drawMotorcycle(0, 0, art, p.color)), true);
  const parkedCar = (p) => add(p.x, p.y, S => withIsoSkew(S, p.facing, art => drawCar(0, 0, art, p.color, false, nightFactor)), true);
  if (motorcycleParked) parkedMoto(motorcycleParked);
  if (!player.hasMotorcycle) parkedMoto(MOTO_SHOWROOM_SPOT);
  if (carParked) parkedCar(carParked);
  if (!player.hasCar) parkedCar(CAR_SHOWROOM_SPOT);
  if (boatParked) add(boatParked.x, boatParked.y, S => withGroundPlane(S, () => drawPaddleboard(0, 0, boatParked.facing, player.boatColor)), true);
  if (surfboardParked) add(surfboardParked.x, surfboardParked.y, S => withGroundPlane(S, () => drawSurfboard(0, 0, surfboardParked.facing, player.surfboardColor)), true);
  trafficCars.forEach(car => add(car.x, car.y, S => withIsoSkew(S, axisFacing(car), art => drawCar(0, 0, art, car.color, car.police, nightFactor)), true));
  trafficBikes.forEach(bike => add(bike.x, bike.y, S => {
    const f = axisFacing(bike), r = bike.rider;
    withIsoSkew(S, f, art => drawMotorcycle(0, 0, art, bike.color, true));
    drawDude(S.x, S.y, r.color, null, { facing: isoArt(f), gender: r.gender, hairColor: r.hairColor, hairstyle: r.hairstyle, skinTone: r.skinTone, riding: true });
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

  const vignette = ctx.createRadialGradient(iso.W / 2, iso.H / 2, Math.min(iso.W, iso.H) * 0.35, iso.W / 2, iso.H / 2, Math.max(iso.W, iso.H) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, iso.W, iso.H);

  drawRideHints();
  drawDialogueUI();
}

function drawIsoPlayer(S, nightFactor, now) {
  const look = { facing: player.facing, gender: player.gender, hairColor: player.hairColor, hairstyle: player.hairstyle, skinTone: player.skinTone, gunEquipped: player.gunEquipped, knockedDown: now < playerHitUntil };
  if (player.bloodX !== undefined) { const B = isoS(player.bloodX, player.bloodY); drawBloodSpot(player, player.bloodX - B.x, player.bloodY - B.y); }

  if (player.onCar) {
    withIsoSkew(S, player.facing, art => drawCar(0, 0, art, player.carColor, false, nightFactor));
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
    const art = isoArt(player.facing);
    const prog = 1 - wheelieLeft / WHEELIE_DURATION;
    ctx.rotate(-(art === 'right' ? 1 : -1) * Math.sin(prog * Math.PI) * 0.4);
  }
  if (player.onMotorcycle) withIsoSkew({ x: 0, y: 0 }, player.facing, art => drawMotorcycle(0, 0, art, player.motoColor, true, isJumping));
  drawDude(0, 0, '#3a6fd8', null, {
    ...look,
    facing: player.onMotorcycle ? isoArt(player.facing) : player.facing,
    muzzleFlash: now < muzzleFlashUntil, riding: player.onMotorcycle, swimming: player.swimming, moving: player.moving
  });
  ctx.restore();
}
