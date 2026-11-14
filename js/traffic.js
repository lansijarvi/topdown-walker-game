// right-hand-traffic lane for a car on a street, given its direction:
// heading east -> south lane, west -> north lane; heading south -> west
// lane, north -> east lane. Lanes sit a quarter of the road width in
// from each edge.
function trafficLane(car) {
  if (car.axis === 'h') return car.street.y + (car.dir > 0 ? ROAD_W * 0.75 : ROAD_W * 0.25);
  return car.street.x + (car.dir > 0 ? ROAD_W * 0.25 : ROAD_W * 0.75);
}

// a non-bridge named street (Oak/Elm/Cedar) doesn't actually cross the
// river, so a vehicle confined to it needs to stay on whichever side it
// starts on rather than being free to bounce straight through the water -
// bridge streets (Pine/Maple) keep the full north-to-south range
function verticalStreetBounds(street) {
  if (street.bridge) return { minY: 100, maxY: DOWNTOWN_H - 100 };
  return Math.random() < 0.5
    ? { minY: 100, maxY: RIVER_Y - 100 }
    : { minY: RIVER_Y + RIVER_H + 100, maxY: DOWNTOWN_H - 100 };
}

// shared bounce-and-lane-ease movement for any street vehicle (car or
// bike) - bounces between its street's min/max and eases sideways into
// the correct lane for its current direction, unless held at a light
function moveVehicleAlongLane(v, dt, stopped) {
  if (v.axis === 'h') {
    if (!stopped) {
      v.x += v.dir * v.speed * dt;
      if (v.x > v.maxX) { v.x = v.maxX; v.dir = -1; }
      if (v.x < v.minX) { v.x = v.minX; v.dir = 1; }
    }
    v.y += (trafficLane(v) - v.y) * 0.06 * dt;
  } else {
    if (!stopped) {
      v.y += v.dir * v.speed * dt;
      if (v.y > v.maxY) { v.y = v.maxY; v.dir = -1; }
      if (v.y < v.minY) { v.y = v.minY; v.dir = 1; }
    }
    v.x += (trafficLane(v) - v.x) * 0.06 * dt;
  }
}

// background traffic - at least 5 cars, up to 10, each sticking to one
// street and driving back and forth in the proper lane for their current
// direction. Two police cruisers always patrol on top of that.
const CAR_COLORS = ['#3a5f8f', '#8f3a3a', '#3a8f5a', '#8f8f3a', '#5f3a8f', '#707070', '#222222', '#8f5a2a'];
const trafficCars = [];
{
  const carCount = 7 + Math.floor(Math.random() * 8);
  for (let i = 0; i < carCount; i++) {
    const horizontal = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    if (horizontal) {
      const street = NUMBERED_STREETS[Math.floor(Math.random() * NUMBERED_STREETS.length)];
      const car = { axis: 'h', street, x: 150 + Math.random() * (WORLD_W - 300), minX: 100, maxX: WORLD_W - 100, dir, speed: 1.6 + Math.random() * 1.2, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] };
      car.y = trafficLane(car);
      trafficCars.push(car);
    } else {
      const street = NAMED_STREETS[Math.floor(Math.random() * NAMED_STREETS.length)];
      const { minY, maxY } = verticalStreetBounds(street);
      const car = { axis: 'v', street, y: minY + Math.random() * (maxY - minY), minY, maxY, dir, speed: 1.6 + Math.random() * 1.2, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] };
      car.x = trafficLane(car);
      trafficCars.push(car);
    }
  }

  // two police cruisers on patrol
  const cruiser1 = { axis: 'h', street: NUMBERED_STREETS[1], x: 800, minX: 100, maxX: WORLD_W - 100, dir: 1, speed: 2.4, color: '#ffffff', police: true };
  cruiser1.y = trafficLane(cruiser1);
  trafficCars.push(cruiser1);
  const cruiser2 = { axis: 'v', street: NAMED_STREETS[1], y: 1400, minY: 100, maxY: DOWNTOWN_H - 100, dir: -1, speed: 2.4, color: '#ffffff', police: true };
  cruiser2.x = trafficLane(cruiser2);
  trafficCars.push(cruiser2);

  // a handful of cars explicitly pinned to the south side's own streets,
  // so the new neighborhood has real traffic on it rather than relying on
  // the random pool to occasionally wander down there
  const southSpecs = [
    { axis: 'h', street: NUMBERED_STREETS.find(s => s.name === '5th St'), x: 800,  dir: 1 },
    { axis: 'h', street: NUMBERED_STREETS.find(s => s.name === '5th St'), x: 2600, dir: -1 },
    { axis: 'h', street: NUMBERED_STREETS.find(s => s.name === '6th St'), x: 1500, dir: 1 },
    { axis: 'h', street: NUMBERED_STREETS.find(s => s.name === '6th St'), x: 3400, dir: -1 },
    { axis: 'v', street: NAMED_STREETS.find(s => s.name === 'Pine St'),  y: RIVER_Y + RIVER_H + 400, dir: 1 },
    { axis: 'v', street: NAMED_STREETS.find(s => s.name === 'Maple St'), y: RIVER_Y + RIVER_H + 600, dir: -1 },
  ];
  southSpecs.forEach(spec => {
    const car = {
      ...spec,
      minX: 100, maxX: WORLD_W - 100,
      minY: RIVER_Y + RIVER_H + 100, maxY: DOWNTOWN_H - 100,
      speed: 1.6 + Math.random() * 1.2,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]
    };
    if (spec.axis === 'h') car.y = trafficLane(car);
    else car.x = trafficLane(car);
    trafficCars.push(car);
  });
}

// background motorcycle riders - same street/lane/light rules as traffic
// cars, just a much smaller headcount to start
const BIKE_COLORS = ['#8f2e2e', '#2e8f3e', '#222222', '#2e4a8f', '#707070'];
const trafficBikes = [];
{
  const bikeCount = 3;
  for (let i = 0; i < bikeCount; i++) {
    const horizontal = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const rider = { ...randomPersonStyle(), color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] };
    const color = BIKE_COLORS[Math.floor(Math.random() * BIKE_COLORS.length)];
    if (horizontal) {
      const street = NUMBERED_STREETS[Math.floor(Math.random() * NUMBERED_STREETS.length)];
      const bike = { axis: 'h', street, x: 150 + Math.random() * (WORLD_W - 300), minX: 100, maxX: WORLD_W - 100, dir, speed: 2.0 + Math.random() * 1.4, color, rider };
      bike.y = trafficLane(bike);
      trafficBikes.push(bike);
    } else {
      const street = NAMED_STREETS[Math.floor(Math.random() * NAMED_STREETS.length)];
      const { minY, maxY } = verticalStreetBounds(street);
      const bike = { axis: 'v', street, y: minY + Math.random() * (maxY - minY), minY, maxY, dir, speed: 2.0 + Math.random() * 1.4, color, rider };
      bike.x = trafficLane(bike);
      trafficBikes.push(bike);
    }
  }
}

// Traffic lights: a synchronized city-wide cycle - all east-west traffic
// gets a green together, then all north-south traffic, like timed lights
// along a real grid. One pole sits at each corner of every intersection,
// and (matching real intersections) the pole that matters for a given
// direction of travel is the one across the intersection on your right:
// eastbound reads the SE pole, westbound reads NW, southbound reads SW,
// northbound reads NE.
const LIGHT_GREEN_MS = 8000;
const LIGHT_YELLOW_MS = 2000;
const LIGHT_CYCLE_MS = (LIGHT_GREEN_MS + LIGHT_YELLOW_MS) * 2;

function getLightPhase(timestamp) {
  const t = timestamp % LIGHT_CYCLE_MS;
  if (t < LIGHT_GREEN_MS) return { h: 'green', v: 'red' };
  if (t < LIGHT_GREEN_MS + LIGHT_YELLOW_MS) return { h: 'yellow', v: 'red' };
  if (t < LIGHT_GREEN_MS + LIGHT_YELLOW_MS + LIGHT_GREEN_MS) return { h: 'red', v: 'green' };
  return { h: 'red', v: 'yellow' };
}

// a slow ambient day/night cycle purely for atmosphere - smoothly eases
// between 0 (full daylight) and 1 (deep night) rather than snapping, so
// windows/headlights glow brighter and the whole scene cools down as it
// "sets" and warms back up as it "rises"
const DAY_NIGHT_CYCLE_MS = 45 * 60 * 1000;
function getNightFactor(timestamp) {
  const t = (timestamp % DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS;
  return (1 - Math.cos(t * Math.PI * 2)) / 2;
}

const TRAFFIC_LIGHTS = [];
NUMBERED_STREETS.forEach(hs => {
  NAMED_STREETS.forEach(vs => {
    TRAFFIC_LIGHTS.push({ x: vs.x + ROAD_W + 9, y: hs.y - 9, axis: 'v' });            // NE - northbound
    TRAFFIC_LIGHTS.push({ x: vs.x - 9, y: hs.y - 9, axis: 'h' });                      // NW - westbound
    TRAFFIC_LIGHTS.push({ x: vs.x + ROAD_W + 9, y: hs.y + ROAD_W + 9, axis: 'h' });    // SE - eastbound
    TRAFFIC_LIGHTS.push({ x: vs.x - 9, y: hs.y + ROAD_W + 9, axis: 'v' });             // SW - southbound
  });
});

const LIGHT_STOP_MARGIN = 12;   // gap kept before the stop line
const LIGHT_STOP_ZONE = 40;     // how far out a car starts checking the light

// true if this car should be held at a red/yellow light rather than a
// green one - checked against every cross-street it could be approaching
function carShouldStopAtLight(car, timestamp) {
  const phase = getLightPhase(timestamp);
  if (car.axis === 'h') {
    if (phase.h === 'green') return false;
    return NAMED_STREETS.some(vs => {
      const nearEdge = car.dir > 0 ? vs.x - LIGHT_STOP_MARGIN : vs.x + ROAD_W + LIGHT_STOP_MARGIN;
      const approach = car.dir > 0 ? nearEdge - car.x : car.x - nearEdge;
      return approach >= -2 && approach < LIGHT_STOP_ZONE;
    });
  } else {
    if (phase.v === 'green') return false;
    return NUMBERED_STREETS.some(hs => {
      const nearEdge = car.dir > 0 ? hs.y - LIGHT_STOP_MARGIN : hs.y + ROAD_W + LIGHT_STOP_MARGIN;
      const approach = car.dir > 0 ? nearEdge - car.y : car.y - nearEdge;
      return approach >= -2 && approach < LIGHT_STOP_ZONE;
    });
  }
}

// true if another car sharing the same street, axis and direction (so:
// the same lane) is close enough ahead that this car should hold back -
// otherwise two cars in the same lane just drive straight through each
// other since neither was ever aware the other existed. Needs to be at
// least the car's own rendered length (60 half-length at the current
// draw scale, for the longer side-view orientation) or they'd still
// visually overlap even while "holding back"
const CAR_FOLLOW_GAP = 150;
// checked against both cars and bikes sharing the same street/lane, so a
// bike never coasts straight into the back of a car (or another bike) and
// vice versa
function carAhead(car) {
  return [...trafficCars, ...trafficBikes].some(other => {
    if (other === car || other.axis !== car.axis || other.dir !== car.dir || other.street !== car.street) return false;
    const ahead = car.axis === 'h'
      ? (car.dir > 0 ? other.x - car.x : car.x - other.x)
      : (car.dir > 0 ? other.y - car.y : car.y - other.y);
    return ahead > 0 && ahead < CAR_FOLLOW_GAP;
  });
}

// small pole with the classic red/yellow/green stacked signal head - all
// three lenses are always visible, but only the active one is lit up
function drawTrafficLight(x, y, color, camX, camY) {
  const sx = x - camX, sy = y - camY;
  ctx.save();
  ctx.translate(sx, sy);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // pole
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-1.5, -14, 3, 16);

  // housing box, tall enough for three stacked lenses
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-5, -34, 10, 22);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(-5, -34, 10, 22);

  const lenses = [
    { name: 'red', y: -29, on: '#e03a3a', off: '#4a1c1c' },
    { name: 'yellow', y: -23, on: '#ffd23a', off: '#4a3f1c' },
    { name: 'green', y: -17, on: '#3ae05a', off: '#1c4a28' }
  ];
  lenses.forEach(lens => {
    ctx.fillStyle = lens.name === color ? lens.on : lens.off;
    ctx.beginPath();
    ctx.arc(0, lens.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// street lamps spaced along both sides of every sidewalk - just a dark
// pole in daylight, but casting a warm pool of light as night falls
const LAMP_SPACING = 260;
const STREET_LAMPS = [];
NUMBERED_STREETS.forEach(s => {
  for (let x = 130; x < WORLD_W; x += LAMP_SPACING) {
    STREET_LAMPS.push({ x, y: s.y - SIDEWALK_W - 6 });
    STREET_LAMPS.push({ x, y: s.y + ROAD_W + SIDEWALK_W + 6 });
  }
});
NAMED_STREETS.forEach(s => {
  for (let y = 130; y < DOWNTOWN_H; y += LAMP_SPACING) {
    STREET_LAMPS.push({ x: s.x - SIDEWALK_W - 6, y });
    STREET_LAMPS.push({ x: s.x + ROAD_W + SIDEWALK_W + 6, y });
  }
});

function drawStreetLamp(x, y, camX, camY, nightFactor) {
  const sx = x - camX, sy = y - camY;
  if (sx < -60 || sx > canvas.width + 60 || sy < -60 || sy > canvas.height + 60) return;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(sx - 2, sy - 42, 4, 42);
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(sx, sy - 44, 5, 0, Math.PI * 2);
  ctx.fill();

  if (nightFactor > 0.12) {
    const glowR = 60;
    const grad = ctx.createRadialGradient(sx, sy - 42, 2, sx, sy - 42, glowR);
    grad.addColorStop(0, `rgba(255,225,150,${(0.32 * nightFactor).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255,225,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy - 42, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,240,190,${(0.6 + 0.4 * nightFactor).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy - 44, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// the camera's top-left world position for the current frame - shared
// by the renderer and the track editor's mouse-to-world conversion
function getCamera() {
  let camX = player.x + player.w / 2 - canvas.width / 2;
  let camY = player.y + player.h / 2 - canvas.height / 2;
  camX = Math.max(WORLD_LEFT, Math.min(WORLD_W - canvas.width, camX));
  camY = Math.max(WORLD_TOP, Math.min(WORLD_H - canvas.height, camY));
  return { camX, camY };
}
