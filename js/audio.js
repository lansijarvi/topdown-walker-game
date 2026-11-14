// --- Audio ---
// all sound is synthesized with the Web Audio API rather than loaded from
// files, so the game stays a single self-contained HTML document. Browsers
// require a user gesture before audio can play, so the context is created
// lazily and resumed on the first key/click/touch rather than at page load.
let audioCtx = null;
let masterGain = null;
let audioMuted = false;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = audioMuted ? 0 : 0.5;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function unlockAudioOnce() {
  getAudioCtx();
  window.removeEventListener('keydown', unlockAudioOnce);
  window.removeEventListener('mousedown', unlockAudioOnce);
  window.removeEventListener('touchstart', unlockAudioOnce);
}
window.addEventListener('keydown', unlockAudioOnce);
window.addEventListener('mousedown', unlockAudioOnce);
window.addEventListener('touchstart', unlockAudioOnce);

function setAudioMuted(muted) {
  audioMuted = muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}

// short noise burst with a fast lowpass sweep - the classic synthesized
// gunshot: a sharp crack that darkens as it decays
function playGunshot() {
  if (audioMuted) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.15);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.frequency.exponentialRampToValueAtTime(250, now + 0.15);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(filter).connect(gain).connect(masterGain);
  noise.start(now);
  noise.stop(now + 0.15);
}

// a single short square-wave blip, reused for both reload clicks and as
// the building block for NPC "gibberish" talking
function playClick(freq, delay, duration, vol) {
  if (audioMuted) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (duration || 0.04));
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + (duration || 0.04) + 0.02);
}

function playReloadSound() {
  playClick(900, 0, 0.03, 0.12);
  playClick(650, 0.09, 0.04, 0.12);
}

// Animal-Crossing-style "gibberish" chatter - a short burst of random-pitch
// blips standing in for speech, played once whenever a new NPC line appears
function playGibberish() {
  if (audioMuted) return;
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    playClick(160 + Math.random() * 260, i * 0.09, 0.06, 0.08);
  }
}

// a background traffic car sweeping past close to the player - pitch rises
// then falls away, like a real vehicle passing by
function playPassingCar() {
  if (audioMuted) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.linearRampToValueAtTime(150, now + 0.15);
  osc.frequency.linearRampToValueAtTime(70, now + 0.55);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 450;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.55);
  osc.connect(filter).connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.55);
}

// a light two-note car horn honk
function playHonk() {
  if (audioMuted) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  [440, 550].forEach(freq => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  });
}

// soft footstep tap for the player walking on foot (not while riding)
function playFootstep() {
  if (audioMuted) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110 + Math.random() * 40, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.07);
}

// two-tone shop-door chime, played on entering or leaving a building
function playDoorChime() {
  if (audioMuted) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const t = now + i * 0.08;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}

// continuous, very quiet filtered-noise drone - distant city traffic hum,
// running the whole time the player is outside so the world doesn't feel
// dead silent between the more specific sound effects
let ambientNoiseSource = null, ambientGain = null;
function startAmbientHum() {
  if (audioMuted || ambientNoiseSource) return;
  const ctx = getAudioCtx();
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  ambientNoiseSource = ctx.createBufferSource();
  ambientNoiseSource.buffer = buffer;
  ambientNoiseSource.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  ambientGain = ctx.createGain();
  ambientGain.gain.value = audioMuted ? 0 : 0.03;
  ambientNoiseSource.connect(filter).connect(ambientGain).connect(masterGain);
  ambientNoiseSource.start();
}
function stopAmbientHum() {
  if (!ambientNoiseSource) return;
  try { ambientNoiseSource.stop(); } catch (e) {}
  ambientNoiseSource = null;
  ambientGain = null;
}

// looping vehicle engine drone - a single oscillator whose pitch and
// volume track how fast the player is currently going, started/stopped
// whenever they mount/dismount rather than re-created every frame
let engineOsc = null, engineGain = null, engineFilter = null;
function startEngine(kind) {
  if (audioMuted || engineOsc) return;
  const ctx = getAudioCtx();
  engineOsc = ctx.createOscillator();
  engineOsc.type = kind === 'car' ? 'sawtooth' : 'square';
  engineOsc.frequency.value = 50;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = kind === 'car' ? 500 : 900;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(masterGain);
  engineOsc.start();
}
function updateEngine(speedRatio) {
  if (!engineOsc) return;
  const ctx = getAudioCtx();
  const freq = 50 + Math.max(0, Math.min(1, speedRatio)) * 140;
  engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
  engineGain.gain.setTargetAtTime(audioMuted ? 0 : 0.05 + speedRatio * 0.05, ctx.currentTime, 0.08);
}
function stopEngine() {
  if (!engineOsc) return;
  const ctx = getAudioCtx();
  engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  const osc = engineOsc;
  setTimeout(() => { try { osc.stop(); } catch (e) {} }, 300);
  engineOsc = null;
  engineGain = null;
  engineFilter = null;
}
