const ROAD_W = 140;

// the river separating downtown from the seedy south-side neighborhood -
// every named street runs the full height of the map (so the south side
// forms a real grid with 5th/6th St, same as downtown), and every one of
// them has its own metal bridge crossing the water
const RIVER_Y = 2900;
const RIVER_H = 480;

const NUMBERED_STREETS = [
  { name: '1st St', y: 400 },
  { name: '2nd St', y: 940 },
  { name: '3rd St', y: 1980 },
  { name: '4th St', y: 2580 },
  { name: '5th St', y: 3600 },
  { name: '6th St', y: 4060 },
  { name: '7th St', y: 4520 }
];
const NAMED_STREETS = [
  { name: 'Oak St',   x: 400,  bridge: true },
  { name: 'Pine St',  x: 940,  bridge: true },
  { name: 'Elm St',   x: 1980, bridge: true },
  { name: 'Maple St', x: 2520, bridge: true },
  { name: 'Cedar St', x: 3900, bridge: true }
];

const SIDEWALK_W = 20;

const H_LANES = [];
NUMBERED_STREETS.forEach(s => { H_LANES.push(s.y - 10); H_LANES.push(s.y + ROAD_W + 10); });
const V_LANES = [];
NAMED_STREETS.forEach(s => { V_LANES.push(s.x - 10); V_LANES.push(s.x + ROAD_W + 10); });
const BRIDGE_LANES = [];
NAMED_STREETS.filter(s => s.bridge).forEach(s => { BRIDGE_LANES.push(s.x - 10); BRIDGE_LANES.push(s.x + ROAD_W + 10); });

function nearestLane(value, lanes) {
  return lanes.reduce((best, l) => Math.abs(l - value) < Math.abs(best - value) ? l : best, lanes[0]);
}

function buildSidewalkPath(sx, sy, ex, ey) {
  if (Math.abs(sy - ey) < 2) return [{ x: ex, y: ey }];
  // crossing the river means only Pine/Maple's lanes are actually walkable
  // (they're the only streets with a bridge) - otherwise this would happily
  // route a citizen straight across the water on any other street
  const crossesRiver = (sy < RIVER_Y) !== (ey < RIVER_Y);
  const lanes = crossesRiver ? BRIDGE_LANES : V_LANES;
  const crossX = nearestLane((sx + ex) / 2, lanes);
  return [
    { x: crossX, y: sy },
    { x: crossX, y: ey },
    { x: ex, y: ey }
  ];
}

function randomSidewalkPoint() {
  const lane = H_LANES[Math.floor(Math.random() * H_LANES.length)];
  return { x: 100 + Math.random() * (WORLD_W - 200), y: lane };
}

// a small table with a chair on either side, facing each other - used to
// furnish taverns/bars/restaurants with actual seating instead of just
// open floor space
function tableAt(cx, cy) {
  const tw = 50, th = 36;
  return {
    table: { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th },
    seats: [
      { x: cx, y: cy - th / 2 - 14, facing: 'down' },
      { x: cx, y: cy + th / 2 + 14, facing: 'up' }
    ]
  };
}

// combines a list of tableAt() results into the {tables, seats} shape a
// building literal wants
function tableSet(...spots) {
  return {
    tables: spots.map(s => s.table),
    seats: spots.flatMap(s => s.seats)
  };
}

// a lie-down bed - the interact spot sits just past the foot of the bed so
// the player can reach it without needing to be inside its (blocking)
// footprint, same trick tableAt() uses for chairs
function bedAt(cx, cy, w, h) {
  const rect = { x: cx - w / 2, y: cy - h / 2, w, h };
  return {
    rect,
    // a bed can be climbed into from any side, not just one fixed
    // approach point - "spot" carries the bed's own rect so proximity
    // is checked against the whole footprint; lieX/lieY is the bed's
    // center, where the player actually gets teleported to lie down so
    // they end up drawn on the bed instead of on the floor next to it.
    // lieAngle rotates the sprite to match the bed's own shape - a
    // landscape bed (wider than tall, headboard against a side wall)
    // needs the character rotated onto their side to fit its long axis
    spot: { rect, lieX: cx, lieY: cy, lieAngle: w > h ? -Math.PI / 2 : 0 }
  };
}
function bedSet(...spots) {
  return {
    bedRects: spots.map(s => s.rect),
    beds: spots.map(s => s.spot)
  };
}

// --- Peepshow Palace quest web: Dancer Ruby (flagship multi-stage
// arc), her pimp Ronnie (resolved via the gun, not dialogue), plus
// Bartender Moe's keg fetch which unlocks Bouncer Duke's vandalism dare ---
const RUBY_REWARD_WARDROBE = 100;
const RUBY_REWARD_PAYOFF = 300;

const rubyTree = {
  metOnce: {
    speaker: 'npc',
    text: "Well look what the cat dragged in. You lost, sugar, or are you actually gonna buy a girl a drink? Some jackass ran off with half my wardrobe. You look like the type who owes the universe a good deed.",
    options: (p) => p.questItems.stripperWardrobe
      ? [{ label: "I found your clothes", next: 'wardrobeReturn' }, { label: 'Tell me more', next: 'wardrobeAsk' }]
      : [{ label: 'What happened?', next: 'wardrobeAsk' }, { label: 'Just looking around', next: 'bye' }]
  },
  wardrobeAsk: {
    speaker: 'npc',
    text: "It's a matching set, honey. I don't do mismatched, it's a whole thing. Check the woods. Guys panic and just start throwing things when they run.",
    end: true
  },
  wardrobeReturn: {
    speaker: 'npc',
    text: `Ohhh, my hero. Careful, I might start believing in chivalry again. Tell you what - you're growing on me. Like a rash, but the good kind. Here's $${RUBY_REWARD_WARDROBE} for the trouble.`,
    end: true,
    effect: (p) => {
      p.questItems.stripperWardrobe = false;
      setQuest(p, 'stripperWardrobe', 'complete');
      p.affection.ruby = (p.affection.ruby || 0) + 2;
      p.money += RUBY_REWARD_WARDROBE;
    }
  },
  dyeAsk: {
    speaker: 'npc',
    text: "I'm thinking 'cherry bomb red.' The barber's got the good stuff, but he's been holding out on everybody lately. Bring me that dye and I'll remember your name. That's basically a marriage proposal in this town.",
    next: (p) => questComplete(p, 'barberDye') ? 'dyeReady' : 'dyeWaiting'
  },
  dyeWaiting: { speaker: 'npc', text: "Go sweet-talk the barber. I'll be here. I'm always here.", end: true },
  dyeReady: {
    speaker: 'npc',
    text: "You actually got it? You know, most guys just tip and leave. You keep showing up. It's either sweet or a red flag. Don't tell anyone, but you're becoming my favorite mistake.",
    end: true,
    effect: (p) => { setQuest(p, 'stripperDye', 'complete'); p.affection.ruby = (p.affection.ruby || 0) + 2; }
  },
  pimpReveal: {
    speaker: 'npc',
    text: "Look, there's a guy. Ronnie. Calls himself my 'manager.' He's about as legitimate as a three-dollar bill and twice as greasy. If Ronnie disappeared tomorrow, I wouldn't exactly be lighting candles for him.",
    end: true
  },
  payoff: {
    speaker: 'npc',
    text: `You did that... for me? Nobody's ever decked a pimp on my behalf before. I think I'm blushing. Or that's the stage lighting. Alright, hotshot. Drinks are on the house. Don't get used to it. Here, take $${RUBY_REWARD_PAYOFF} - Ronnie's, not mine anymore.`,
    end: true,
    effect: (p) => { p.money += RUBY_REWARD_PAYOFF; p.affection.ruby = (p.affection.ruby || 0) + 5; setQuest(p, 'stripperPayoffSeen', 'complete'); }
  },
  afterglow: { speaker: 'npc', text: 'Drinks are on the house. Try not to make it weird.', end: true },
  bye: { speaker: 'npc', text: 'Door swings both ways, sugar. Come back anytime.', end: true }
};

function rubyStartKey(p) {
  if (questComplete(p, 'stripperPimp')) return questComplete(p, 'stripperPayoffSeen') ? 'afterglow' : 'payoff';
  if (questComplete(p, 'stripperDye')) return 'pimpReveal';
  if (questComplete(p, 'stripperWardrobe')) return 'dyeAsk';
  return 'metOnce';
}

const ronnieTree = {
  start: {
    speaker: 'npc',
    text: "Whoa, whoa, big spender. She's a business asset, you don't just walk off with the merchandise. You want trouble? I got trouble on speed dial, pal.",
    end: true
  }
};

const moeTree = {
  start: {
    speaker: 'npc',
    text: (p) => questComplete(p, 'clubKeg')
      ? "You're a lifesaver. Well - saved my job, which is basically the same thing."
      : "We're bone dry and it's karaoke night. You want to see this crowd without beer? I don't. There's a keg sitting across town with our name on it. Literally. I wrote it on there.",
    options: (p) => questComplete(p, 'clubKeg')
      ? [{ label: 'No problem', next: 'bye' }]
      : p.questItems.clubKeg
        ? [{ label: 'Got your keg right here', next: 'kegDeliver' }, { label: 'Still looking', next: 'bye' }]
        : [{ label: "I'll find it", next: 'bye' }]
  },
  kegDeliver: {
    speaker: 'npc',
    text: "Tell the bouncer I sent you. He doesn't trust anybody, but he trusts me, and now he sort of has to trust you.",
    end: true,
    effect: (p) => { p.questItems.clubKeg = false; setQuest(p, 'clubKeg', 'complete'); }
  },
  bye: { speaker: 'npc', text: 'Cheers.', end: true }
};

const dukeTree = {
  start: {
    speaker: 'npc',
    text: (p) => questComplete(p, 'clubVandalism')
      ? "Ha! Beautiful. Poetry. You're alright, new guy. Door's always open for you. Well - the door's always open, but now I won't glare at you."
      : "See that sign across town? The one for that other 'club'? Embarrassing. Somebody should fix that. I'm not saying commit a crime. I'm saying if that sign happened to fall down, I wouldn't lose sleep.",
    end: true
  }
};

const buildings = [
  {x: 20, y: 220, w: 180, h: 90,  wallH: 70, roof: '#9a3b3b', wall: '#7a2e2e', name: 'Tattoo Parlor', floor: '#3a2a2a', npcs: [{name:'Inkwell Ivy', color:'#c25fae', dialogue: ivyTree}]},
  {x: 230, y: 220, w: 150, h: 90, wallH: 70, roof: '#5f8fc2', wall: '#3a5f8f', name: 'Barber Shop', floor: '#e0d8c8', npcs: [
    {name:'Barber Bob', color:'#8f8f5f', dialogue: barberTree, getStartKey: (p) => questComplete(p, 'barberScissors') ? 'start' : 'scissorsPlea'},
    {name:'Barber Betty', color:'#c2905f', dialogue: barberTree, getStartKey: (p) => questComplete(p, 'barberScissors') ? 'start' : 'scissorsPlea'}
  ]},
  {x: 570, y: 170, w: 160, h: 110, wallH: 100,roof: '#4a6a8a', wall: '#37506a', name: 'Pharmacy', floor: '#2f3a44', npcs: [{name:'Pharmacist Pat', color:'#8fc25f'}]},
  {x: 2940, y: 220, w: 200, h: 90,  wallH: 70, roof: '#9a3b3b', wall: '#7a2e2e', name: 'Thrift Store', floor: '#3a3a2a', npcs: [{name:'Rummage Ruth', color:'#c2c25f', dialogue: thriftStoreTree}]},
  {x: 3180, y: 220, w: 150, h: 90, wallH: 70, roof: '#9a3b3b', wall: '#7a2e2e', name: 'Motel', floor: '#332f3a', npcs: [{name:'Front Desk Frank', color:'#5fc2a0'}]},
  {x: 1170, y: 190, w: 220, h: 100, wallH: 90, roof: '#8a7a58', wall: '#6a5c40', name: 'Grocery Store', floor: '#4a4433', npcs: [{name:'Stan the Stock Boy', color:'#5fa8c2'}, {name:'Cart Kid Cassie', color:'#c2a05f'}]},
  {x: 1660, y: 180, w: 240, h: 110,wallH: 90, roof: '#4a6a8a', wall: '#37506a', name: 'Restaurant', floor: '#3a2f22', npcs: [{name:'Waiter Waldo', color:'#c2c25f'}, {name:'Chef Chuck', color:'#c25f5f'}],
    ...tableSet(tableAt(120, 120), tableAt(380, 120), tableAt(120, 205), tableAt(380, 205))},
  {x: 2700, y: 200, w: 220, h: 100, wallH: 80, roof: '#8a7a58', wall: '#6a5c40', name: 'Gun Store', floor: '#3a3a3a', npcs: [{name:'Gunny Sue', color:'#8f8f5f', dialogue: gunStoreTree}]},
  {x: 2170, y: 220, w: 180, h: 90, wallH: 70, roof: '#6a5a48', wall: '#4a3f30', name: 'Coffee Shop', floor: '#3a2f22', npcs: [{name:'Barista Beth', color:'#c2905f'}]},
  {x: 1410, y: 190, w: 200, h: 100, wallH: 80, roof: '#5f8a6a', wall: '#40684a', name: 'Pet Store', floor: '#3a3a30', npcs: [{name:'Pet Store Penny', color:'#8fc25f'}]},

  {x: 610, y: 740, w: 260, h: 100, wallH: 80, roof: '#9a3b3b', wall: '#7a2e2e', name: 'Tavern', floor: '#3a2a1e', npcs: [
    {name:'Old Man Gus', color:'#a0a0a0'}, {name:'Regular Rita', color:'#c25f5f'},
    {name:'Barkeep Hank', color:'#8f7550', dialogue: beerOnlyTree}
  ], bar: { x: 110, y: 50, w: 280, h: 40, orientation: 'horizontal' },
    ...tableSet(tableAt(100, 165), tableAt(250, 150), tableAt(400, 165))},
  {x: 1110, y: 760, w: 200, h: 90,  wallH: 70, roof: '#8a7a58', wall: '#6a5c40', name: 'Bar', floor: '#332a22', npcs: [{
    name:'Bartender Bree', color:'#5f8fc2', dialogue: breeTree,
    getStartKey: (p) => p.traits.tattoo === 'skull' ? 'startSkull' : p.traits.tattoo === 'flower' ? 'startFlower' : 'startNone'
  }], bar: { x: 110, y: 50, w: 280, h: 40 },
    ...tableSet(tableAt(100, 165), tableAt(400, 165))},
  {x: 1320, y: 760, w: 130, h: 90, wallH: 70, roof: '#9a3b3b', wall: '#7a2e2e', name: 'Strip Club', floor: '#2a1a2a', npcs: [
    {name:'Bouncer Bruno', color:'#3a3a3a', gender: 'm', hairstyle: 'bald', big: true},
    {name:'Dancer Destiny', color:'#e05fa0', bikini: true, bikiniColor: '#e05fa0'},
    {name:'Dancer Crystal', color:'#a05fe0', bikini: true, bikiniColor: '#a05fe0'},
    {name:'Bartender Vic', color:'#5f8f8f', dialogue: beerOnlyTree}
  ], stage: { x: 150, y: 50, w: 200, h: 110, poleX: 250, poleY: 105 }, bar: { x: 400, y: 150, w: 40, h: 140, orientation: 'vertical' }},
  {x: 1480, y: 740, w: 150, h: 100, wallH: 80, roof: '#2a2a3a', wall: '#1f1f2c', name: 'Casino', floor: '#1a3a2a', npcs: [
    {name:'Dealer Deuce', color:'#3a3a3a', dialogue: blackjackTree}
  ]},
  {x: 1650, y: 720, w: 260, h: 110, wallH: 90, roof: '#4a6a8a', wall: '#37506a', name: 'Home', floor: '#4a3f33', npcs: []},
  {x: 2220, y: 700, w: 240, h: 120, wallH: 100, roof: '#c25f5f', wall: '#8f3f3f', name: 'Hospital', floor: '#e8e8e8', npcs: [{name:'Nurse Nancy', color:'#5f8fc2'}, {name:'Dr. Dan', color:'#eaeaea'}],
    ...bedSet(bedAt(110, 110, 70, 90), bedAt(390, 110, 70, 90))},

  {x: 90, y: 1780, w: 220, h: 100, wallH: 80, roof: '#4a8a5a', wall: '#376a44', name: 'Used Motorcycles', floor: '#3a3025', npcs: [{name:'Slick Sal', color:'#c2905f', dialogue: motoStoreTree}], displayBikes: [
    { x: 430, y: 80,  facing: 'left', color: '#8f2e2e' }, // red
    { x: 430, y: 140, facing: 'left', color: '#2e8f3e' }, // green
    { x: 430, y: 200, facing: 'left', color: '#222222' }, // black
    { x: 430, y: 260, facing: 'left', color: '#2e4a8f' }, // blue
    { x: 430, y: 320, facing: 'left', color: '#707070' }  // grey
  ]},
  {x: 620, y: 1760, w: 240, h: 110, wallH: 90, roof: '#6a4a8a', wall: '#503770', name: 'Used Cars', floor: '#2f3a2f', npcs: [{name:'Lemon Larry', color:'#5fc290', dialogue: carStoreTree}]},
  {x: 2160, y: 1780, w: 200, h: 100, wallH: 80, roof: '#8a7a58', wall: '#6a5c40', name: 'Mechanic Shop', floor: '#2a2a2a', npcs: [{name:'Wrench Wendy', color:'#909090'}]},
  {x: 2720, y: 1710, w: 280, h: 150, wallH: 100, roof: '#c2793a', wall: '#8f5a29', name: 'Mega Lo Mart', floor: '#33394a', npcs: [{name:'Greeter Gary', color:'#5f90c2'}, {name:'Cashier Carla', color:'#c25f8f'}]},
  {x: 3050, y: 1700, w: 300, h: 140, wallH: 90,  roof: '#4a8a3a', wall: '#356a28', name: 'Zoo', floor: '#5a7a3a', npcs: [{name:'Zookeeper Zeke', color:'#4a8a3a'}, {name:'Ticket Taker Tina', color:'#8f8f5f'}]},

  {x: 750, y: 220, w: 150, h: 90, wallH: 70, roof: '#6a8a9a', wall: '#4f6b78', name: 'Apartments', floor: '#3a3530', npcs: [{name:'Neighbor Nadia', color:'#c2905f'}]},
  {x: 40, y: 760, w: 150, h: 90, wallH: 70, roof: '#c2a25f', wall: '#8f7540', name: 'House', floor: '#3a3025', npcs: [{name:'Neighbor Norm', color:'#5f8fc2'}]},
  {x: 210, y: 760, w: 150, h: 90, wallH: 70, roof: '#8ac25f', wall: '#5f8f3a', name: 'House', floor: '#3a3a25', npcs: [{name:'Neighbor Nora', color:'#c25f8f'}]},
  {x: 2700, y: 730, w: 200, h: 100, wallH: 90, roof: '#9a6a8a', wall: '#704f70', name: 'Riverside Apartments', floor: '#332f3a', npcs: [{name:'Tenant Tim', color:'#8fc25f'}]},
  {x: 2920, y: 730, w: 200, h: 100, wallH: 90, roof: '#c27a5f', wall: '#8f5540', name: 'Sunset Apartments', floor: '#3a2f2a', npcs: [{name:'Tenant Tia', color:'#5fc2a0'}]},

  // --- civic block: police station, courthouse, and jail side by side ---
  {x: 3150, y: 740, w: 200, h: 100, wallH: 80, roof: '#2a3a6a', wall: '#1f2c4f', name: 'Police Station', floor: '#3a3f4a', npcs: [
    {name:'Officer Ortiz', color:'#2a3a6a', dialogue: bribeTree},
    {name:'Sergeant Stone', color:'#2a3a6a', gender: 'm', hairstyle: 'square', big: true}
  ]},
  {x: 3370, y: 720, w: 220, h: 110, wallH: 90, roof: '#8a8a7a', wall: '#6f6f5f', name: 'Courthouse', floor: '#d8d0c0', npcs: [
    {name:'Clerk Cliff', color:'#7a7a6a', dialogue: courtTree},
    {name:'Judge Jean', color:'#2a2a2a'}
  ]},
  {x: 3620, y: 740, w: 180, h: 100, wallH: 80, roof: '#5a5a5a', wall: '#454545', name: 'Jail', floor: '#3a3a3a', npcs: [
    {name:'Guard Greta', color:'#4a4a5a', dialogue: jailTree, big: true}
  ]},

  // --- new eastern block, alongside the wider map's extra streets ---
  {x: 4070, y: 220, w: 220, h: 100, wallH: 60, roof: '#8a7a4a', wall: '#6a5c30', name: 'Pawn Shop', floor: '#3a3a2a', npcs: [{name:'Pawnbroker Pete', color:'#8a7a4a'}]},
  {x: 4290, y: 230, w: 200, h: 95,  wallH: 55, roof: '#c2905f', wall: '#8f5f3a', name: 'Donut Shop', floor: '#e8d0b8', npcs: [{name:'Baker Dawn', color:'#c2905f'}]},
  {x: 4070, y: 760, w: 220, h: 100, wallH: 60, roof: '#8f3a3a', wall: '#5f2a2a', name: 'Boxing Gym', floor: '#3a3a3a', npcs: [{name:'Coach Cole', color:'#8f3a3a', gender:'m', big:true}]},
  {x: 4290, y: 770, w: 200, h: 95,  wallH: 55, roof: '#c25f9a', wall: '#8f3a70', name: 'Nail Salon', floor: '#f0e0e8', npcs: [{name:'Stylist Sonia', color:'#c25f9a'}]},

  // --- 4th St, a brand new street south of the park ---
  {x: 100,  y: 2390, w: 260, h: 105, wallH: 65, roof: '#5f7a9a', wall: '#3f5570', name: 'Furniture Store', floor: '#e8d8c0', npcs: [{name:'Salesman Sal', color:'#5f7a9a', dialogue: furnitureStoreTree}]},
  {x: 1300, y: 2410, w: 220, h: 95,  wallH: 55, roof: '#5f9ac2', wall: '#3a708f', name: 'Toy Store', floor: '#e0e8f0', npcs: [{name:'Clerk Chip', color:'#5f9ac2'}]},
  {x: 2680, y: 2400, w: 240, h: 100, wallH: 60, roof: '#c25f5f', wall: '#8f3a3a', name: 'Pizza Place', floor: '#e0d8c8', npcs: [{name:'Tony the Cook', color:'#c25f5f', gender:'m'}],
    ...tableSet(tableAt(120, 165), tableAt(380, 165))},
  {x: 3000, y: 2390, w: 280, h: 110, wallH: 100, roof: '#8a8a7a', wall: '#6a6a5a', name: 'Museum', floor: '#d8d0c0', npcs: [{name:'Curator Claire', color:'#5f8fc2'}, {name:'Guide Gabe', color:'#8a8a7a'}]},
  {x: 3350, y: 2400, w: 180, h: 90,  wallH: 60, roof: '#7a9a8a', wall: '#5a7a6a', name: 'Serenity Spa', floor: '#e8e0d8', npcs: [{name:'Masseuse Mia', color:'#7a9a8a'}]},
  {x: 4070, y: 2420, w: 200, h: 90,  wallH: 50, roof: '#5fc27a', wall: '#3a8f4a', name: 'Vet Clinic', floor: '#e8e8e8', npcs: [{name:'Doc Daisy', color:'#5fc27a'}]},

  // --- south side, across the river - a proper two-street grid (5th St
  // and 6th St, crossing the same Oak/Pine/Elm/Maple/Cedar line as
  // downtown) for a grayer, grimier neighborhood, only reachable over the
  // Pine St or Maple St bridge ---
  // row 1, fronting 5th St
  {x: 60,   y: 3410, w: 180, h: 90,  wallH: 60, roof: '#6a6a5a', wall: '#4a4a40', name: 'Corner Store', floor: '#3a3a32', seedy: true, npcs: [{name:'Clerk Duane', color:'#3a3a32', dirty: true}]},
  {x: 620,  y: 3410, w: 150, h: 90,  wallH: 70, roof: '#5a5248', wall: '#3a3630', name: 'Rundown House', floor: '#332f28', seedy: true, npcs: [{name:'Old Man Riggs', color:'#332f28', dirty: true}]},
  {x: 1150, y: 3410, w: 170, h: 90,  wallH: 65, roof: '#4a453f', wall: '#2f2b26', name: 'Drug Den', floor: '#242220', seedy: true, npcs: [{name:'Twitchy Tomas', color:'#2a2722', dirty: true}, {name:'Lookout Lou', color:'#211f1a', dirty: true}]},
  {x: 1600, y: 3410, w: 200, h: 100, wallH: 70, roof: '#6a5a4a', wall: '#4a3f32', name: 'Sundown Motel', floor: '#302a22', seedy: true, npcs: [{name:'Night Clerk Nadia', color:'#3a3228', dirty: true}]},
  // row 2, fronting 6th St
  {x: 2200, y: 3830, w: 170, h: 90,  wallH: 65, roof: '#6a4a58', wall: '#463038', name: 'Massage Parlor', floor: '#2e2228', seedy: true, npcs: [{name:'Madame Yu', color:'#3a2830', dirty: true}]},
  {x: 2750, y: 3830, w: 220, h: 100, wallH: 80, roof: '#5a4a3a', wall: '#3a2f24', name: 'Skid Row Bar', floor: '#28221a', seedy: true, npcs: [{name:'Bartender Zeke', color:'#332a20', dirty: true}, {name:'Regular Roy', color:'#282219', dirty: true}],
    bar: { x: 110, y: 50, w: 280, h: 40, orientation: 'horizontal' },
    ...tableSet(tableAt(100, 165), tableAt(400, 165))},
  {x: 3100, y: 3830, w: 220, h: 100, wallH: 90, roof: '#4a4a42', wall: '#302f2a', name: 'Rustwater Apartments', floor: '#282722', seedy: true, npcs: [{name:'Tenant Rico', color:'#282824', dirty: true}]},
  {x: 3450, y: 3830, w: 200, h: 100, wallH: 70, roof: '#5a3a4a', wall: '#3a2530', name: 'Peepshow Palace', floor: '#241a20', seedy: true, npcs: [
    {name:'Bouncer Duke', color:'#1a1a1a', gender: 'm', hairstyle: 'bald', big: true, dirty: true, dialogue: dukeTree},
    {name:'Dancer Ruby', color:'#c25f5f', bikini: true, bikiniColor: '#c25f5f', dialogue: rubyTree, getStartKey: rubyStartKey},
    {name:'Bartender Moe', color:'#332a20', dirty: true, dialogue: moeTree},
    {name:'Ronnie', color:'#5a4a3a', gender: 'm', dirty: true, dialogue: ronnieTree}
  ], stage: { x: 150, y: 50, w: 200, h: 110, poleX: 250, poleY: 105 }, bar: { x: 400, y: 150, w: 40, h: 140, orientation: 'vertical' }},
  // row 3, fronting 7th St - the south side keeps going before it hits
  // the world's true southern edge instead of stopping dead at 6th St
  {x: 200,  y: 4290, w: 170, h: 90,  wallH: 60, roof: '#5a4a3a', wall: '#3a2f24', name: "Loan Shark's Office", floor: '#282218', seedy: true, npcs: [{name:'Vinnie the Shark', color:'#3a3228', gender: 'm', dirty: true}]},
  {x: 900,  y: 4290, w: 150, h: 90,  wallH: 65, roof: '#4a453f', wall: '#2f2b26', name: 'Boarded Rowhouse', floor: '#242220', seedy: true, npcs: [{name:'Squatter Moss', color:'#211f1a', dirty: true}]},
  {x: 1700, y: 4290, w: 220, h: 100, wallH: 70, roof: '#5a4a3a', wall: '#3a2f24', name: 'Chop Shop', floor: '#28221a', seedy: true, npcs: [{name:'Mechanic Vic', color:'#332a20', gender: 'm', dirty: true}, {name:'Fence Freddy', color:'#282219', gender: 'm', dirty: true}]},

  // --- further out still, past the second river - a handful of rustic
  // cabins scattered through the woods, reachable via the Pine/Maple
  // dirt-road bridges ---
  {x: 700,  y: -580,  w: 160, h: 90, wallH: 70, roof: '#5a3a24', wall: '#3f2a1a', name: 'Ranger Station', floor: '#4a3a28', npcs: [{name:'Ranger Rick', color:'#4a6a3a'}]},
  {x: 700,  y: -2750, w: 140, h: 90, wallH: 60, roof: '#4a3320', wall: '#332318', name: 'Hunting Cabin', floor: '#3a2e20', npcs: [{name:'Trapper Tess', color:'#5a4a30'}]},
  {x: 2800, y: -2100, w: 150, h: 90, wallH: 60, roof: '#4a3320', wall: '#332318', name: 'Fishing Cabin', floor: '#3a2e20', npcs: [{name:'Fisherman Fred', color:'#3a5a70'}]},
  {x: 2000, y: -2850, w: 170, h: 90, wallH: 80, roof: '#4a453f', wall: '#332f28', name: 'Lookout Cabin', floor: '#3a3a34', npcs: [{name:'Lookout Lyle', color:'#5a5a52'}]},

  // --- farmland west of downtown, fronting the west continuation of
  // 2nd St ---
  {x: -400,  y: 720,  w: 170, h: 100, wallH: 70,  roof: '#8a5a3a', wall: '#6a4228', name: 'Miller Farmhouse', floor: '#e8d8b8', npcs: [{name:'Farmer Fiona', color:'#c2a25f'}]},
  {x: -1000, y: 680,  w: 90,  h: 90,  wallH: 110, roof: '#7a3a3a', wall: '#5a2a2a', name: 'Grain Silo', floor: '#3a3025', npcs: [{name:'Ranch Hand Roy', color:'#8a6a3a'}]},
  {x: -700,  y: 1120, w: 200, h: 120, wallH: 90,  roof: '#8f3a3a', wall: '#6a2a2a', name: 'Big Red Barn', floor: '#3a2a20', npcs: [{name:'Stable Hand Sue', color:'#5f8f5a'}]},
  {x: -250,  y: 1120, w: 120, h: 70,  wallH: 50,  roof: '#5f8f5a', wall: '#3f6a3f', name: 'Farm Stand', floor: '#c8a878', npcs: [{name:'Vendor Vince', color:'#c25f5f'}]},

  // --- a little seaside town further out, right on the beach ---
  {x: -1800, y: 730,  w: 160, h: 90,  wallH: 70,  roof: '#c25f5f', wall: '#8f3a3a', name: 'Seaside Diner', floor: '#e0d8c8', npcs: [{name:'Waitress Wendy', color:'#5f8fc2'}, {name:'Cook Carlos', color:'#8f5a2a'}]},
  {x: -2300, y: 650,  w: 80,  h: 80,  wallH: 160, roof: '#c25f5f', wall: '#e8e0d0', name: 'Lighthouse', floor: '#d8d0c0', npcs: [{name:'Keeper Ken', color:'#5f5f8f'}]},
  {x: -2100, y: 1120, w: 140, h: 80,  wallH: 60,  roof: '#4a6a5a', wall: '#354f42', name: 'Bait & Tackle Shop', floor: '#3a3a30', npcs: [{name:'Old Salt Sam', color:'#4a6a5a'}]},
  {x: -1850, y: 1120, w: 180, h: 100, wallH: 80,  roof: '#8a5a7a', wall: '#6a3f5a', name: 'Harbor Inn', floor: '#e0d8d8', npcs: [{name:'Innkeeper Ingrid', color:'#8a5a7a'}]}
];

buildings.forEach(b => b.npcs.forEach(n => {
  if (!n.gender) Object.assign(n, randomPersonStyle());
}));

const PARK = { x: 1170, y: 1170, w: 720, h: 720 };
const PARK_POND = { x: 250, y: 285, w: 220, h: 150 };
const PARK_PATH_BAND = 20;
const PARK_TREES = [
  { x: 60, y: 300 }, { x: 60, y: 420 }, { x: 660, y: 300 }, { x: 660, y: 420 },
  { x: 300, y: 60 }, { x: 420, y: 60 }, { x: 300, y: 660 }, { x: 420, y: 660 },
  { x: 150, y: 200 }, { x: 570, y: 200 }, { x: 150, y: 520 }, { x: 570, y: 520 }
];
const PARK_BUSHES = [
  { x: 180, y: 120 }, { x: 540, y: 120 }, { x: 180, y: 600 }, { x: 540, y: 600 },
  { x: 120, y: 300 }, { x: 120, y: 420 }, { x: 600, y: 300 }, { x: 600, y: 420 },
  { x: 300, y: 150 }, { x: 420, y: 150 }
];

const parkWalkers = [
  { name: 'Park-goer Priya', x: 400, y: 400, targetX: 400, targetY: 400, nextDecision: 0, speed: 0.8, color: '#c25f8f' },
  { name: 'Stroller Sam',    x: 200, y: 550, targetX: 200, targetY: 550, nextDecision: 0, speed: 0.72, color: '#5f8fc2' },
  { name: 'Frisbee Fran',    x: 550, y: 150, targetX: 550, targetY: 150, nextDecision: 0, speed: 0.9, color: '#8fc25f' },
  { name: 'Reader Ray',      x: 600, y: 620, targetX: 600, targetY: 620, nextDecision: 0, speed: 0.6, color: '#c2905f' }
].map(w => ({ ...w, ...randomPersonStyle(), knockedDownUntil: 0 }));

const parkObstacles = [
  { x: PARK.x + PARK_POND.x, y: PARK.y + PARK_POND.y, w: PARK_POND.w, h: PARK_POND.h },
  ...PARK_TREES.map(t => ({ x: PARK.x + t.x - 6, y: PARK.y + t.y - 6, w: 12, h: 12 }))
];

// the river itself, as a wall of water spanning the whole map except for
// gaps at the two bridges - blocks foot and vehicle movement alike, same
// as the pond does in the park
const riverObstacles = freeSegments(
  WORLD_W,
  NAMED_STREETS.filter(s => s.bridge).map(s => ({ start: s.x - SIDEWALK_W - 6, end: s.x + ROAD_W + SIDEWALK_W + 6 }))
).map(seg => ({ x: seg.start, y: RIVER_Y, w: seg.end - seg.start, h: RIVER_H }));

// --- the wilds north of downtown: a second river, then pine forest, a
// lake, a few rustic cabins, and mountains beyond. Pine St and Maple St -
// the same two streets that already bridge the first river to reach the
// seedy south side - are the roads that keep going the other way too,
// turning to dirt once they're past the city limits to the north ---
const NORTH_ROADS = NAMED_STREETS.filter(s => s.name === 'Pine St' || s.name === 'Maple St');
const RIVER2_Y = -320;
const RIVER2_H = 220;
const FOREST_Y = RIVER2_Y;              // forest's near (downtown-facing) edge
const MOUNTAIN_Y = WORLD_TOP + 400;     // forest's far edge / near edge of the mountain wall
const FOREST_DEPTH = FOREST_Y - MOUNTAIN_Y; // always positive - forest spans [MOUNTAIN_Y, FOREST_Y]
const LAKE = { x: 1150, y: -2650, w: 1300, h: 1000 };

// a wooden dock on the lake's south shore, sticking out into the water -
// the boat is moored at its far end
const LAKE_DOCK = { x: 1890, y: LAKE.y + LAKE.h - 240, w: 50, h: 270 };

const river2Obstacles = freeSegments(
  WORLD_W,
  NORTH_ROADS.map(s => ({ start: s.x - SIDEWALK_W - 6, end: s.x + ROAD_W + SIDEWALK_W + 6 }))
).map(seg => ({ x: seg.start, y: RIVER2_Y, w: seg.end - seg.start, h: RIVER2_H }));

const lakeObstacle = { x: LAKE.x, y: LAKE.y, w: LAKE.w, h: LAKE.h };
// spans the full world width (including the farmland/seaside town/ocean
// extension out west) so the mountains wall off the north edge no matter
// where you're standing, not just above downtown
const mountainObstacle = { x: WORLD_LEFT, y: WORLD_TOP, w: WORLD_W - WORLD_LEFT, h: MOUNTAIN_Y - WORLD_TOP };
// a second mountain wall closing off the far east edge - starts where the
// north wall's band ends (so the two don't overlap) and runs the rest of
// the way down to the world's southern edge, an L-shape around downtown
// and the south side. Well clear of the furthest-east buildings (Vet
// Clinic's east edge is at x:4270, Cedar St's road ends at x:4040)
const EAST_MOUNTAIN_DEPTH = 300;
const eastMountainObstacle = { x: WORLD_W - EAST_MOUNTAIN_DEPTH, y: MOUNTAIN_Y, w: EAST_MOUNTAIN_DEPTH, h: WORLD_H - MOUNTAIN_Y };
// lakeObstacle is handled separately in tryMoveOutside (it only blocks
// vehicles, not feet or the boat) - the mountain walls block everyone
const wildernessObstacles = [mountainObstacle, eastMountainObstacle];

// a dirt road running the full width of the world, up near the
// mountains - Ridge Road
const RIDGE_ROAD_Y = -3270;
const RIDGE_ROADS = [{ name: 'Ridge Rd', y: RIDGE_ROAD_Y }];

// two loop trails peeling off each end of Ridge Road, dropping south
// and curving back in to rejoin Pine St (west) and Maple St (east) - so
// there's a way back down to the main road from either end of the ridge
const LOOP_Y = -800;
const WEST_LOOP = { vx: 300, hx0: 300, hx1: 940 };
const EAST_LOOP = { vx: 4300, hx0: 2520, hx1: 4300 };
const LOOP_SEGMENTS = [
  { horizontal: false, x: WEST_LOOP.vx, y0: RIDGE_ROAD_Y + ROAD_W, y1: LOOP_Y + ROAD_W },
  { horizontal: true,  y: LOOP_Y, x0: WEST_LOOP.hx0, x1: WEST_LOOP.hx1 },
  { horizontal: false, x: EAST_LOOP.vx, y0: RIDGE_ROAD_Y + ROAD_W, y1: LOOP_Y + ROAD_W },
  { horizontal: true,  y: LOOP_Y, x0: EAST_LOOP.hx0, x1: EAST_LOOP.hx1 }
];

// jump ramps - now entirely player-placed via the track editor (press
// [T] to toggle it) rather than hand-authored. Each is just a free
// {x, y, size} point, not tied to any particular road, and persists in
// localStorage as you build the track out. Starts empty on a fresh save.
let TRACK_RAMPS = [];
try {
  const savedRamps = localStorage.getItem('trackRamps');
  if (savedRamps) TRACK_RAMPS = JSON.parse(savedRamps);
} catch (e) { /* ignore a corrupt save, just start empty */ }
function saveTrackRamps() {
  localStorage.setItem('trackRamps', JSON.stringify(TRACK_RAMPS));
}

// a winding dirt hiking trail through the woods - purely cosmetic, no
// collision, just a dashed path linking the trailhead near the Ranger
// Station to the lake and up toward the Lookout Cabin - routed around
// the lake's west and north shore rather than across it. Declared before
// FOREST_TREES below so the tree scatter can keep clear of it too
const HIKING_TRAIL = [
  { x: 700, y: -580 }, { x: 750, y: -1000 }, { x: 700, y: -1800 },
  { x: 750, y: -2700 }, { x: 1000, y: -3150 }, { x: 1600, y: -3200 },
  { x: 2000, y: -3180 }
];

// pine forest, scattered procedurally rather than hand-placed - skips
// the dirt roads, the lake, the hiking trail, and a margin around each
// so nothing spawns inside another obstacle or right on top of a path
const FOREST_TREES = [];
{
  const keepOutZones = [
    ...NORTH_ROADS.map(s => ({ x: s.x - 40, y: MOUNTAIN_Y, w: ROAD_W + 80, h: FOREST_DEPTH })),
    { x: 0, y: RIDGE_ROAD_Y - 20, w: WORLD_W, h: ROAD_W + 40 },
    ...LOOP_SEGMENTS.map(s => s.horizontal
      ? { x: s.x0 - 40, y: s.y - 40, w: (s.x1 - s.x0) + 80, h: ROAD_W + 80 }
      : { x: s.x - 40, y: Math.min(s.y0, s.y1) - 40, w: ROAD_W + 80, h: Math.abs(s.y1 - s.y0) + 80 }),
    { x: LAKE.x - 50, y: LAKE.y - 50, w: LAKE.w + 100, h: LAKE.h + 100 },
    { x: 660,  y: -620,  w: 240, h: 240 },  // Ranger Station
    { x: 660,  y: -2790, w: 220, h: 230 },  // Hunting Cabin
    { x: 2760, y: -2140, w: 230, h: 230 },  // Fishing Cabin
    { x: 1960, y: -2890, w: 250, h: 250 }   // Lookout Cabin
  ];
  const TRAIL_TREE_MARGIN = 45;
  let attempts = 0;
  while (FOREST_TREES.length < 240 && attempts < 5000) {
    attempts++;
    const x = 60 + Math.random() * (WORLD_W - 120);
    const y = MOUNTAIN_Y + 60 + Math.random() * (FOREST_DEPTH - 160);
    if (keepOutZones.some(z => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h)) continue;
    let nearTrail = false;
    for (let i = 0; i < HIKING_TRAIL.length - 1; i++) {
      const a = HIKING_TRAIL[i], b = HIKING_TRAIL[i + 1];
      if (pointToSegmentDist(x, y, a.x, a.y, b.x, b.y) < TRAIL_TREE_MARGIN) { nearTrail = true; break; }
    }
    if (nearTrail) continue;
    FOREST_TREES.push({ x, y, pine: true, scale: 0.9 + Math.random() * 0.6 });
  }
}
const forestTreeObstacles = FOREST_TREES.map(t => {
  const r = 7 * t.scale;
  return { x: t.x - r, y: t.y - r, w: r * 2, h: r * 2 };
});

// --- a second, smaller stretch of woods northwest of downtown, between
// the farmland/seaside town and the mountains - the same taper the
// original forest gives downtown, just on the west side of the meridian,
// where there was previously nothing but bare ground between the coast
// and the mountain wall ---
const WEST_FOREST_Y = 500; // near/south edge - clear of the seaside town's northmost buildings (Lighthouse, y:650)
const WEST_FOREST_DEPTH = WEST_FOREST_Y - MOUNTAIN_Y;
const LAKE2 = { x: -1900, y: -2400, w: 420, h: 320 };
const LAKE3 = { x: -900,  y: -900,  w: 380, h: 300 };

const WEST_FOREST_TREES = [];
{
  const keepOutZones = [
    { x: LAKE2.x - 50, y: LAKE2.y - 50, w: LAKE2.w + 100, h: LAKE2.h + 100 },
    { x: LAKE3.x - 50, y: LAKE3.y - 50, w: LAKE3.w + 100, h: LAKE3.h + 100 }
  ];
  // x stays east of the boardwalk/shore (so nothing spawns in the ocean)
  // and west of the meridian (so it doesn't overlap downtown's own forest)
  const WEST_FOREST_X0 = -2400, WEST_FOREST_X1 = -60;
  let attempts = 0;
  while (WEST_FOREST_TREES.length < 150 && attempts < 5000) {
    attempts++;
    const x = WEST_FOREST_X0 + Math.random() * (WEST_FOREST_X1 - WEST_FOREST_X0);
    const y = MOUNTAIN_Y + 60 + Math.random() * (WEST_FOREST_DEPTH - 160);
    if (keepOutZones.some(z => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h)) continue;
    WEST_FOREST_TREES.push({ x, y, pine: true, scale: 0.9 + Math.random() * 0.6 });
  }
}
const westForestTreeObstacles = WEST_FOREST_TREES.map(t => {
  const r = 7 * t.scale;
  return { x: t.x - r, y: t.y - r, w: r * 2, h: r * 2 };
});

function inLake2(x, y) {
  const cx = LAKE2.x + LAKE2.w / 2, cy = LAKE2.y + LAKE2.h / 2;
  const nx = (x - cx) / (LAKE2.w / 2), ny = (y - cy) / (LAKE2.h / 2);
  return nx * nx + ny * ny <= 1;
}
function inLake3(x, y) {
  const cx = LAKE3.x + LAKE3.w / 2, cy = LAKE3.y + LAKE3.h / 2;
  const nx = (x - cx) / (LAKE3.w / 2), ny = (y - cy) / (LAKE3.h / 2);
  return nx * nx + ny * ny <= 1;
}

// short sandy spurs off the shore leading down into the water - now
// extended well past the shoreline so it reads as walking into deep
// water rather than just dipping a toe in
const LAKE_PATHS = [
  [{ x: 780, y: -2700 }, { x: 950, y: -2680 }, { x: 1150, y: -2600 }, { x: 1400, y: -2500 }],
  [{ x: 2780, y: -2100 }, { x: 2600, y: -2150 }, { x: 2450, y: -2200 }, { x: 2150, y: -2250 }]
];

// a couple of NPCs who just live in the lake, wandering/swimming inside
// its bounds - simpler than routing existing citizens across the bridge
const lakeSwimmers = [
  { name: 'Swimmer Sasha', x: LAKE.x + 400, y: LAKE.y + 300, targetX: LAKE.x + 400, targetY: LAKE.y + 300, nextDecision: 0, speed: 0.5, color: '#c25f8f' },
  { name: 'Swimmer Theo',  x: LAKE.x + 800, y: LAKE.y + 600, targetX: LAKE.x + 800, targetY: LAKE.y + 600, nextDecision: 0, speed: 0.45, color: '#5f8fc2' }
].map(w => ({ ...w, ...randomPersonStyle(), knockedDownUntil: 0 }));

// --- farmland and a little seaside town, west of downtown - reached by
// 2nd St, which just keeps going west instead of stopping at the old
// edge of the world. Ends at a beach, a boardwalk, and the open ocean ---
const WEST_ROAD_Y = 940; // reuses 2nd St's own y - same road, keeps going
const WEST_ROAD_X0 = -2420; // west end, right at the boardwalk

// the boardwalk/road/town positions all stay put - the ocean and beach
// get wider by pushing OCEAN_X1 (and the world's edge) further west,
// leaving extra open water for a future surfing feature
const OCEAN_X0 = WORLD_LEFT;
const OCEAN_X1 = -2700;
// the ocean now runs the full north-south length of the world - up to
// the same mountain wall that stops you north of downtown, and down to
// the same southern edge (WORLD_H) downtown itself is bounded by -
// instead of just a strip along the beach town
const OCEAN_Y0 = MOUNTAIN_Y;
const OCEAN_Y1 = WORLD_H;

const BOARDWALK = { x: -2460, y: 500, w: 40, h: 1000 };
const SHORE = { x: OCEAN_X1, y: OCEAN_Y0, w: BOARDWALK.x - OCEAN_X1, h: OCEAN_Y1 - OCEAN_Y0 };

// a few lifeguard stands along the beach - decorative, but still solid
// enough that you can't just walk straight through one
const LIFEGUARD_STANDS = [
  { x: -2580, y: 600 },
  { x: -2580, y: 950 },
  { x: -2580, y: 1300 }
];
const lifeguardObstacles = LIFEGUARD_STANDS.map(s => ({ x: s.x - 14, y: s.y - 14, w: 28, h: 28 }));

// a generic "hidden item spawn zone" - a flat list of world-space quest
// spots, each either a pickup (walk up, press E, it joins your quest
// inventory) or an action (walk up, press E, it fires an effect on the
// spot immediately - no item involved). One system for every quest,
// future items just add another entry here
const QUEST_SPOTS = [
  { id: 'stripperWardrobe', kind: 'pickup', x: 500,  y: -1400, label: "Ruby's Clothes", color: '#c25f5f' },
  { id: 'barberDye',        kind: 'pickup', x: -190, y: 1320,  label: 'Hair Dye Bottle', color: '#a8342a' },
  { id: 'barberScissors',   kind: 'pickup', x: 1670, y: 1670,  label: 'Missing Scissors', color: '#9a9a9a' },
  { id: 'clubKeg',          kind: 'pickup', x: 3040, y: 1785,  label: 'Beer Keg', color: '#8a5a2a' },
  { id: 'casinoMarkedDeck', kind: 'pickup', x: 1660, y: 800,   label: 'Marked Deck', color: '#2a2a2a' },
  {
    id: 'clubVandalism', kind: 'action', x: 1385, y: 950, label: 'Rival Sign', color: '#7a7a7a',
    // only worth showing/triggering once the keg quest has opened it up
    available: (p) => questComplete(p, 'clubKeg') && !questComplete(p, 'clubVandalism'),
    effect: (p) => { setQuest(p, 'clubVandalism', 'complete'); p.wanted += 1; showFlavorMessage('You knock the rival club\'s sign clean off the wall.'); }
  }
];
const QUEST_SPOT_RADIUS = 30;

function questSpotVisible(spot, p) {
  if (spot.kind === 'pickup') return !p.questItemsFound[spot.id];
  return spot.available ? spot.available(p) : !questComplete(p, spot.id);
}

// how far out from shore the breakers/waves reach - extended back out to
// half the ocean's width so there's a lot more open water to catch a
// wave in and a longer ride surfing all the way in to the beach
const BREAKER_WIDTH = (OCEAN_X1 - OCEAN_X0) / 2;

// a riptide band hugging the open-water edge of the ocean, well past the
// breakers - swimming/surfing out this far gets shoved back toward shore
// the same way the breakers do, so open water reads as "far out" rather
// than something you can swim across indefinitely to the world's edge
const RIPTIDE_WIDTH = 500;

// shared with waveHumpOffset() so the surfboard can track the exact
// world position of a real tall wave's crest peak, not an approximation
const WAVE_PEAK_F = 0.72;
const WAVE_TALL_MULT = 1.9;

// a handful of farm fields - just tinted, furrow-textured ground
// patches, purely decorative and walkable like any other ground
const FARM_FIELDS = [
  { x: -1350, y: 550, w: 380, h: 260, color: '#b8952e' },  // wheat
  { x: -1350, y: 900, w: 380, h: 260, color: '#6a8f3a' },  // cover crop
  { x: -880,  y: 550, w: 300, h: 610, color: '#8a6a3a' }   // tilled soil
];

// short dirt spurs connecting a few farm buildings to the road, same
// cosmetic-only treatment as the lake's sandy paths
const FARM_PATHS = [
  [{ x: -315, y: 820 }, { x: -315, y: 918 }],
  [{ x: -955, y: 770 }, { x: -955, y: 918 }],
  [{ x: -600, y: 1102 }, { x: -600, y: 1120 }],
  [{ x: -190, y: 1102 }, { x: -190, y: 1120 }]
];

// a farmhand or two out working the fields - same simple wander pattern
// as the lake swimmers/park walkers
const farmhands = [
  { name: 'Farmhand Gus', x: -1200, y: 700, targetX: -1200, targetY: 700, nextDecision: 0, speed: 0.6, color: '#8a6a3a' },
  { name: 'Farmhand Dot', x: -750,  y: 850, targetX: -750,  targetY: 850, nextDecision: 0, speed: 0.55, color: '#c2905f' }
].map(w => ({ ...w, ...randomPersonStyle(), knockedDownUntil: 0 }));

const citizens = [
  { name: 'Jogger Jamie',      homeX: 200,  homeY: 390, x: 200,  y: 390, color: '#c2905f' },
  { name: 'Commuter Cody',     homeX: 640,  homeY: 390, x: 640,  y: 390, color: '#5f8fc2' },
  { name: 'Dog Walker Dee',    homeX: 840,  homeY: 390, x: 840,  y: 390, color: '#c25f8f' },
  { name: 'Shopper Shane',     homeX: 1280, homeY: 390, x: 1280, y: 390, color: '#8fc25f' },
  { name: 'Tourist Tara',      homeX: 1780, homeY: 390, x: 1780, y: 390, color: '#c2c25f' },
  { name: 'Errand Eddie',      homeX: 2860, homeY: 390, x: 2860, y: 390, color: '#905fc2' },

  { name: 'Regular Rick',      homeX: 740,  homeY: 930, x: 740,  y: 930, color: '#c25f5f' },
  { name: 'Night Owl Nina',    homeX: 1280, homeY: 930, x: 1280, y: 930, color: '#5fc2a0' },
  { name: 'Cabbie Carl',       homeX: 1780, homeY: 930, x: 1780, y: 930, color: '#c2905f' },

  { name: 'Grease Monkey Gil', homeX: 200,  homeY: 1970, x: 200,  y: 1970, color: '#5f8fc2' },
  { name: 'Parts Runner Pete', homeX: 740,  homeY: 1970, x: 740,  y: 1970, color: '#c2a05f' },
  { name: 'Test Driver Toni',  homeX: 2250, homeY: 1970, x: 2250, y: 1970, color: '#8f8f5f' },
  { name: 'Cart Pusher Cam',   homeX: 2860, homeY: 1970, x: 2860, y: 1970, color: '#5fc290' },
  { name: 'Beat Cop Barnes',   homeX: 3080, homeY: 890,  x: 3080, y: 890,  color: '#2a3a6a' },
  { name: 'Officer Reyes',     homeX: 400,  homeY: 930,  x: 400,  y: 930,  color: '#2a3a6a' },

  // south side, across the river - a grubbier crowd to match the neighborhood
  { name: 'Junkie Jess',       homeX: 400,  homeY: 3590, x: 400,  y: 3590, color: '#4a453f', dirty: true },
  { name: 'Hustler Hank',      homeX: 1200, homeY: 3750, x: 1200, y: 3750, color: '#3a362f', dirty: true },
  { name: 'Scavenger Sam',     homeX: 2000, homeY: 3590, x: 2000, y: 3590, color: '#332f28', dirty: true },
  { name: 'Wanderer Wade',     homeX: 2800, homeY: 4050, x: 2800, y: 4050, color: '#2a2722', dirty: true },
  { name: 'Pawnshop Pauly',    homeX: 3600, homeY: 4210, x: 3600, y: 4210, color: '#3a3228', dirty: true },
  { name: 'Shady Sheila',      homeX: 4200, homeY: 3750, x: 4200, y: 3750, color: '#3a2830', dirty: true },
  { name: 'Alley Cat Angie',   homeX: 600,  homeY: 4400, x: 600,  y: 4400, color: '#463038', dirty: true },
  { name: 'Rust Ronnie',       homeX: 2000, homeY: 4400, x: 2000, y: 4400, color: '#302f2a', dirty: true },
].map(c => ({
  ...c,
  ...randomPersonStyle(),
  facing: 'down',
  path: null, pathIndex: 0,
  speed: 0.6 + Math.random() * 0.25,
  nextDecision: 0,
  state: 'wander',
  enterTarget: null,
  insideBuilding: null,
  insideUntil: 0,
  knockedDownUntil: 0
}));

buildings.forEach(b => {
  // every building sits back a little from the curb with a walkway
  // connecting the door to it - depth varies building to building, seeded
  // from its own position so it stays put
  b.yardDepth = Math.min(14 + hashNoise(b.x, b.y + 50) * 14, b.wallH - 36);
  b.wallDepth = b.wallH - b.yardDepth;

  b.doorZone = { x: b.x + b.w/2 - 18, y: b.y + b.h + b.wallDepth - 10, w: 36, h: 20 };
  b.npcs.forEach((n, i) => {
    n.x = 80 + (i % 3) * 140;
    n.y = 100 + Math.floor(i / 3) * 80;
    n.targetX = n.x;
    n.targetY = n.y;
    n.nextDecision = 0;
    n.knockedDownUntil = 0;
  });
});

// put the dancers up on the stage instead of the generic room layout
{
  const stripClub = buildings.find(b => b.name === 'Strip Club');
  const destiny = stripClub.npcs.find(n => n.name === 'Dancer Destiny');
  const crystal = stripClub.npcs.find(n => n.name === 'Dancer Crystal');
  const bruno = stripClub.npcs.find(n => n.name === 'Bouncer Bruno');
  if (destiny) { destiny.x = 210; destiny.y = 90; destiny.targetX = destiny.x; destiny.targetY = destiny.y; destiny.onStage = true; }
  if (crystal) { crystal.x = 290; crystal.y = 90; crystal.targetX = crystal.x; crystal.targetY = crystal.y; crystal.onStage = true; }
  if (bruno) { bruno.x = ROOM_W/2 - 70; bruno.y = ROOM_H - 70; bruno.targetX = bruno.x; bruno.targetY = bruno.y; bruno.guardDoor = true; }
}

// keep Bree behind the bar counter instead of wandering the whole room
{
  const barBuilding = buildings.find(b => b.name === 'Bar');
  const bree = barBuilding.npcs.find(n => n.name === 'Bartender Bree');
  if (bree) { bree.x = 250; bree.y = 35; bree.targetX = bree.x; bree.targetY = bree.y; bree.behindBar = true; }
}

// same for the Tavern's bartender, behind their horizontal counter
{
  const tavern = buildings.find(b => b.name === 'Tavern');
  const hank = tavern.npcs.find(n => n.name === 'Barkeep Hank');
  if (hank) { hank.x = 250; hank.y = 35; hank.targetX = hank.x; hank.targetY = hank.y; hank.behindBar = true; }
}

// and the Strip Club's bartender, tucked behind their vertical side bar
{
  const stripClubBuilding = buildings.find(b => b.name === 'Strip Club');
  const vic = stripClubBuilding.npcs.find(n => n.name === 'Bartender Vic');
  if (vic) { vic.x = 460; vic.y = 220; vic.targetX = vic.x; vic.targetY = vic.y; vic.behindBar = true; }
}

// the bike sits parked out front of Used Motorcycles in a side profile,
// facing right, whether or not the player has bought it yet
const usedMotorcyclesShop = buildings.find(b => b.name === 'Used Motorcycles');
const MOTO_SHOWROOM_SPOT = {
  x: usedMotorcyclesShop.doorZone.x + usedMotorcyclesShop.doorZone.w / 2 + 60,
  y: usedMotorcyclesShop.doorZone.y + usedMotorcyclesShop.doorZone.h,
  facing: 'right'
};

// same idea for the car, parked out front of Used Cars
const usedCarsShop = buildings.find(b => b.name === 'Used Cars');
const CAR_SHOWROOM_SPOT = {
  x: usedCarsShop.doorZone.x + usedCarsShop.doorZone.w / 2 + 70,
  y: usedCarsShop.doorZone.y + usedCarsShop.doorZone.h,
  facing: 'right'
};
