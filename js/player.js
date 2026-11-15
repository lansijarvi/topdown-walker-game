const player = {
  name: '',
  x: 60,
  y: 390,
  w: 22,
  h: 16,
  speed: 1.6,
  runSpeed: 3.4,
  facing: 'down',
  gender: 'm',
  hairColor: '#3a2a1a',
  hairstyle: 'square',
  skinTone: '#f0c090',
  traits: {},
  money: 10000,
  finesOwed: 0,
  hasGun: false,
  gunEquipped: false,
  ammoInMag: 0,
  spareMags: 0,
  hasMotorcycle: false,
  onMotorcycle: false,
  wheelieUntil: 0,
  jumpUntil: 0,
  jumpCooldownUntil: 0,
  jumpTotalMs: 0,
  jumpBoosted: false,
  jumpHeightMult: 1,
  sitting: false,
  lying: false,
  lieAngle: 0,
  showering: false,
  restSpot: null,
  homeFurniture: [],
  // the rug's position/look, customizable via the in-room furniture
  // editor - defaults match its old fixed spot/color exactly
  rugX: 60,
  rugY: 160,
  rugColor: '#7a3a3a',
  rugPattern: 'solid',
  motoColor: '#8f2e2e',
  pendingMotoColor: '#8f2e2e',
  motoSpeed: 3.6,
  motoBoostSpeed: 5.8,
  hasCar: false,
  onCar: false,
  carColor: '#8f2e2e',
  pendingCarColor: '#8f2e2e',
  carSpeed: 4.4,
  carBoostSpeed: 7.0,
  onBoat: false,
  boatColor: '#2a8f9a',
  boatSpeed: 2.2,
  onSurfboard: false,
  surfboardColor: '#e8722a',
  surfSpeed: 1.8,
  // true while auto-riding a caught wave in - ends only once it actually
  // reaches the shore, not on a fixed timer, so it always carries the
  // board all the way in regardless of how far out it was caught
  ridingWave: false,
  // which real wave (row + specific hump) is being ridden, so the board
  // can be pinned to that exact crest's peak for the whole ride
  ridingRowWy: 0,
  ridingHumpIdx: 0,
  ridingStartDist: 0, // distance-to-shore at the moment of catching, for the visual lift envelope
  swimming: false,
  // finance tier chosen at new-game start - null until the tier overlay
  // is answered, then 'broke' | 'comfortable' | 'loaded'
  financeTier: null,
  // per-quest progress: { questId: 'not-started' | 'in-progress' | 'complete' }
  quests: {},
  // quest items currently being carried: { itemId: true }
  questItems: {},
  // quest items ever picked up, so their world spot never respawns
  questItemsFound: {},
  // simple per-NPC reputation counters, e.g. affection.ruby
  affection: {},
  // wanted/heat stub - a bare number, no chase AI behind it yet
  wanted: 0
};

// a pristine snapshot of the starting player, taken before anything can
// mutate it - New Game restores from this instead of reloading the page,
// since some embedded preview panels don't reliably refetch on reload
const DEFAULT_PLAYER = JSON.parse(JSON.stringify(player));

let muzzleFlashUntil = 0;
let lastShotBlockedFlashUntil = 0;
let bullets = [];
const BULLET_SPEED = 18;
const BULLET_LIFETIME_MS = 500;
const KNOCKDOWN_MS = 3000;
const HIT_RADIUS = 16;

function muzzleOffset(facing) {
  if (facing === 'right') return { x: 26, y: -25, vx: 1, vy: 0 };
  if (facing === 'left')  return { x: -26, y: -25, vx: -1, vy: 0 };
  if (facing === 'up')    return { x: 8, y: -46, vx: 0, vy: -1 };
  return { x: 0, y: -3, vx: 0, vy: 1 };
}

function shoot() {
  if (dialogueOpen || scene !== 'outside' && scene !== 'interior') return;
  if (!player.hasGun || !player.gunEquipped) return;
  if (player.ammoInMag <= 0) {
    lastShotBlockedFlashUntil = performance.now() + 250;
    return;
  }
  player.ammoInMag--;
  muzzleFlashUntil = performance.now() + 80;
  playGunshot();

  const off = muzzleOffset(player.facing);
  bullets.push({
    x: player.x + player.w / 2 + off.x,
    y: player.y + player.h + off.y,
    vx: off.vx,
    vy: off.vy,
    scene: scene,
    spawn: performance.now()
  });
}

function reload() {
  if (dialogueOpen) return;
  if (!player.hasGun || player.spareMags <= 0) return;
  if (player.ammoInMag === MAG_SIZE) return;
  player.spareMags--;
  player.ammoInMag = MAG_SIZE;
  playReloadSound();
}

let scene = 'outside';
let mapOpen = false;
let wasBoostingOnBike = false;
let currentBuilding = null;
let nearbyNPC = null;
let nearbySeat = null;
let nearbyBed = null;
let nearbyShower = null;
let nearbyFixture = null;
let nearbyQuestSpot = null;
let interactCooldownUntil = 0;
let flavorMessage = '';
let flavorMessageUntil = 0;
function showFlavorMessage(text) {
  flavorMessage = text;
  flavorMessageUntil = performance.now() + 2000;
}
let dialogueOpen = false;
let awaitingName = false;
let awaitingTier = false;
let dialogueTree = null;
let dialogueNodeKey = 'start';
let lastFrameTime = 0;
let motorcycleParked = null; // { x, y, facing } when the bike exists in the world, null while being ridden or before purchase
const MOUNT_RADIUS = 40;
let carParked = null; // same idea as motorcycleParked, for the car
// a paddleboard moored at the end of the lake's dock - free to use, no
// purchase needed, so it exists in the world from the very start rather
// than starting null like the motorcycle/car (which wait on a showroom buy)
// moored in the open water right alongside the dock, not at its tip -
// easy to step onto from the planks without the dock itself being "lake"
const BOAT_SPOT = { x: LAKE_DOCK.x + LAKE_DOCK.w + 70, y: LAKE_DOCK.y + 60, facing: 'right' };
let boatParked = { ...BOAT_SPOT };

// a surfboard stuck upright in the sand, just off the beach - free to
// grab, same no-purchase-needed idea as the paddleboard
const SURFBOARD_SPOT = { x: OCEAN_X1 - 60, y: 950, facing: 'left' };
let surfboardParked = { ...SURFBOARD_SPOT };
let playerHitUntil = 0;    // while set, the player is sprawled on the pavement
let playerHitPending = false; // waiting to wake up in the hospital
const HIT_COST = 50;       // hospital bill for getting run over
const JAYWALK_FINE = 25;   // ticket added to your record each time, payable at the Courthouse

// approximate solid rectangle of a traffic car in world space, matching its
// drawn size (1.7x scale). The dimension across the road is kept narrow
// enough to stay inside the road itself, never reaching the sidewalk.
function trafficCarRect(car) {
  if (car.axis === 'h') return { x: car.x - 52, y: car.y - 24, w: 104, h: 48 };
  return { x: car.x - 24, y: car.y - 52, w: 48, h: 104 };
}

const keys = {};
function toggleGunEquip() {
  if (!dialogueOpen && player.hasGun) player.gunEquipped = !player.gunEquipped;
}

function toggleMotorcycle() {
  if (dialogueOpen || !player.hasMotorcycle || scene !== 'outside' || player.onCar || player.onBoat || player.swimming) return;
  if (player.onMotorcycle) {
    player.onMotorcycle = false;
    motorcycleParked = { x: player.x + player.w / 2, y: player.y + player.h, facing: player.facing, color: player.motoColor };
    stopEngine();
  } else if (motorcycleParked) {
    const dist = Math.hypot(
      (player.x + player.w / 2) - motorcycleParked.x,
      (player.y + player.h / 2) - motorcycleParked.y
    );
    if (dist < MOUNT_RADIUS) {
      player.onMotorcycle = true;
      motorcycleParked = null;
      startEngine('moto');
    }
  }
}

function toggleCar() {
  if (dialogueOpen || !player.hasCar || scene !== 'outside' || player.onMotorcycle || player.onBoat || player.swimming) return;
  if (player.onCar) {
    player.onCar = false;
    carParked = { x: player.x + player.w / 2, y: player.y + player.h, facing: player.facing, color: player.carColor };
    stopEngine();
  } else if (carParked) {
    const dist = Math.hypot(
      (player.x + player.w / 2) - carParked.x,
      (player.y + player.h / 2) - carParked.y
    );
    if (dist < MOUNT_RADIUS) {
      player.onCar = true;
      carParked = null;
      startEngine('car');
    }
  }
}

// the paddleboard - free to hop on near the dock, but it can't leave the
// water (enforced in tryMoveOutside), so there's no dismount-anywhere
// risk of it ending up beached in the woods
// only ever park the boat somewhere actually confirmed to be in the
// lake - falls back to the dock's mooring spot otherwise, so a bad
// position (edge-of-lake rounding, a corrupted old save, etc.) can never
// leave the board sitting on dry land where it'd be stuck for good
function safeBoatSpot(x, y, facing) {
  return inLake(x, y) ? { x, y, facing } : { ...BOAT_SPOT };
}

// same idea as safeBoatSpot, but for the ocean
function safeSurfSpot(x, y, facing) {
  return inOcean(x, y) ? { x, y, facing } : { ...SURFBOARD_SPOT };
}

function toggleBoat() {
  if (dialogueOpen || scene !== 'outside' || player.onMotorcycle || player.onCar) return;
  if (player.onBoat) {
    player.onBoat = false;
    // use the player's center, matching the exact point tryMoveOutside
    // checks for lake confinement - the old bottom-edge point could be
    // just far enough past the shore to record a bad dismount spot
    boatParked = safeBoatSpot(player.x + player.w / 2, player.y + player.h / 2, player.facing);
  } else if (boatParked) {
    const dist = Math.hypot(
      (player.x + player.w / 2) - boatParked.x,
      (player.y + player.h / 2) - boatParked.y
    );
    if (dist < MOUNT_RADIUS) {
      player.onBoat = true;
      // snap onto the board's actual water position rather than staying
      // wherever the player happened to be standing (e.g. still on the
      // dock, which counts as dry land) - otherwise the board immediately
      // gets stuck, since it can't move anywhere that isn't in the lake
      player.x = boatParked.x - player.w / 2;
      player.y = boatParked.y - player.h / 2;
      player.facing = boatParked.facing;
      boatParked = null;
    }
  }
}

// same mount/dismount idea as the paddleboard, but confined to the ocean
// via safeSurfSpot instead of the lake
function toggleSurfboard() {
  if (dialogueOpen || scene !== 'outside' || player.onMotorcycle || player.onCar) return;
  if (player.onSurfboard) {
    player.onSurfboard = false;
    surfboardParked = safeSurfSpot(player.x + player.w / 2, player.y + player.h / 2, player.facing);
    player.ridingWave = false;
  } else if (surfboardParked) {
    const dist = Math.hypot(
      (player.x + player.w / 2) - surfboardParked.x,
      (player.y + player.h / 2) - surfboardParked.y
    );
    if (dist < MOUNT_RADIUS) {
      player.onSurfboard = true;
      player.x = surfboardParked.x - player.w / 2;
      player.y = surfboardParked.y - player.h / 2;
      player.facing = surfboardParked.facing;
      surfboardParked = null;
      player.ridingWave = false;
    }
  }
}

// which ambient wave row (see drawOcean/oceanRowWaveInfo) sits closest
// to a given world y - shared by the big-wave check and the catch itself
// so both always agree on exactly the same row
function nearestOceanRowWy(py) {
  const rowGap = 130;
  return (OCEAN_Y0 - rowGap) + Math.round((py - (OCEAN_Y0 - rowGap)) / rowGap) * rowGap;
}

// is there a tall wave passing directly under the player right now? Uses
// the exact same per-row wave math drawOcean() renders with (see
// oceanRowWaveInfo/isBigWaveHump below), so "on a big wave" always means
// a real tall crest is visibly under the board, never a hidden timer
function surfboardOnBigWave() {
  if (!player.onSurfboard) return false;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  if (!inOcean(px, py)) return false;
  if (!(OCEAN_X1 - px > 0 && OCEAN_X1 - px < BREAKER_WIDTH)) return false;
  const info = oceanRowWaveInfo(nearestOceanRowWy(py), performance.now() / 1000);
  return isBigWaveHump(px, info);
}

// the catch button (X) while on the surfboard - only does anything if
// you're actually on a tall wave right now; no penalty for pressing it
// at the wrong time, just try again on the next tall one. Records which
// exact hump was caught so update() can pin the board to that same
// crest's peak for the whole ride - riding the real wave, at its own pace
function trySurfCatch() {
  if (!player.onSurfboard || dialogueOpen) return;
  if (!surfboardOnBigWave()) return;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const wy = nearestOceanRowWy(py);
  const info = oceanRowWaveInfo(wy, performance.now() / 1000);
  player.ridingRowWy = wy;
  player.ridingHumpIdx = Math.floor((px - info.phase) / info.humpW);
  const peakX0 = player.ridingHumpIdx * info.humpW + WAVE_PEAK_F * info.humpW + info.phase;
  player.ridingStartDist = Math.max(1, OCEAN_X1 - peakX0);
  player.ridingWave = true;
  showFlavorMessage('Surfing in!');
}

// one unified mount/dismount button for every vehicle - car, motorcycle,
// or paddleboard. Dismounts whichever one you're currently on; otherwise
// mounts the nearest parked vehicle that's actually in range
function toggleVehicle() {
  if (dialogueOpen || scene !== 'outside') return;
  if (player.onCar) return toggleCar();
  if (player.onMotorcycle) return toggleMotorcycle();
  if (player.onBoat) return toggleBoat();
  if (player.onSurfboard) return toggleSurfboard();

  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const candidates = [];
  if (player.hasCar && carParked) candidates.push({ fn: toggleCar, dist: Math.hypot(px - carParked.x, py - carParked.y) });
  if (player.hasMotorcycle && motorcycleParked) candidates.push({ fn: toggleMotorcycle, dist: Math.hypot(px - motorcycleParked.x, py - motorcycleParked.y) });
  if (boatParked) candidates.push({ fn: toggleBoat, dist: Math.hypot(px - boatParked.x, py - boatParked.y) });
  if (surfboardParked) candidates.push({ fn: toggleSurfboard, dist: Math.hypot(px - surfboardParked.x, py - surfboardParked.y) });

  candidates.sort((a, b) => a.dist - b.dist);
  if (candidates.length && candidates[0].dist < MOUNT_RADIUS) candidates[0].fn();
}

function toggleMap() {
  if (dialogueOpen || awaitingName || awaitingTier) return;
  mapOpen = !mapOpen;
}

// --- track editor: click empty ground to drop a ramp, drag an existing
// one to move it, scroll over one to resize it, right-click to delete -
// everything lands in TRACK_RAMPS and autosaves to localStorage ---
let trackEditorOpen = false;
let draggingRampIndex = -1;
const RAMP_PICK_RADIUS = 45;

function toggleTrackEditor() {
  if (dialogueOpen || awaitingName || awaitingTier) return;
  trackEditorOpen = !trackEditorOpen;
  draggingRampIndex = -1;
}

// keeps the track editor's instructions tucked under the regular
// gameplay controls in the top-left info box, instead of floating a
// separate banner over the canvas
function updateTrackEditorInfo() {
  const el = document.getElementById('trackEditorInfo');
  if (!el) return;
  if (!trackEditorOpen) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.textContent = `TRACK EDITOR (${TRACK_RAMPS.length} ramps): click to add/drag a ramp, scroll to resize, right-click to delete, C to copy the layout, T to exit.`;
}

function updateFurnitureEditorInfo() {
  const el = document.getElementById('furnitureEditorInfo');
  if (!el) return;
  if (!furnitureEditorOpen) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.textContent = 'FURNITURE EDITOR: drag the rug to move it, click a swatch to recolor/repattern it, T to exit.';
}

function findRampNear(wx, wy) {
  let best = -1, bestDist = RAMP_PICK_RADIUS;
  TRACK_RAMPS.forEach((r, i) => {
    const d = Math.hypot(wx - r.x, wy - r.y);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (ISO_VIEW && scene === 'outside') {
    return isoToWorld((clientX - rect.left) * (canvas.width / rect.width) / iso.Z, (clientY - rect.top) * (canvas.height / rect.height) / iso.Z);
  }
  const { camX, camY } = getCamera();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width) + camX,
    y: (clientY - rect.top) * (canvas.height / rect.height) + camY
  };
}

async function exportTrackRamps() {
  const body = TRACK_RAMPS.map(r => `  { x: ${Math.round(r.x)}, y: ${Math.round(r.y)}, size: ${r.size.toFixed(2)} }`).join(',\n');
  const text = `const TRACK_RAMPS = [\n${body}\n];`;
  try {
    await navigator.clipboard.writeText(text);
    showFlavorMessage(`Copied ${TRACK_RAMPS.length} ramps to clipboard!`);
  } catch (e) {
    console.log(text);
    showFlavorMessage('Could not copy - logged to console instead');
  }
}

canvas.addEventListener('contextmenu', e => { if (trackEditorOpen) e.preventDefault(); });

canvas.addEventListener('pointerdown', e => {
  if (!trackEditorOpen || scene !== 'outside' || dialogueOpen) return;
  const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
  if (e.button === 2) {
    const idx = findRampNear(wx, wy);
    if (idx >= 0) { TRACK_RAMPS.splice(idx, 1); saveTrackRamps(); }
    return;
  }
  const idx = findRampNear(wx, wy);
  if (idx >= 0) {
    draggingRampIndex = idx;
  } else {
    TRACK_RAMPS.push({ x: wx, y: wy, size: 1.0 });
    draggingRampIndex = TRACK_RAMPS.length - 1;
    saveTrackRamps();
  }
});

canvas.addEventListener('pointermove', e => {
  if (!trackEditorOpen || draggingRampIndex < 0) return;
  const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
  TRACK_RAMPS[draggingRampIndex].x = wx;
  TRACK_RAMPS[draggingRampIndex].y = wy;
});

canvas.addEventListener('pointerup', () => {
  if (draggingRampIndex >= 0) { saveTrackRamps(); draggingRampIndex = -1; }
});

canvas.addEventListener('wheel', e => {
  if (!trackEditorOpen) return;
  const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
  const idx = findRampNear(wx, wy);
  if (idx < 0) return;
  e.preventDefault();
  const r = TRACK_RAMPS[idx];
  r.size = Math.max(0.4, Math.min(3, r.size + (e.deltaY < 0 ? 0.1 : -0.1)));
  saveTrackRamps();
}, { passive: false });

const WHEELIE_DURATION = 900;
const JUMP_DURATION = 750;
const JUMP_MIN_SPEED = 2.2;
const JUMP_BOOST_MS = 300;

// how "high up" the bike's own terrain-following bump should sit while
// riding across a ramp, purely from position - climbs from 0 to 1 (scaled
// by that ramp's size) across the up-slope, holds at the plateau, and
// eases back to 0 on the far side. Applies whether or not a real jump
// is happening, same shape the ramp itself is drawn with
function rampGroundLift(px, py) {
  for (const r of TRACK_RAMPS) {
    if (Math.abs(py - r.y) > ROAD_W / 2) continue;
    const halfLen = 70 * r.size;
    const plateauHalf = halfLen * 0.4;
    const dx = Math.abs(px - r.x);
    if (dx > halfLen) continue;
    const t = dx <= plateauHalf ? 1 : 1 - (dx - plateauHalf) / (halfLen - plateauHalf);
    return t * r.size;
  }
  return 0;
}

// hitting a Ridge Road ramp at speed and pulling the wheelie button -
// a fun, purely visual hop (no collision changes), with a short cooldown
// so sitting on top of a ramp doesn't retrigger it every frame. Returns
// true if a jump actually started, so tryJumpOrWheelie() knows not to
// also do a plain wheelie on top of it
function tryRampJump(timestamp) {
  if (!player.onMotorcycle || timestamp < player.jumpCooldownUntil) return false;
  if ((player.rideSpeed || 0) < JUMP_MIN_SPEED) return false;
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  const ramp = TRACK_RAMPS.find(r => Math.abs(px - r.x) < 60 * r.size && Math.abs(py - r.y) < ROAD_W / 2);
  if (!ramp) return false;
  const duration = JUMP_DURATION * (0.75 + ramp.size * 0.35);
  player.jumpUntil = timestamp + duration;
  player.jumpTotalMs = duration;
  player.jumpCooldownUntil = timestamp + duration + 1500;
  player.jumpBoosted = false;
  player.jumpHeightMult = ramp.size;
  showFlavorMessage(ramp.size >= 2 ? 'HUGE AIR!!!' : ramp.size >= 1.3 ? 'BIG AIR!' : ramp.size <= 0.85 ? 'Little hop!' : 'Big air!');
  return true;
}

// plain wheelie - also what popping into a boost auto-triggers, so
// kicking into a run doesn't accidentally launch a ramp jump on its own
function tryWheelie() {
  if (!player.onMotorcycle || dialogueOpen) return;
  player.wheelieUntil = performance.now() + WHEELIE_DURATION;
}

// the WHEELIE button/key does double duty, but only when actually
// pressed (not from the auto-wheelie-on-boost above): hit a ramp at
// speed and it triggers a jump instead of a plain wheelie; pull it again
// while already airborne and it's a one-time Excite Bike-style boost -
// a bit more height and hang time, rewarding a well-timed second pull
function tryJumpOrWheelie() {
  if (!player.onMotorcycle || dialogueOpen) return;
  const now = performance.now();
  if (now < player.jumpUntil) {
    if (!player.jumpBoosted) {
      player.jumpBoosted = true;
      player.jumpUntil += JUMP_BOOST_MS;
      player.jumpTotalMs += JUMP_BOOST_MS;
      player.jumpHeightMult = 1.4;
      showFlavorMessage('Nice!');
    }
    return;
  }
  if (tryRampJump(now)) return;
  tryWheelie();
}

// standing/getting up/stepping out needs to put the player back at the
// walkable point outside the furniture, not leave them wherever they were
// sitting/lying/standing (which for beds/showers is inside the object's
// own solid collision rect - without this they'd be stuck, unable to move
// since every step would still overlap that obstacle)
function returnToRestSpot() {
  if (!player.restSpot) return;
  player.x = player.restSpot.x - player.w / 2;
  player.y = player.restSpot.y - player.h / 2;
  player.facing = player.restSpot.facing;
  player.restSpot = null;
  // standing up lands you exactly on the spot that triggers "nearby" in
  // the first place - without a brief cooldown, the very next E press (or
  // just still standing there next frame) immediately sits/lies you back
  // down, which reads as being stuck
  interactCooldownUntil = performance.now() + 400;
}

function pressInteract() {
  if (dialogueOpen) {
    const node = dialogueTree[dialogueNodeKey];
    if (node.options) { syncDialogueOptionsOverlay(); return; } // a numbered choice is required here, not E
    if (node.end) {
      dialogueOpen = false;
    } else if (node.next) {
      enterNode(typeof node.next === 'function' ? node.next(player) : node.next);
    }
  } else if (player.sitting) {
    player.sitting = false;
    returnToRestSpot();
  } else if (player.lying) {
    player.lying = false;
    returnToRestSpot();
  } else if (player.showering) {
    player.showering = false;
    returnToRestSpot();
  } else if (nearbyNPC) {
    dialogueTree = nearbyNPC.dialogue || helloTree;
    const startKey = nearbyNPC.getStartKey ? nearbyNPC.getStartKey(player) : 'start';
    dialogueOpen = true;
    enterNode(startKey);
  } else if (nearbySeat) {
    player.sitting = true;
    player.restSpot = { x: nearbySeat.x, y: nearbySeat.y, facing: nearbySeat.facing };
    // sitX/sitY (when present, e.g. a bed) put the player right on the
    // object itself instead of at the walkable approach point beside it
    player.x = (nearbySeat.sitX ?? nearbySeat.x) - player.w / 2;
    player.y = (nearbySeat.sitY ?? nearbySeat.y) - player.h / 2;
    player.facing = nearbySeat.facing;
    if (nearbySeat.flavor) showFlavorMessage(nearbySeat.flavor);
  } else if (nearbyBed) {
    player.lying = true;
    player.lieAngle = nearbyBed.lieAngle || 0;
    // return to wherever you actually approached from, not one fixed
    // side - that's what makes climbing in from any side work
    player.restSpot = { x: player.x + player.w / 2, y: player.y + player.h / 2, facing: player.facing };
    player.x = nearbyBed.lieX - player.w / 2;
    player.y = nearbyBed.lieY - player.h / 2;
  } else if (nearbyShower) {
    player.showering = true;
    player.restSpot = { x: nearbyShower.x, y: nearbyShower.y, facing: nearbyShower.facing };
    player.x = nearbyShower.standX - player.w / 2;
    player.y = nearbyShower.standY - player.h / 2;
    player.facing = nearbyShower.facing;
    showFlavorMessage('You hop in the shower. Nice and warm!');
  } else if (nearbyFixture) {
    showFlavorMessage(nearbyFixture.message);
  } else if (nearbyQuestSpot) {
    if (nearbyQuestSpot.kind === 'pickup') {
      player.questItems[nearbyQuestSpot.id] = true;
      player.questItemsFound[nearbyQuestSpot.id] = true;
      showFlavorMessage(`Picked up: ${nearbyQuestSpot.label}`);
    } else if (nearbyQuestSpot.effect) {
      nearbyQuestSpot.effect(player);
    }
    nearbyQuestSpot = null;
  }
  syncDialogueOptionsOverlay();
}

function selectDialogueOption(idx) {
  if (!dialogueOpen) return;
  const node = dialogueTree[dialogueNodeKey];
  if (!node.options) return;
  const options = typeof node.options === 'function' ? node.options(player) : node.options;
  if (idx >= 0 && idx < options.length) {
    if (options[idx].color) {
      if (dialogueTree === carStoreTree) player.pendingCarColor = options[idx].color;
      else player.pendingMotoColor = options[idx].color;
    }
    if (options[idx].bet) startBlackjackHand(player, options[idx].bet);
    if (options[idx].item) player.pendingFurnitureItem = options[idx].item;
    if (options[idx].hairstyle) player.pendingHairstyle = options[idx].hairstyle;
    if (options[idx].haircolor) player.pendingHairColor = options[idx].haircolor;
    enterNode(options[idx].next);
  }
  syncDialogueOptionsOverlay();
}

// rebuilds the on-screen tappable dialogue buttons (options, or a single
// continue/close button) to match whatever node is currently showing -
// this is what makes conversations usable without a physical keyboard
function syncDialogueOptionsOverlay() {
  const el = document.getElementById('dialogueOptions');
  if (!el) return;
  el.innerHTML = '';
  document.body.classList.toggle('dialogue-open', dialogueOpen);
  if (!dialogueOpen || !dialogueTree) { el.style.display = 'none'; return; }
  const node = dialogueTree[dialogueNodeKey];
  if (!node) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  if (node.options) {
    const options = typeof node.options === 'function' ? node.options(player) : node.options;
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = `${i + 1}. ${opt.label}`;
      btn.addEventListener('click', () => selectDialogueOption(i));
      el.appendChild(btn);
    });
  } else {
    const btn = document.createElement('button');
    btn.textContent = node.end ? 'Close' : 'Continue';
    btn.style.textAlign = 'center';
    btn.addEventListener('click', () => pressInteract());
    el.appendChild(btn);
  }
}

window.addEventListener('keydown', e => { if (!awaitingName && !awaitingTier) keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

window.addEventListener('keydown', e => {
  if (awaitingName || awaitingTier) return;
  // toggle-style actions only fire on the actual keypress, not the
  // OS/browser's auto-repeat while the key stays held - otherwise holding
  // one a beat too long rapidly re-triggers it (e.g. mount/dismount the
  // bike several times before you let go)
  if (e.key.toLowerCase() === 'g' && !e.repeat) toggleGunEquip();
  if (e.key === ' ') {
    e.preventDefault();
    shoot();
  }
  if (e.key.toLowerCase() === 'r') reload();
  // one button for every vehicle - car, motorcycle, paddleboard - mounts
  // or dismounts whichever one applies
  if (e.key.toLowerCase() === 'm' && !e.repeat) toggleVehicle();
  if (e.key.toLowerCase() === 'n' && !e.repeat) toggleMap();
  if (e.key.toLowerCase() === 'x' && !e.repeat) { tryJumpOrWheelie(); trySurfCatch(); }
  if (e.key.toLowerCase() === 't' && !e.repeat) { if (scene === 'outside') toggleTrackEditor(); else toggleFurnitureEditor(); }
  if (e.key.toLowerCase() === 'c' && !e.repeat && trackEditorOpen) exportTrackRamps();
});

window.addEventListener('keydown', e => {
  if (awaitingName || awaitingTier) return;
  const key = e.key.toLowerCase();

  if (key === 'e') {
    // same auto-repeat guard as the toggles above - this is exactly what
    // was causing "stuck in bed": holding E a moment too long fired
    // lie-down/get-up/lie-down again before the key was released
    if (!e.repeat) pressInteract();
    return;
  }

  if (dialogueOpen && /^[1-9]$/.test(key)) {
    selectDialogueOption(parseInt(key, 10) - 1);
  }
});

function enterNode(key) {
  dialogueNodeKey = key;
  const node = dialogueTree[key];
  if (node && node.effect) node.effect(player);
  if (node && node.speaker === 'npc') playGibberish();
  syncDialogueOptionsOverlay();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// central money-gate helpers - every purchase in the game should go
// through these two instead of checking/mutating p.money directly, so
// the "Loaded" finance tier can bypass every price gate in one place
// rather than a giant unlimited number that could overflow/underflow
function canAfford(p, price) {
  return p.financeTier === 'loaded' || p.money >= price;
}
function spendMoney(p, price) {
  if (p.financeTier !== 'loaded') p.money -= price;
}

// quest-flag helpers - a quest id maps to 'not-started' (default,
// nothing stored yet) | 'in-progress' | 'complete'
function questState(p, id) {
  return p.quests[id] || 'not-started';
}
function questComplete(p, id) {
  return p.quests[id] === 'complete';
}
function setQuest(p, id, state) {
  p.quests[id] = state;
}

// lightweight "!" indicator - a name-keyed lookup of simple predicates
// reusing the same quest-state checks the dialogue trees already use,
// rather than duplicating tree logic
const QUEST_PING_CHECKS = {
  'Barber Bob':     (p) => !questComplete(p, 'barberScissors') || !questComplete(p, 'barberDye'),
  'Barber Betty':   (p) => !questComplete(p, 'barberScissors') || !questComplete(p, 'barberDye'),
  'Dancer Ruby':    (p) => !questComplete(p, 'stripperPimp'),
  'Bartender Moe':  (p) => !questComplete(p, 'clubKeg'),
  'Bouncer Duke':   (p) => questComplete(p, 'clubKeg') && !questComplete(p, 'clubVandalism'),
  'Dealer Deuce':   (p) => !questComplete(p, 'casinoHighRoller') || !questComplete(p, 'casinoMarkedDeck'),
  'Officer Ortiz':  (p) => p.wanted > 0
};
function npcHasQuestPing(n, p) {
  const check = QUEST_PING_CHECKS[n.name];
  return check ? check(p) : false;
}
function drawQuestPing(x, y) {
  const bob = Math.sin(performance.now() / 300) * 2;
  const py = y + bob;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText('!', x, py);
  ctx.fillStyle = '#ffe066';
  ctx.fillText('!', x, py);
}

// the lake is drawn as an ellipse inscribed in LAKE's bounding box, so
// "is this point in the lake" has to check the ellipse, not the box -
// otherwise the box's corners (well outside the visible water) count as
// lake too, and characters there look like they're swimming on dry land
function inLake(x, y) {
  // the dock is dry wood sitting over the water - standing on it should
  // never count as swimming even though it physically overlaps the lake
  if (x >= LAKE_DOCK.x && x <= LAKE_DOCK.x + LAKE_DOCK.w && y >= LAKE_DOCK.y && y <= LAKE_DOCK.y + LAKE_DOCK.h) return false;
  const cx = LAKE.x + LAKE.w / 2, cy = LAKE.y + LAKE.h / 2;
  const nx = (x - cx) / (LAKE.w / 2), ny = (y - cy) / (LAKE.h / 2);
  return nx * nx + ny * ny <= 1;
}

// the ocean is a plain rectangle, unlike the lake's ellipse
function inOcean(x, y) {
  return x >= OCEAN_X0 && x <= OCEAN_X1 && y >= OCEAN_Y0 && y <= OCEAN_Y1;
}

// rounded-rect + drop-shadow HUD panel, reused everywhere the game used to
// draw a flat ctx.fillRect box (cash, ammo, dialogue, item slots, etc.)
function drawPanel(x, y, w, h, fillTop, fillBottom, strokeStyle, radius) {
  radius = radius || 8;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, fillTop);
  grad.addColorStop(1, fillBottom);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  if (strokeStyle) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function enterBuilding(b) {
  if (player.onMotorcycle) {
    motorcycleParked = { x: player.x + player.w / 2, y: player.y + player.h, facing: player.facing, color: player.motoColor };
  }
  if (player.onCar) {
    carParked = { x: player.x + player.w / 2, y: player.y + player.h, facing: player.facing, color: player.carColor };
  }
  scene = 'interior';
  currentBuilding = b;
  player.x = ROOM_W / 2 - player.w / 2;
  player.y = ROOM_H - 110;
  // safety net: if a piece of owned furniture (or anything else) happens
  // to land right on the spawn point, walk it down toward the door
  // instead of dropping the player inside a solid obstacle they can't
  // move out of
  const spawnObstacles = getBuildingFurnitureObstacles(b);
  let spawnGuard = 0;
  while (spawnGuard < 25 && spawnObstacles.some(o => rectsOverlap({ x: player.x, y: player.y, w: player.w, h: player.h }, o))) {
    player.y += 10;
    spawnGuard++;
  }
  player.facing = 'down';
  player.onMotorcycle = false; // park it outside - nobody's riding through a doorway
  player.onCar = false;
  player.sitting = false;
  player.lying = false;
  player.showering = false;
  player.restSpot = null;
  nearbySeat = null;
  nearbyBed = null;
  nearbyShower = null;
  nearbyFixture = null;
  nearbyQuestSpot = null;
  stopEngine();
  stopAmbientHum();
  playDoorChime();
  infoEl.textContent = `Inside ${b.name}. Walk down to the door to leave.`;
}

function exitBuilding() {
  const b = currentBuilding;
  player.x = b.doorZone.x + b.doorZone.w / 2 - player.w / 2;
  player.y = b.doorZone.y + b.doorZone.h + 12;
  player.facing = 'down';
  player.sitting = false;
  player.lying = false;
  player.showering = false;
  player.restSpot = null;
  furnitureEditorOpen = false;
  draggingRug = false;
  updateFurnitureEditorInfo();
  scene = 'outside';
  currentBuilding = null;
  nearbyNPC = null;
  nearbyBed = null;
  nearbyShower = null;
  nearbyFixture = null;
  dialogueOpen = false;
  dialogueTree = null;
  dialogueNodeKey = 'start';
  syncDialogueOptionsOverlay();
  startAmbientHum();
  playDoorChime();
  infoEl.textContent = `WASD / Arrows to move. Walk into a building's door to go inside.`;
}

function isPaved(x, y) {
  return NUMBERED_STREETS.some(s => y >= s.y - SIDEWALK_W && y <= s.y + ROAD_W + SIDEWALK_W) ||
         NAMED_STREETS.some(s => x >= s.x - SIDEWALK_W && x <= s.x + ROAD_W + SIDEWALK_W) ||
         RIDGE_ROADS.some(s => y >= s.y - SIDEWALK_W && y <= s.y + ROAD_W + SIDEWALK_W) ||
         LOOP_SEGMENTS.some(s => s.horizontal
           ? (y >= s.y - SIDEWALK_W && y <= s.y + ROAD_W + SIDEWALK_W && x >= s.x0 - SIDEWALK_W && x <= s.x1 + SIDEWALK_W)
           : (x >= s.x - SIDEWALK_W && x <= s.x + ROAD_W + SIDEWALK_W && y >= Math.min(s.y0, s.y1) - SIDEWALK_W && y <= Math.max(s.y0, s.y1) + SIDEWALK_W));
}

function rectOnPavement(rect) {
  return isPaved(rect.x, rect.y) &&
         isPaved(rect.x + rect.w, rect.y) &&
         isPaved(rect.x, rect.y + rect.h) &&
         isPaved(rect.x + rect.w, rect.y + rect.h);
}

function tryMoveOutside(dx, dy) {
  let next = { x: player.x + dx, y: player.y, w: player.w, h: player.h };
  next.x = Math.max(WORLD_LEFT, Math.min(WORLD_W - player.w, next.x));
  let blocked = buildings.some(b => {
    const full = { x: b.x, y: b.y, w: b.w, h: b.h + b.wallDepth };
    return rectsOverlap(next, full) && !rectsOverlap(next, b.doorZone);
  }) || parkObstacles.some(o => rectsOverlap(next, o)) || cityTreeObstacles.some(o => rectsOverlap(next, o)) || riverObstacles.some(o => rectsOverlap(next, o)) || river2Obstacles.some(o => rectsOverlap(next, o)) || forestTreeObstacles.some(o => rectsOverlap(next, o)) || westForestTreeObstacles.some(o => rectsOverlap(next, o)) || wildernessObstacles.some(o => rectsOverlap(next, o)) || lifeguardObstacles.some(o => rectsOverlap(next, o));
  if ((player.onMotorcycle || player.onCar) && (!rectOnPavement(next) || inLake(next.x + next.w / 2, next.y + next.h / 2) || inLake2(next.x + next.w / 2, next.y + next.h / 2) || inLake3(next.x + next.w / 2, next.y + next.h / 2) || inOcean(next.x + next.w / 2, next.y + next.h / 2))) blocked = true;
  if (player.onBoat && !inLake(next.x + next.w / 2, next.y + next.h / 2)) blocked = true;
  if (player.onSurfboard && !inOcean(next.x + next.w / 2, next.y + next.h / 2)) blocked = true;
  if (!blocked) player.x = next.x;

  next = { x: player.x, y: player.y + dy, w: player.w, h: player.h };
  next.y = Math.max(WORLD_TOP, Math.min(WORLD_H - player.h, next.y));
  blocked = buildings.some(b => {
    const full = { x: b.x, y: b.y, w: b.w, h: b.h + b.wallDepth };
    return rectsOverlap(next, full) && !rectsOverlap(next, b.doorZone);
  }) || parkObstacles.some(o => rectsOverlap(next, o)) || cityTreeObstacles.some(o => rectsOverlap(next, o)) || riverObstacles.some(o => rectsOverlap(next, o)) || river2Obstacles.some(o => rectsOverlap(next, o)) || forestTreeObstacles.some(o => rectsOverlap(next, o)) || westForestTreeObstacles.some(o => rectsOverlap(next, o)) || wildernessObstacles.some(o => rectsOverlap(next, o)) || lifeguardObstacles.some(o => rectsOverlap(next, o));
  if ((player.onMotorcycle || player.onCar) && (!rectOnPavement(next) || inLake(next.x + next.w / 2, next.y + next.h / 2) || inLake2(next.x + next.w / 2, next.y + next.h / 2) || inLake3(next.x + next.w / 2, next.y + next.h / 2) || inOcean(next.x + next.w / 2, next.y + next.h / 2))) blocked = true;
  if (player.onBoat && !inLake(next.x + next.w / 2, next.y + next.h / 2)) blocked = true;
  if (player.onSurfboard && !inOcean(next.x + next.w / 2, next.y + next.h / 2)) blocked = true;
  if (!blocked) player.y = next.y;
}
