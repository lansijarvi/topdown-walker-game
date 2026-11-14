const BLOOD_FADE_MS = 2000; // how long a blood spot takes to fade once they get back up
const KNOCKBACK_FRICTION = 0.85; // per-frame-at-60fps decay of knockback velocity

// shared "something just hit this person" handler: knocks them down, gives
// them a decaying knockback velocity in the direction of the hit (real
// bounce-and-slide instead of an instant teleport), and drops a blood spot
// that stays put while they're down and fades out after they get up
function applyImpact(entity, dirX, dirY, force) {
  const dist = Math.hypot(dirX, dirY) || 1;
  entity.kbVX = (dirX / dist) * force;
  entity.kbVY = (dirY / dist) * force;
  entity.bloodX = entity.x;
  entity.bloodY = entity.y;
  entity.knockedDownUntil = performance.now() + KNOCKDOWN_MS;
  entity.recovered = false;
  entity.path = null;
}

// call every frame for anyone who might currently be knocked down - slides
// them to a stop via friction rather than leaving them frozen mid-bounce.
// An optional `blocked(x, y)` check (e.g. the park pond) stops the slide
// from ever depositing someone in a spot they couldn't walk to on their own.
function applyKnockbackDecay(entity, dt, blocked) {
  if (!entity.kbVX && !entity.kbVY) return;
  const nx = Math.max(WORLD_LEFT, Math.min(WORLD_W, entity.x + entity.kbVX * dt));
  const ny = Math.max(WORLD_TOP, Math.min(WORLD_H, entity.y + entity.kbVY * dt));
  if (!blocked || !blocked(nx, entity.y)) entity.x = nx;
  if (!blocked || !blocked(entity.x, ny)) entity.y = ny;
  const decay = Math.pow(KNOCKBACK_FRICTION, dt);
  entity.kbVX *= decay;
  entity.kbVY *= decay;
  if (Math.abs(entity.kbVX) < 0.05) entity.kbVX = 0;
  if (Math.abs(entity.kbVY) < 0.05) entity.kbVY = 0;
}

// draws a fading red blood spot at a hit location - present while the
// person is down, fading out over BLOOD_FADE_MS after they get back up
function drawBloodSpot(entity, camX, camY) {
  if (entity.bloodX === undefined || !entity.knockedDownUntil) return;
  const now = performance.now();
  const sinceUp = now - entity.knockedDownUntil;
  if (sinceUp > BLOOD_FADE_MS) return;
  const alpha = sinceUp < 0 ? 0.6 : 0.6 * (1 - sinceUp / BLOOD_FADE_MS);
  if (alpha <= 0) return;
  const sx = entity.bloodX - camX, sy = entity.bloodY - camY;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#7a1010';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sx - 7, sy + 3, 4, 2.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sx + 6, sy - 2, 3, 2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function resolveBulletHits(npcList, sceneName) {
  bullets = bullets.filter(b => {
    if (b.scene !== sceneName) return true;
    const hitIdx = npcList.findIndex(n => {
      if (!n) return false;
      if (n.knockedDownUntil && performance.now() < n.knockedDownUntil) return false;
      return pointToSegmentDist(n.x, n.y - 20, b.prevX, b.prevY - 20, b.x, b.y - 20) < HIT_RADIUS;
    });
    if (hitIdx === -1) return true;
    const n = npcList[hitIdx];
    applyImpact(n, b.vx, b.vy, 3.4);
    // Ronnie's confrontation only resolves via the gun, never dialogue -
    // and only once the stripper arc has actually reached him and the
    // marked deck (his cheating evidence) has been dealt with
    if (n.name === 'Ronnie' && questComplete(player, 'stripperDye') && questComplete(player, 'casinoMarkedDeck') && !questComplete(player, 'stripperPimp')) {
      setQuest(player, 'stripperPimp', 'complete');
      player.wanted += 2;
      showFlavorMessage("This ain't over - okay, it's over, it's completely over, please don't shoot me again.");
    }
    return false;
  });
}
