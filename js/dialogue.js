// default small-talk tree used by any NPC without a custom conversation
const helloTree = {
  start: { speaker: 'npc', text: 'Hello!', end: true }
};

// Ivy's tattoo conversation
const ivyTree = {
  start: {
    speaker: 'npc', text: 'Would you like a tattoo?',
    options: [
      { label: 'Yes', next: 'choose' },
      { label: 'No', next: 'decline' }
    ]
  },
  choose: {
    speaker: 'npc', text: 'Would you like a skull or a flower?',
    options: [
      { label: 'Skull', next: 'skullGood' },
      { label: 'Flower', next: 'flowerGood' }
    ]
  },
  skullGood:  { speaker: 'npc', text: 'Good choice, a skull!', next: 'skullGive' },
  skullGive:  { speaker: 'npc', text: "Here's your skull!", end: true, effect: (p) => { p.traits.tattoo = 'skull'; } },
  flowerGood: { speaker: 'npc', text: 'Good choice, a flower!', next: 'flowerGive' },
  flowerGive: { speaker: 'npc', text: "Here's your flower!", end: true, effect: (p) => { p.traits.tattoo = 'flower'; } },
  decline:    { speaker: 'npc', text: 'Ok, let me know if you change your mind. See you later!', end: true, effect: (p) => { p.traits.tattoo = 'none'; p.traits.wholesomePath = true; } }
};

// Bree reacts differently depending on the tattoo you got from Ivy
const BEER_PRICE = 5;
const SHOT_PRICE = 10;

// simple beer-only tree, reused for bartenders who don't pour shots
const beerOnlyTree = {
  start: { speaker: 'npc', text: "What can I get you?",
    options: [
      { label: `Beer ($${BEER_PRICE})`, next: 'checkBeer' },
      { label: 'Nothing, thanks', next: 'noThanks' }
    ]
  },
  checkBeer: {
    speaker: 'npc',
    text: (p) => canAfford(p, BEER_PRICE) ? "One beer, coming up." : `That's $${BEER_PRICE}. You're a little short.`,
    next: (p) => canAfford(p, BEER_PRICE) ? 'buyBeer' : 'tooExpensive'
  },
  buyBeer: {
    speaker: 'npc', text: "Here's your beer!", end: true,
    effect: (p) => { spendMoney(p, BEER_PRICE); p.drinksConsumed = (p.drinksConsumed || 0) + 1; }
  },
  tooExpensive: { speaker: 'npc', text: "Come back when you've got more cash.", end: true },
  noThanks: { speaker: 'npc', text: "Let me know if you change your mind.", end: true }
};

const breeTree = {
  startSkull: {
    speaker: 'npc',
    text: "Ooh, skull tattoo? Somebody's trying to look dangerous.",
    options: [
      { label: 'Play it cool', next: 'skullCool' },
      { label: '"Guilty as charged."', next: 'skullFlirt' }
    ]
  },
  skullCool:  { speaker: 'npc', text: "Mysterious type, huh? I like it.", next: 'orderMenu' },
  skullFlirt: { speaker: 'npc', text: "Careful, that act might actually work on me.", next: 'orderMenu' },

  startFlower: {
    speaker: 'npc', text: "A flower tattoo? Sweet. I like a guy in touch with his feelings.",
    options: [
      { label: '"I have layers."', next: 'flowerCharm' },
      { label: 'Shrug', next: 'flowerShrug' }
    ]
  },
  flowerCharm: { speaker: 'npc', text: "Ha! Careful, that's kind of working on me.", next: 'orderMenu' },
  flowerShrug: { speaker: 'npc', text: "Strong, silent, and floral. Interesting combo.", next: 'orderMenu' },

  startNone: {
    speaker: 'npc', text: "Hey there. Kind of a blank slate, aren't you?",
    next: 'noneReply'
  },
  noneReply: { speaker: 'you', text: "Guess I haven't found my look yet.", next: 'orderMenu' },

  orderMenu: {
    speaker: 'npc', text: "What can I get you, handsome?",
    options: [
      { label: `Beer ($${BEER_PRICE})`, next: 'checkBeer' },
      { label: `Shot ($${SHOT_PRICE})`, next: 'checkShot' },
      { label: 'Nothing, thanks', next: 'noThanks' }
    ]
  },
  checkBeer: {
    speaker: 'npc',
    text: (p) => canAfford(p, BEER_PRICE) ? "One beer, coming up." : `That's $${BEER_PRICE}. You're a little short.`,
    next: (p) => canAfford(p, BEER_PRICE) ? 'buyBeer' : 'tooExpensive'
  },
  buyBeer: {
    speaker: 'npc', text: "Here's your beer!", end: true,
    effect: (p) => { spendMoney(p, BEER_PRICE); p.drinksConsumed = (p.drinksConsumed || 0) + 1; }
  },
  checkShot: {
    speaker: 'npc',
    text: (p) => canAfford(p, SHOT_PRICE) ? "One shot, coming up." : `That's $${SHOT_PRICE}. You're a little short.`,
    next: (p) => canAfford(p, SHOT_PRICE) ? 'buyShot' : 'tooExpensive'
  },
  buyShot: {
    speaker: 'npc', text: "Here's your shot!", end: true,
    effect: (p) => { spendMoney(p, SHOT_PRICE); p.drinksConsumed = (p.drinksConsumed || 0) + 1; }
  },
  tooExpensive: { speaker: 'npc', text: "Come back when you've got more cash.", end: true },
  noThanks: { speaker: 'npc', text: "Let me know if you change your mind.", end: true }
};

// haircut is $25, an optional recolor after is another $25 - Bob and
// Betty both work off this same tree
const HAIRCUT_PRICE = 25;
const HAIR_COLOR_PRICE = 25;
const HAIRCUTS = [
  { key: 'bald',    name: 'Bald' },
  { key: 'long',    name: 'Long Hair' },
  { key: 'buzz',    name: 'Buzz Cut' },
  { key: 'mohawk',  name: 'Mohawk' },
  { key: 'square',  name: 'Flat Top' }
];
const HAIR_COLORS = [
  { key: '#1a1a1a', name: 'Black' },
  { key: '#4a3020', name: 'Brown' },
  { key: '#d4af6a', name: 'Blonde' },
  { key: '#3a8f4a', name: 'Green' },
  { key: '#a8342a', name: 'Red' }
];

const barberTree = {
  // gone until the scissors are back - see getStartKey on the barber
  // NPC entries, which routes here instead of 'start' the whole time
  scissorsPlea: {
    speaker: 'npc',
    text: "Some clown grabbed my good scissors and bolted. Didn't even get a decent tip out of him. Coward. Those aren't just scissors, they're a lifestyle - bring 'em back and I'll owe you one.",
    options: (p) => p.questItems.barberScissors
      ? [{ label: 'Here are your scissors', next: 'scissorsReturn' }, { label: 'Not yet', next: 'scissorsBye' }]
      : [{ label: "I'll keep an eye out", next: 'scissorsBye' }]
  },
  scissorsReturn: {
    speaker: 'npc',
    text: "You're a lifesaver. Sit down, first trim's on me - assuming you've still got hair after whatever you just did.",
    end: true,
    effect: (p) => { p.questItems.barberScissors = false; setQuest(p, 'barberScissors', 'complete'); }
  },
  scissorsBye: { speaker: 'npc', text: "Come back if you spot 'em.", end: true },
  dyeRequest: {
    speaker: 'npc',
    text: "Farmland's got a supplier who does this insane 'cherry bomb red' - illegal in three counties, probably. Fetch me a bottle. Don't ask why a farm town sells hair dye. Some questions are better left alone.",
    options: (p) => p.questItems.barberDye
      ? [{ label: "Here's the dye", next: 'dyeDeliver' }, { label: 'Still looking', next: 'bye' }]
      : [{ label: "I'll find it", next: 'bye' }]
  },
  dyeDeliver: {
    speaker: 'npc',
    text: "Now THIS is chemistry. Somebody's about to have a very good hair day.",
    end: true,
    effect: (p) => { p.questItems.barberDye = false; setQuest(p, 'barberDye', 'complete'); }
  },
  start: {
    speaker: 'npc',
    text: 'Need a haircut?',
    options: (p) => [
      ...HAIRCUTS.map(h => ({ label: `${h.name} - $${HAIRCUT_PRICE}`, next: 'checkCutFunds', hairstyle: h.key })),
      ...(questComplete(p, 'barberScissors') && !questComplete(p, 'barberDye') ? [{ label: 'Got a second?', next: 'dyeRequest' }] : []),
      { label: 'Just browsing', next: 'bye' }
    ]
  },
  checkCutFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, HAIRCUT_PRICE) ? `That'll be $${HAIRCUT_PRICE}.` : `That's $${HAIRCUT_PRICE}. You're a bit short.`,
    next: (p) => canAfford(p, HAIRCUT_PRICE) ? 'applyCut' : 'tooExpensive'
  },
  applyCut: {
    speaker: 'npc',
    text: 'There you go, all cut!',
    next: 'colorPrompt',
    effect: (p) => { spendMoney(p, HAIRCUT_PRICE); p.hairstyle = p.pendingHairstyle; }
  },
  colorPrompt: {
    speaker: 'npc',
    text: `Want to color it too? Another $${HAIR_COLOR_PRICE}.`,
    options: () => [
      ...HAIR_COLORS.map(c => ({ label: `${c.name} - $${HAIR_COLOR_PRICE}`, next: 'checkColorFunds', haircolor: c.key })),
      { label: 'No color, thanks', next: 'bye' }
    ]
  },
  checkColorFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, HAIR_COLOR_PRICE) ? `That's $${HAIR_COLOR_PRICE}.` : `That's $${HAIR_COLOR_PRICE}. You're short on cash - guess it stays natural.`,
    next: (p) => canAfford(p, HAIR_COLOR_PRICE) ? 'applyColor' : 'bye'
  },
  applyColor: {
    speaker: 'npc',
    text: 'Looking sharp!',
    end: true,
    effect: (p) => { spendMoney(p, HAIR_COLOR_PRICE); p.hairColor = p.pendingHairColor; }
  },
  tooExpensive: {
    speaker: 'npc', text: 'Come back when you have the cash.', end: true
  },
  bye: {
    speaker: 'npc', text: 'Look good out there!', end: true
  }
};

const GUN_PRICE = 250;
const MAG_SIZE = 15;
const MAG_PRICE = 35;

const gunStoreTree = {
  start: {
    speaker: 'npc',
    text: (p) => p.hasGun ? "Need more ammo, or something else?" : "You want to buy a gun?",
    options: (p) => p.hasGun
      ? [
          { label: `Buy a magazine ($${MAG_PRICE})`, next: 'checkMagFunds' },
          { label: 'No thanks', next: 'decline' }
        ]
      : [
          { label: 'Yes', next: 'checkFunds' },
          { label: 'No', next: 'decline' }
        ]
  },
  checkFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, GUN_PRICE) ? `That'll be $${GUN_PRICE}. It's a Glock, comes with one 15-round mag.` : `That's $${GUN_PRICE}. You're short on cash.`,
    next: (p) => canAfford(p, GUN_PRICE) ? 'purchase' : 'tooExpensive'
  },
  purchase: {
    speaker: 'npc',
    text: "Here's your Glock! Press G to draw or holster it, Space to fire, R to reload.",
    end: true,
    effect: (p) => { spendMoney(p, GUN_PRICE); p.hasGun = true; p.ammoInMag = MAG_SIZE; p.spareMags = 0; }
  },
  checkMagFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, MAG_PRICE) ? `That'll be $${MAG_PRICE} for a 15-round mag.` : `That's $${MAG_PRICE}. You're short on cash.`,
    next: (p) => canAfford(p, MAG_PRICE) ? 'purchaseMag' : 'tooExpensive'
  },
  purchaseMag: {
    speaker: 'npc',
    text: "Here's a fresh mag. Press R to reload when you're running low.",
    end: true,
    effect: (p) => { spendMoney(p, MAG_PRICE); p.spareMags += 1; }
  },
  tooExpensive: {
    speaker: 'npc', text: "Come back when you've got the cash.", end: true
  },
  decline: {
    speaker: 'npc', text: "Suit yourself. Let me know if you change your mind.", end: true
  }
};

const MOTO_PRICE = 500;

const motoStoreTree = {
  start: {
    speaker: 'npc',
    text: (p) => p.hasMotorcycle ? "She still running good for you?" : `Looking for a ride? Got a solid bike for $${MOTO_PRICE}.`,
    options: (p) => p.hasMotorcycle
      ? [ { label: 'Just looking', next: 'ownAlready' } ]
      : [
          { label: 'Yes', next: 'checkFunds' },
          { label: 'No', next: 'decline' }
        ]
  },
  ownAlready: {
    speaker: 'npc', text: "Take care of her and she'll take care of you.", end: true
  },
  checkFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, MOTO_PRICE) ? `That'll be $${MOTO_PRICE}. What color do you want her in?` : `That's $${MOTO_PRICE}. You're short on cash.`,
    next: (p) => canAfford(p, MOTO_PRICE) ? 'chooseColor' : 'tooExpensive'
  },
  chooseColor: {
    speaker: 'npc',
    text: "Pick a color.",
    options: [
      { label: 'Red',   next: 'purchase', color: '#8f2e2e' },
      { label: 'Green', next: 'purchase', color: '#2e8f3e' },
      { label: 'Black', next: 'purchase', color: '#222222' },
      { label: 'Blue',  next: 'purchase', color: '#2e4a8f' },
      { label: 'Grey',  next: 'purchase', color: '#707070' }
    ]
  },
  purchase: {
    speaker: 'npc',
    text: "She's all gassed up! Press M to hop on or park it.",
    end: true,
    effect: (p) => {
      spendMoney(p, MOTO_PRICE);
      p.hasMotorcycle = true;
      motorcycleParked = { ...MOTO_SHOWROOM_SPOT, color: p.pendingMotoColor || '#8f2e2e' };
      p.motoColor = p.pendingMotoColor || '#8f2e2e';
    }
  },
  tooExpensive: {
    speaker: 'npc', text: "Come back when you've got the cash.", end: true
  },
  decline: {
    speaker: 'npc', text: "Alright, she'll be here if you change your mind.", end: true
  }
};

const CAR_PRICE = 800;

const carStoreTree = {
  start: {
    speaker: 'npc',
    text: (p) => p.hasCar ? "That car treating you right?" : `Got a nice used car for $${CAR_PRICE}, runs great.`,
    options: (p) => p.hasCar
      ? [ { label: 'Just looking', next: 'ownAlready' } ]
      : [
          { label: 'Yes', next: 'checkFunds' },
          { label: 'No', next: 'decline' }
        ]
  },
  ownAlready: {
    speaker: 'npc', text: "Good, good. Keep the oil changed.", end: true
  },
  checkFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, CAR_PRICE) ? `That'll be $${CAR_PRICE}. What color do you want it in?` : `That's $${CAR_PRICE}. You're short on cash.`,
    next: (p) => canAfford(p, CAR_PRICE) ? 'chooseColor' : 'tooExpensive'
  },
  chooseColor: {
    speaker: 'npc',
    text: "Pick a color.",
    options: [
      { label: 'Red',   next: 'purchase', color: '#8f2e2e' },
      { label: 'Green', next: 'purchase', color: '#2e8f3e' },
      { label: 'Black', next: 'purchase', color: '#222222' },
      { label: 'Blue',  next: 'purchase', color: '#2e4a8f' },
      { label: 'Grey',  next: 'purchase', color: '#707070' }
    ]
  },
  purchase: {
    speaker: 'npc',
    text: "She's all yours! Press C to hop in or park it.",
    end: true,
    effect: (p) => {
      spendMoney(p, CAR_PRICE);
      p.hasCar = true;
      carParked = { ...CAR_SHOWROOM_SPOT, color: p.pendingCarColor || '#8f2e2e' };
      p.carColor = p.pendingCarColor || '#8f2e2e';
    }
  },
  tooExpensive: {
    speaker: 'npc', text: "Come back when you've got the cash.", end: true
  },
  decline: {
    speaker: 'npc', text: "Alright, let me know if you change your mind.", end: true
  }
};

// each piece is bought once and then just always shows up at its fixed
// spot in the player's home - no placement UI, just an on/off per item
const FURNITURE_ITEMS = [
  { key: 'couch', name: 'Couch', price: 150 },
  { key: 'bookshelf', name: 'Bookshelf', price: 80 },
  { key: 'rug', name: 'Rug', price: 40 }
];

const furnitureStoreTree = {
  start: {
    speaker: 'npc',
    text: (p) => FURNITURE_ITEMS.every(f => p.homeFurniture.includes(f.key))
      ? "You've already got everything I sell - your place must look great."
      : "Looking to fix up the place? I've got a few pieces for the house.",
    options: (p) => {
      const opts = FURNITURE_ITEMS
        .filter(f => !p.homeFurniture.includes(f.key))
        .map(f => ({ label: `${f.name} - $${f.price}`, next: 'checkFunds', item: f.key }));
      opts.push({ label: opts.length ? 'Just looking' : 'Thanks', next: 'bye' });
      return opts;
    }
  },
  checkFunds: {
    speaker: 'npc',
    text: (p) => {
      const item = FURNITURE_ITEMS.find(f => f.key === p.pendingFurnitureItem);
      return canAfford(p, item.price) ? `That'll be $${item.price} for the ${item.name}.` : `That's $${item.price}. You're short on cash.`;
    },
    next: (p) => {
      const item = FURNITURE_ITEMS.find(f => f.key === p.pendingFurnitureItem);
      return canAfford(p, item.price) ? 'purchase' : 'tooExpensive';
    }
  },
  purchase: {
    speaker: 'npc',
    text: (p) => `There you go, one ${FURNITURE_ITEMS.find(f => f.key === p.pendingFurnitureItem).name} for the house.`,
    end: true,
    effect: (p) => {
      const item = FURNITURE_ITEMS.find(f => f.key === p.pendingFurnitureItem);
      spendMoney(p, item.price);
      p.homeFurniture.push(item.key);
    }
  },
  tooExpensive: {
    speaker: 'npc', text: "Come back when you've got the cash.", end: true
  },
  bye: {
    speaker: 'npc', text: "Come back anytime.", end: true
  }
};

// second-hand shop: bigger, bulkier stuff for the house - same buy-once,
// fixed-spot pattern as FURNITURE_ITEMS/furnitureStoreTree above
const THRIFT_ITEMS = [
  { key: 'bed', name: 'Bed', price: 200 },
  { key: 'barstools', name: 'Bar Stools', price: 60 }
];

const thriftStoreTree = {
  start: {
    speaker: 'npc',
    text: (p) => THRIFT_ITEMS.every(f => p.homeFurniture.includes(f.key))
      ? "You've cleaned me out! Nothing left here for you."
      : "Rummage through the good stuff - furnish the whole house from here.",
    options: (p) => {
      const opts = THRIFT_ITEMS
        .filter(f => !p.homeFurniture.includes(f.key))
        .map(f => ({ label: `${f.name} - $${f.price}`, next: 'checkFunds', item: f.key }));
      opts.push({ label: opts.length ? 'Just looking' : 'Thanks', next: 'bye' });
      return opts;
    }
  },
  checkFunds: {
    speaker: 'npc',
    text: (p) => {
      const item = THRIFT_ITEMS.find(f => f.key === p.pendingFurnitureItem);
      return canAfford(p, item.price) ? `That'll be $${item.price} for the ${item.name}.` : `That's $${item.price}. You're short on cash.`;
    },
    next: (p) => {
      const item = THRIFT_ITEMS.find(f => f.key === p.pendingFurnitureItem);
      return canAfford(p, item.price) ? 'purchase' : 'tooExpensive';
    }
  },
  purchase: {
    speaker: 'npc',
    text: (p) => `Sold! One ${THRIFT_ITEMS.find(f => f.key === p.pendingFurnitureItem).name} for the house.`,
    end: true,
    effect: (p) => {
      const item = THRIFT_ITEMS.find(f => f.key === p.pendingFurnitureItem);
      spendMoney(p, item.price);
      p.homeFurniture.push(item.key);
    }
  },
  tooExpensive: {
    speaker: 'npc', text: "Come back when you've got the cash.", end: true
  },
  bye: {
    speaker: 'npc', text: "Come back anytime.", end: true
  }
};

// Courthouse clerk - pay off any outstanding tickets and fines here
const courtTree = {
  start: {
    speaker: 'npc',
    text: (p) => p.finesOwed > 0 ? `Let's see... you owe $${p.finesOwed} in tickets and fines.` : "No outstanding fines on your record. Stay out of trouble.",
    options: (p) => p.finesOwed > 0
      ? [
          { label: 'Pay it', next: 'checkPay' },
          { label: 'Not right now', next: 'later' }
        ]
      : [ { label: 'Will do', next: 'bye' } ]
  },
  checkPay: {
    speaker: 'npc',
    text: (p) => canAfford(p, p.finesOwed) ? "Paid in full. You're all square with the city." : "You don't have enough to cover it. Come back with the money.",
    next: (p) => canAfford(p, p.finesOwed) ? 'paid' : 'bye'
  },
  paid: {
    speaker: 'npc', text: "Try to use the crosswalks next time.", end: true,
    effect: (p) => { spendMoney(p, p.finesOwed); p.finesOwed = 0; }
  },
  later: { speaker: 'npc', text: "It's not going anywhere. Neither are you, legally speaking.", end: true },
  bye: { speaker: 'npc', text: "Next!", end: true }
};

const BRIBE_PRICE_PER_HEAT = 100;
const bribeTree = {
  start: {
    speaker: 'npc',
    text: (p) => p.wanted > 0
      ? `You've got a file building up, friend. I could lose some of that paperwork. For a price. A generous price. That's $${p.wanted * BRIBE_PRICE_PER_HEAT}.`
      : "Clean record, far as I can see. Keep it that way.",
    options: (p) => p.wanted > 0
      ? [{ label: 'Pay up', next: 'checkBribe' }, { label: 'Not today', next: 'later' }]
      : [{ label: 'Good to hear', next: 'bye' }]
  },
  checkBribe: {
    speaker: 'npc',
    text: (p) => canAfford(p, p.wanted * BRIBE_PRICE_PER_HEAT) ? "Clean slate isn't cheap, but neither is a jail cell. Your call." : "Come back when you can actually afford to disappear.",
    next: (p) => canAfford(p, p.wanted * BRIBE_PRICE_PER_HEAT) ? 'paid' : 'bye'
  },
  paid: {
    speaker: 'npc',
    text: 'Funny thing about paperwork - it burns real easy. What file?',
    end: true,
    effect: (p) => { spendMoney(p, p.wanted * BRIBE_PRICE_PER_HEAT); p.wanted = 0; }
  },
  later: { speaker: 'npc', text: "Offer stands. It's not getting cheaper.", end: true },
  bye: { speaker: 'npc', text: 'Move along.', end: true }
};

// Jail guard - not much conversation to be had
const jailTree = {
  start: { speaker: 'npc', text: "No visitors today. Keep your nose clean and we won't meet again.", end: true }
};

// --- Blackjack (Casino) ---
const BLACKJACK_BETS = [10, 25, 50, 100];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const CARD_RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function makeShuffledDeck() {
  const deck = [];
  for (const suit of CARD_SUITS) for (const rank of CARD_RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return Number(card.rank);
}

function handTotal(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand) { return hand.length === 2 && handTotal(hand) === 21; }

function handString(hand, hideSecond) {
  const cards = hideSecond ? [hand[0], null] : hand;
  return cards.map(c => c ? `${c.rank}${c.suit}` : '??').join(' ');
}

function startBlackjackHand(p, bet) {
  const deck = makeShuffledDeck();
  p.bj = { deck, bet, playerHand: [deck.pop(), deck.pop()], dealerHand: [deck.pop(), deck.pop()], stood: false };
}

function dealerPlayBlackjack(p) {
  const { deck, dealerHand } = p.bj;
  while (handTotal(dealerHand) < 17) dealerHand.push(deck.pop());
}

function settleBlackjack(p) {
  const { bet, playerHand, dealerHand } = p.bj;
  const playerTotal = handTotal(playerHand);
  const dealerTotal = handTotal(dealerHand);
  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);

  if (playerTotal > 21) { p.bj.outcome = `Bust! You lose $${bet}.`; return; }
  if (playerBJ && dealerBJ) { p.money += bet; p.bj.outcome = `Both blackjack - push. Bet returned.`; return; }
  if (playerBJ) { const win = Math.floor(bet * 1.5); p.money += bet + win; p.bj.outcome = `Blackjack! You win $${win}.`; return; }
  if (dealerBJ) { p.bj.outcome = `Dealer has blackjack. You lose $${bet}.`; return; }
  if (dealerTotal > 21) { p.money += bet * 2; p.bj.outcome = `Dealer busts! You win $${bet}.`; return; }
  if (playerTotal > dealerTotal) { p.money += bet * 2; p.bj.outcome = `You win $${bet}!`; return; }
  if (playerTotal === dealerTotal) { p.money += bet; p.bj.outcome = `Push. Bet returned.`; return; }
  p.bj.outcome = `Dealer wins. You lose $${bet}.`;
}

const HIGH_ROLLER_PRICE = 1000;
const HIGH_ROLLER_BETS = [250, 500, 1000];
const MARKED_DECK_REWARD = 150;

const blackjackTree = {
  start: {
    speaker: 'npc',
    text: "Welcome to the tables. Blackjack, dealer's choice of stakes.",
    options: (p) => [
      { label: 'Play a hand', next: 'chooseBet' },
      ...(questComplete(p, 'casinoHighRoller')
        ? [{ label: 'High-roller table', next: 'chooseBetHighRoller' }]
        : [{ label: `High-roller room ($${HIGH_ROLLER_PRICE} buy-in)`, next: 'checkHighRollerFunds' }]),
      ...(questComplete(p, 'casinoMarkedDeck') ? [] : [{ label: "Got a minute? (something's off with this table)", next: 'markedDeckOffer' }]),
      { label: 'Nothing, thanks', next: 'bye' }
    ]
  },
  checkHighRollerFunds: {
    speaker: 'npc',
    text: (p) => canAfford(p, HIGH_ROLLER_PRICE) ? `High-roller room's members only, chief. And by 'members' I mean 'people with money.' That'll be $${HIGH_ROLLER_PRICE}.` : "Come back when your pockets are heavier than your ego.",
    next: (p) => canAfford(p, HIGH_ROLLER_PRICE) ? 'joinHighRoller' : 'bye'
  },
  joinHighRoller: {
    speaker: 'npc',
    text: 'Welcome to the big leagues.',
    next: 'chooseBetHighRoller',
    effect: (p) => { spendMoney(p, HIGH_ROLLER_PRICE); setQuest(p, 'casinoHighRoller', 'complete'); }
  },
  chooseBetHighRoller: {
    speaker: 'npc',
    text: 'How much are you betting?',
    options: (p) => [
      ...HIGH_ROLLER_BETS.filter(b => canAfford(p, b)).map(b => ({ label: `$${b}`, bet: b, next: 'deal' })),
      { label: 'Nothing, I\'m out', next: 'bye' }
    ]
  },
  markedDeckOffer: {
    speaker: 'npc',
    text: "Somebody's running a cold deck through my table and it ain't me. Bad for business, worse for my nerves. Find that deck, burn it, bury it, I don't care. Just make it disappear.",
    options: (p) => p.questItems.casinoMarkedDeck
      ? [{ label: 'Found it - here', next: 'markedDeckDeliver' }, { label: 'Still looking', next: 'bye' }]
      : [{ label: "I'll find it", next: 'bye' }]
  },
  markedDeckDeliver: {
    speaker: 'npc',
    text: `Well I'll be. You actually did it. Drinks on the house - the cheap stuff, don't push it. Here's $${MARKED_DECK_REWARD} for the trouble.`,
    end: true,
    effect: (p) => { p.questItems.casinoMarkedDeck = false; setQuest(p, 'casinoMarkedDeck', 'complete'); p.money += MARKED_DECK_REWARD; }
  },
  chooseBet: {
    speaker: 'npc',
    text: "How much are you betting?",
    options: (p) => [
      ...BLACKJACK_BETS.filter(b => canAfford(p, b)).map(b => ({ label: `$${b}`, bet: b, next: 'deal' })),
      { label: 'Nothing, I\'m out', next: 'bye' }
    ]
  },
  deal: {
    speaker: 'npc',
    text: (p) => `You: ${handString(p.bj.playerHand)} (${handTotal(p.bj.playerHand)})  Dealer: ${handString(p.bj.dealerHand, true)}`,
    effect: (p) => { spendMoney(p, p.bj.bet); },
    next: (p) => (isBlackjack(p.bj.playerHand) || isBlackjack(p.bj.dealerHand)) ? 'settle' : 'playing'
  },
  playing: {
    speaker: 'npc',
    text: (p) => `You: ${handString(p.bj.playerHand)} (${handTotal(p.bj.playerHand)})  Dealer: ${handString(p.bj.dealerHand, true)}`,
    options: [
      { label: 'Hit', next: 'hit' },
      { label: 'Stand', next: 'dealerTurn' }
    ]
  },
  hit: {
    speaker: 'npc',
    text: (p) => `You draw ${handString([p.bj.playerHand[p.bj.playerHand.length - 1]])}.`,
    effect: (p) => { p.bj.playerHand.push(p.bj.deck.pop()); },
    next: (p) => handTotal(p.bj.playerHand) > 21 ? 'settle' : 'playing'
  },
  dealerTurn: {
    speaker: 'npc',
    text: (p) => `Dealer flips over and plays: ${handString(p.bj.dealerHand)} (${handTotal(p.bj.dealerHand)})`,
    effect: (p) => { dealerPlayBlackjack(p); },
    next: 'settle'
  },
  settle: {
    speaker: 'npc',
    text: (p) => p.bj.outcome,
    effect: (p) => { settleBlackjack(p); },
    next: (p) => HIGH_ROLLER_BETS.includes(p.bj.bet) ? 'chooseBetHighRoller' : 'chooseBet'
  },
  bye: { speaker: 'npc', text: "Suit yourself. Table's open if you change your mind.", end: true }
};
