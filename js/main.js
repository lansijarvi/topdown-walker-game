document.getElementById('shootBtn').addEventListener('click', shoot);
document.getElementById('reloadBtn').addEventListener('click', reload);

// helper to bind a "held down" virtual key to a button, using both touch
// and mouse events so it also works for testing with a mouse on desktop
function bindHoldButton(id, keyName) {
  const el = document.getElementById(id);
  if (!el) return;
  const press = (e) => { e.preventDefault(); keys[keyName] = true; };
  const release = (e) => { e.preventDefault(); keys[keyName] = false; };
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release, { passive: false });
  el.addEventListener('touchcancel', release, { passive: false });
  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
}

bindHoldButton('dpadUp', 'w');
bindHoldButton('dpadDown', 's');
bindHoldButton('dpadLeft', 'a');
bindHoldButton('dpadRight', 'd');

// RUN is a toggle instead of a hold button - trying to hold it down while
// also pressing a direction button is awkward with one thumb, so tap once
// to start running and tap again to stop
const runBtn = document.getElementById('dpadRun');
if (runBtn) {
  const toggleRun = (e) => {
    e.preventDefault();
    keys['shift'] = !keys['shift'];
    runBtn.classList.toggle('active', keys['shift']);
  };
  runBtn.addEventListener('touchstart', toggleRun, { passive: false });
  runBtn.addEventListener('click', toggleRun);
}

// one-shot action buttons - fire once per tap rather than being held
function bindTapButton(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  const fire = (e) => { e.preventDefault(); fn(); };
  el.addEventListener('touchstart', fire, { passive: false });
  el.addEventListener('click', fire);
}

bindTapButton('talkBtn', pressInteract);
bindTapButton('gunBtn', toggleGunEquip);
bindTapButton('motoBtn', toggleVehicle);
bindTapButton('mapBtn', toggleMap);
bindTapButton('wheelieBtn', () => { tryJumpOrWheelie(); trySurfCatch(); });

const SAVE_KEY = 'topdownWalkerSave';
let lastSaveFlashUntil = 0;

function saveGame() {
  const data = {
    player,
    scene,
    // index into `buildings`, not name - two buildings are both named "House"
    currentBuildingIndex: currentBuilding ? buildings.indexOf(currentBuilding) : -1,
    motorcycleParked,
    carParked,
    boatParked,
    surfboardParked
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  lastSaveFlashUntil = performance.now() + 1500;
}

// resets everything in memory rather than reloading the page - a couple
// of embedded preview panels (VS Code's Live Preview among them) don't
// reliably refetch the page on location.reload(), which made New Game
// look like it did nothing at all
function resetGameState() {
  localStorage.removeItem(SAVE_KEY);
  Object.assign(player, JSON.parse(JSON.stringify(DEFAULT_PLAYER)));
  scene = 'outside';
  currentBuilding = null;
  motorcycleParked = null;
  carParked = null;
  boatParked = { ...BOAT_SPOT };
  surfboardParked = { ...SURFBOARD_SPOT };
  dialogueOpen = false;
  dialogueTree = null;
  dialogueNodeKey = 'start';
  mapOpen = false;
  nearbyNPC = null;
  nearbySeat = null;
  nearbyBed = null;
  nearbyShower = null;
  nearbyFixture = null;
  nearbyQuestSpot = null;
  interactCooldownUntil = 0;
  playerHitUntil = 0;
  playerHitPending = false;
  muzzleFlashUntil = 0;
  bullets = [];
  syncDialogueOptionsOverlay();
  updateNameDisplay();
  openNameOverlay('');
}

document.getElementById('newGameBtn').addEventListener('click', () => {
  if (confirm('Start a new game? This erases your current save.')) {
    resetGameState();
  }
});

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.assign(player, data.player);
    // never resume a save mid-sit/lie/shower - if the autosave (every 5s)
    // happened to catch the player in one of those states, their x/y is
    // sitting right on top of the furniture's own solid collision rect;
    // clearing just the flag isn't enough, or they'd load in standing but
    // stuck inside the bed/couch/shower with no way to walk out. Snapping
    // back to the saved restSpot (the walkable approach point) fixes both.
    if (player.restSpot) {
      player.x = player.restSpot.x - player.w / 2;
      player.y = player.restSpot.y - player.h / 2;
      player.facing = player.restSpot.facing;
    }
    player.sitting = false;
    player.lying = false;
    player.showering = false;
    player.restSpot = null;
    // wheelie/jump are all performance.now()-relative timestamps - a
    // stale one from a previous session reads as "still in the future"
    // against the fresh session's clock (which restarts near 0), leaving
    // the bike stuck mid-animation with broken math for a long stretch
    player.wheelieUntil = 0;
    player.jumpUntil = 0;
    player.jumpCooldownUntil = 0;
    player.jumpTotalMs = 0;
    player.jumpBoosted = false;
    player.jumpHeightMult = 1;
    scene = data.scene === 'interior' ? 'interior' : 'outside';
    currentBuilding = (data.currentBuildingIndex >= 0 && buildings[data.currentBuildingIndex]) ? buildings[data.currentBuildingIndex] : null;
    motorcycleParked = data.motorcycleParked || null;
    carParked = data.carParked || null;
    // a save from before this fix (or one written mid-edge-case) could
    // have the board parked on dry land - re-validate on load too, not
    // just when freshly parking it
    const loadedBoatSpot = data.boatParked || BOAT_SPOT;
    boatParked = safeBoatSpot(loadedBoatSpot.x, loadedBoatSpot.y, loadedBoatSpot.facing);
    player.onBoat = false; // never resume mid-boat-ride - always reload standing at the dock
    const loadedSurfSpot = data.surfboardParked || SURFBOARD_SPOT;
    surfboardParked = safeSurfSpot(loadedSurfSpot.x, loadedSurfSpot.y, loadedSurfSpot.facing);
    player.onSurfboard = false; // never resume mid-surf - always reload standing on the sand
    player.ridingWave = false;
  } catch (e) {
    console.error('Failed to load save', e);
  }
}

function updateNameDisplay() {
  document.getElementById('nameDisplay').textContent = player.name ? `Playing as: ${player.name}` : '';
}

function openNameOverlay(prefill) {
  awaitingName = true;
  const overlay = document.getElementById('nameOverlay');
  const input = document.getElementById('nameInput');
  overlay.classList.add('open');
  input.value = prefill || '';
  input.focus();
}

function submitName() {
  const input = document.getElementById('nameInput');
  player.name = input.value.trim().slice(0, 20) || 'Drifter';
  document.getElementById('nameOverlay').classList.remove('open');
  awaitingName = false;
  updateNameDisplay();
  saveGame();
  // a fresh game (New Game, or first-ever load) has no finance tier yet -
  // chain straight into that choice. Renaming later never hits this,
  // since financeTier is already set by then
  if (!player.financeTier) openTierOverlay();
}

document.getElementById('nameSubmitBtn').addEventListener('click', submitName);
document.getElementById('nameInput').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') submitName();
});
document.getElementById('renameBtn').addEventListener('click', () => openNameOverlay(player.name));

const TIER_STARTING_MONEY = { broke: 500, comfortable: 5000, loaded: 10000 };

function openTierOverlay() {
  awaitingTier = true;
  document.getElementById('tierOverlay').classList.add('open');
}

function submitTier(tier) {
  player.financeTier = tier;
  player.money = TIER_STARTING_MONEY[tier];
  document.getElementById('tierOverlay').classList.remove('open');
  awaitingTier = false;
  saveGame();
}

document.querySelectorAll('.tierBtn').forEach(btn => {
  btn.addEventListener('click', () => submitTier(btn.dataset.tier));
});

const MUTE_KEY = 'topdownWalkerMuted';
const muteBtn = document.getElementById('muteBtn');
function applyMuteButtonLabel() {
  muteBtn.textContent = audioMuted ? '🔇' : '🔊';
}
muteBtn.addEventListener('click', () => {
  setAudioMuted(!audioMuted);
  localStorage.setItem(MUTE_KEY, audioMuted ? '1' : '0');
  applyMuteButtonLabel();
});
setAudioMuted(localStorage.getItem(MUTE_KEY) === '1');
applyMuteButtonLabel();

loadGame();
if (!player.name) openNameOverlay('');
else updateNameDisplay();
if (scene === 'outside') startAmbientHum();
setInterval(saveGame, 5000);
window.addEventListener('beforeunload', saveGame);

requestAnimationFrame(loop);
