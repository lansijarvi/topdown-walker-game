// fixed spots for the furniture the player can buy at the Furniture Store -
// no placement UI, a piece just appears here once it's owned
// couch/bookshelf/rug/bed/barstools are still bought (bed + barstools from
// the Thrift Store) and only exist in Home once owned; bathroom/kitchen/
// laundry below are built into every residential building unconditionally
const HOME_FURNITURE_LAYOUT = {
  bookshelf: { x: 24,  y: 100, w: 24,  h: 110 },
  couch:     { x: 70,  y: 100, w: 140, h: 40 },
  rug:       { x: 60,  y: 160, w: 200, h: 90 },
  // landscape - headboard against the left wall, feet pointing into the room
  bed:       { x: 24,  y: 220, w: 90,  h: 70 },
  barstools: [
    { x: 140, y: 220, facing: 'down' },
    { x: 170, y: 220, facing: 'down' }
  ]
};

// the rug's actual, current spot/look - position is player.rugX/rugY
// (draggable) rather than the fixed HOME_FURNITURE_LAYOUT.rug.x/y, which
// now only supplies the fixed w/h and the original default position
function currentRugRect() {
  return { x: player.rugX, y: player.rugY, w: HOME_FURNITURE_LAYOUT.rug.w, h: HOME_FURNITURE_LAYOUT.rug.h };
}

// --- furniture editor: drag the rug around your own living room, and
// pick its color/pattern from a small on-screen palette - same drag
// pattern as the track editor, just scoped to Home's interior ---
let furnitureEditorOpen = false;
let draggingRug = false;
let rugDragOffsetX = 0, rugDragOffsetY = 0;
const RUG_COLORS = ['#7a3a3a', '#2f5f8a', '#3a7a4a', '#7a3a7a', '#c2932f', '#5a5a5a', '#1a1a1a', '#c2c2c2'];
const RUG_PATTERNS = ['solid', 'stripes', 'diamond'];

function toggleFurnitureEditor() {
  if (dialogueOpen || awaitingName || awaitingTier || scene !== 'interior' || !currentBuilding || currentBuilding.name !== 'Home') return;
  if (!player.homeFurniture.includes('rug')) { showFlavorMessage("You don't have a rug to arrange yet."); return; }
  furnitureEditorOpen = !furnitureEditorOpen;
  draggingRug = false;
}

// same idea as screenToWorld, but for the interior's fixed (non-scrolling)
// room camera instead of the outdoor world camera
function screenToRoom(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const camX = (ROOM_W - canvas.width) / 2, camY = (ROOM_H - canvas.height) / 2;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width) + camX,
    y: (clientY - rect.top) * (canvas.height / rect.height) + camY
  };
}

// screen-space layout for the color/pattern swatches, shared by both the
// drawing code and the click hit-testing so they can never drift apart
function getRugPaletteLayout() {
  const swatchSize = 28, gap = 8, startX = 20, y = 46;
  const colorSwatches = RUG_COLORS.map((color, i) => ({ color, x: startX + i * (swatchSize + gap), y, w: swatchSize, h: swatchSize }));
  const patternStartX = startX + RUG_COLORS.length * (swatchSize + gap) + 24;
  const patternSwatches = RUG_PATTERNS.map((pattern, i) => ({ pattern, x: patternStartX + i * (swatchSize + gap), y, w: swatchSize, h: swatchSize }));
  return { colorSwatches, patternSwatches };
}

canvas.addEventListener('pointerdown', e => {
  if (!furnitureEditorOpen || dialogueOpen) return;
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const { colorSwatches, patternSwatches } = getRugPaletteLayout();
  const hitColor = colorSwatches.find(s => sx >= s.x && sx <= s.x + s.w && sy >= s.y && sy <= s.y + s.h);
  if (hitColor) { player.rugColor = hitColor.color; return; }
  const hitPattern = patternSwatches.find(s => sx >= s.x && sx <= s.x + s.w && sy >= s.y && sy <= s.y + s.h);
  if (hitPattern) { player.rugPattern = hitPattern.pattern; return; }

  const { x: wx, y: wy } = screenToRoom(e.clientX, e.clientY);
  const r = currentRugRect();
  if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) {
    draggingRug = true;
    rugDragOffsetX = wx - player.rugX;
    rugDragOffsetY = wy - player.rugY;
  }
});

canvas.addEventListener('pointermove', e => {
  if (!furnitureEditorOpen || !draggingRug) return;
  const { x: wx, y: wy } = screenToRoom(e.clientX, e.clientY);
  const r = HOME_FURNITURE_LAYOUT.rug;
  const margin = WALL_THICK;
  player.rugX = Math.max(margin, Math.min(ROOM_W - margin - r.w, wx - rugDragOffsetX));
  player.rugY = Math.max(margin, Math.min(ROOM_H - margin - r.h, wy - rugDragOffsetY));
});

canvas.addEventListener('pointerup', () => {
  draggingRug = false;
});

// every home, apartment, and motel room has its own working bathroom - a
// real walled-off nook in the top-right corner, flush against the room's
// own north/east walls so only two new wall segments (with a doorway gap)
// are needed to close it off
const BATHROOM_NOOK = { x: 306, y: 24, w: 170, h: 160 };
const BATHROOM_WALL_T = 8;
// doorway sits toward the right side of the bottom wall rather than
// centered, echoing a real bathroom floor plan (door bottom-right)
const BATHROOM_DOOR_X = 396;
const BATHROOM_DOOR_W = 60;
// laid out like a real bathroom floor plan: shower top-left (corner,
// against the top wall and the nook's own left divider), sink top-right
// (against the top and the room's outer right wall), toilet bottom-left
// against the left divider with its open side facing right into the room
const BATHROOM_FIXTURES = {
  shower: { x: 314, y: 24,  w: 70, h: 70 },
  sink:   { x: 414, y: 24,  w: 62, h: 40 },
  toilet: { x: 314, y: 118, w: 44, h: 36 }
};

// kitchen - a run of appliances along the top wall, left of the bathroom
// (matching a classic galley layout), side by side so each appliance's
// clearance (which faces down, away from the wall) never lands inside a
// neighbor - stacking them vertically instead (clearance parallel to the
// stacking axis) is exactly what caused the sink/toilet and stove/fridge
// overlap bugs
const KITCHEN_FIXTURES = {
  fridge:      { x: 24,  y: 24, w: 60, h: 60 },
  stove:       { x: 104, y: 24, w: 64, h: 48 },
  kitchenSink: { x: 188, y: 24, w: 54, h: 34 }
};

// laundry - flush against the bottom wall, bottom-right corner (mirrors the
// kitchen's layout logic)
const LAUNDRY_FIXTURES = {
  washer: { x: 336, y: 304, w: 64, h: 52 },
  dryer:  { x: 410, y: 304, w: 64, h: 52 }
};

function getBathroomWallObstacles() {
  const n = BATHROOM_NOOK;
  const bottomY = n.y + n.h - BATHROOM_WALL_T;
  const doorStart = BATHROOM_DOOR_X, doorEnd = BATHROOM_DOOR_X + BATHROOM_DOOR_W;
  return [
    { x: n.x, y: n.y, w: BATHROOM_WALL_T, h: n.h }, // left divider off the main room
    { x: n.x, y: bottomY, w: doorStart - n.x, h: BATHROOM_WALL_T }, // bottom wall, left of doorway
    { x: doorEnd, y: bottomY, w: (n.x + n.w) - doorEnd, h: BATHROOM_WALL_T } // bottom wall, right of doorway
  ];
}

// every home, apartment, and motel room comes fully fitted out already -
// bathroom, kitchen, and laundry are all built in, not something you shop for
const RESIDENTIAL_BUILDINGS = ['Home', 'House', 'Apartments', 'Riverside Apartments', 'Sunset Apartments', 'Motel', 'Rundown House', 'Rustwater Apartments', 'Sundown Motel'];
function hasBathroom(b) { return RESIDENTIAL_BUILDINGS.includes(b.name); }
function hasKitchen(b) { return RESIDENTIAL_BUILDINGS.includes(b.name); }
function hasLaundry(b) { return RESIDENTIAL_BUILDINGS.includes(b.name); }

function getHomeCouchSeats() {
  const c = HOME_FURNITURE_LAYOUT.couch;
  return [
    { x: c.x + c.w * 0.3, y: c.y + c.h + 14, facing: 'down' },
    { x: c.x + c.w * 0.7, y: c.y + c.h + 14, facing: 'down' }
  ];
}

function getHomeBedSpot() {
  const b = HOME_FURNITURE_LAYOUT.bed;
  return {
    rect: { x: b.x, y: b.y, w: b.w, h: b.h },
    lieX: b.x + b.w / 2, lieY: b.y + b.h / 2,
    lieAngle: b.w > b.h ? -Math.PI / 2 : 0
  };
}

// static tables/seats (taverns, restaurants, etc), the toilet (any building
// with a bathroom), plus Home's furniture, which only exists once bought
function getBuildingSeats(b) {
  const seats = (b.seats || []).slice();
  if (hasBathroom(b)) {
    // the toilet's back is against the left wall, open side facing right.
    // approach from the outside (walkable, and where standing back up
    // returns to) but sit anchored on the bowl itself, not 14px away from
    // it - otherwise it just looks like standing next to the toilet
    const t = BATHROOM_FIXTURES.toilet;
    seats.push({ ...spotRight(t), sitX: t.x + t.w * 0.68, sitY: t.y + t.h / 2, facing: 'right', flavor: 'Ahh, sweet relief.' });
  }
  if (b.name === 'Home') {
    if (player.homeFurniture.includes('couch')) seats.push(...getHomeCouchSeats());
    if (player.homeFurniture.includes('barstools')) seats.push(...HOME_FURNITURE_LAYOUT.barstools);
  }
  return seats;
}

// static per-building beds (Hospital) plus Home's bed, once bought
function getBuildingBeds(b) {
  const beds = (b.beds || []).slice();
  if (b.name === 'Home' && player.homeFurniture.includes('bed')) beds.push(getHomeBedSpot());
  return beds;
}

// the shower is its own little "stand under the water" state rather than
// an instant flavor message - any building with a bathroom has one
function getBuildingShowers(b) {
  if (!hasBathroom(b)) return [];
  const s = BATHROOM_FIXTURES.shower;
  // stand near the front/floor of the stall rather than dead-center - the
  // player is drawn feet-first from this point upward, so this is what
  // puts their head (not their knees) under the falling water
  const standX = s.x + s.w / 2, standY = s.y + s.h - 6;
  return [{ x: standX, y: s.y + s.h + 14, facing: 'up', standX, standY }];
}

// sink/stove/fridge/kitchen sink - flavor-only interactions, no sitting or
// lying, just a quick message when used
// wall-mounted appliances face away from whichever wall their back is
// against - "below"/"above" the object is wherever open floor actually is
const spotBelow = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h + 14 });
const spotAbove = (r) => ({ x: r.x + r.w / 2, y: r.y - 14 });
const spotRight = (r) => ({ x: r.x + r.w + 14, y: r.y + r.h / 2 });

function getBuildingFixtures(b) {
  const fixtures = [];
  if (hasBathroom(b)) {
    fixtures.push({ ...spotBelow(BATHROOM_FIXTURES.sink), hint: '[E] to wash up', message: 'You wash up. Squeaky clean!' });
  }
  if (hasKitchen(b)) {
    fixtures.push({ ...spotBelow(KITCHEN_FIXTURES.stove), hint: '[E] to cook', message: 'You cook up a quick meal.' });
    fixtures.push({ ...spotBelow(KITCHEN_FIXTURES.fridge), hint: '[E] to grab a snack', message: 'You grab a snack from the fridge.' });
    fixtures.push({ ...spotBelow(KITCHEN_FIXTURES.kitchenSink), hint: '[E] to wash dishes', message: 'You wash the dishes. All clean!' });
  }
  if (hasLaundry(b)) {
    fixtures.push({ ...spotAbove(LAUNDRY_FIXTURES.washer), hint: '[E] to start a load', message: 'You toss in a load of laundry.' });
    fixtures.push({ ...spotAbove(LAUNDRY_FIXTURES.dryer), hint: '[E] to grab your laundry', message: 'You grab your clean, warm clothes.' });
  }
  return fixtures;
}

function getBuildingFurnitureObstacles(b) {
  const obstacles = (b.tables || []).slice();
  obstacles.push(...(b.bedRects || []));
  if (hasBathroom(b)) {
    obstacles.push(BATHROOM_FIXTURES.sink, BATHROOM_FIXTURES.toilet, BATHROOM_FIXTURES.shower, ...getBathroomWallObstacles());
  }
  if (hasKitchen(b)) {
    obstacles.push(KITCHEN_FIXTURES.fridge, KITCHEN_FIXTURES.stove, KITCHEN_FIXTURES.kitchenSink);
  }
  if (hasLaundry(b)) {
    obstacles.push(LAUNDRY_FIXTURES.washer, LAUNDRY_FIXTURES.dryer);
  }
  if (b.name === 'Home') {
    if (player.homeFurniture.includes('couch')) obstacles.push(HOME_FURNITURE_LAYOUT.couch);
    if (player.homeFurniture.includes('bookshelf')) obstacles.push(HOME_FURNITURE_LAYOUT.bookshelf);
    if (player.homeFurniture.includes('bed')) obstacles.push(HOME_FURNITURE_LAYOUT.bed);
    // the rug is just floor decoration - no collision
  }
  return obstacles;
}

function tryMoveInterior(dx, dy) {
  const obstacles = (currentBuilding.displayBikes || []).map(bk => ({ x: bk.x - 24, y: bk.y - 16, w: 48, h: 24 }));
  if (currentBuilding.bar) obstacles.push(currentBuilding.bar);
  obstacles.push(...getBuildingFurnitureObstacles(currentBuilding));

  let next = { x: player.x + dx, y: player.y, w: player.w, h: player.h };
  next.x = Math.max(WALL_THICK, Math.min(ROOM_W - WALL_THICK - player.w, next.x));
  if (!obstacles.some(o => rectsOverlap(next, o))) player.x = next.x;

  next = { x: player.x, y: player.y + dy, w: player.w, h: player.h };
  next.y = Math.max(WALL_THICK, Math.min(ROOM_H - WALL_THICK - player.h, next.y));
  if (!obstacles.some(o => rectsOverlap(next, o))) player.y = next.y;
}
