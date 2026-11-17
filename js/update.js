function update(timestamp, dt) {
  if (dialogueOpen || awaitingName || awaitingTier || mapOpen) {
    return;
  }

  citizens.forEach(c => {
    if (c.state === 'inside' && timestamp > c.insideUntil) {
      const b = c.insideBuilding;
      b.npcs = b.npcs.filter(n => !(n.isCitizen && n.citizenRef === c));
      c.state = 'wander';
      c.insideBuilding = null;
      c.x = b.doorZone.x + b.doorZone.w / 2;
      c.y = b.doorZone.y + b.doorZone.h;
      c.path = null;
      c.nextDecision = 0;
    }
  });

  bullets = bullets.filter(b => b.scene === scene);
  bullets.forEach(b => {
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * BULLET_SPEED * dt;
    b.y += b.vy * BULLET_SPEED * dt;
  });
  bullets = bullets.filter(b => performance.now() - b.spawn < BULLET_LIFETIME_MS);

  if (scene === 'outside') {
    resolveBulletHits(citizens.filter(c => c.state !== 'inside'), 'outside');
    bullets = bullets.filter(b => {
      if (b.scene !== 'outside') return true;
      const bx = b.x - PARK.x, by = b.y - PARK.y;
      const pbx = b.prevX - PARK.x, pby = b.prevY - PARK.y;
      const hit = parkWalkers.find(w => {
        if (w.knockedDownUntil && performance.now() < w.knockedDownUntil) return false;
        return pointToSegmentDist(w.x, w.y - 20, pbx, pby - 20, bx, by - 20) < HIT_RADIUS;
      });
      if (!hit) return true;
      applyImpact(hit, b.vx, b.vy, 3.4);
      return false;
    });
    bullets = bullets.filter(b => {
      if (b.scene !== 'outside') return true;
      const hit = lakeSwimmers.find(w => {
        if (w.knockedDownUntil && performance.now() < w.knockedDownUntil) return false;
        return pointToSegmentDist(w.x, w.y - 20, b.prevX, b.prevY - 20, b.x, b.y - 20) < HIT_RADIUS;
      });
      if (!hit) return true;
      applyImpact(hit, b.vx, b.vy, 3.4);
      return false;
    });
    bullets = bullets.filter(b => {
      if (b.scene !== 'outside') return true;
      const hit = farmhands.find(w => {
        if (w.knockedDownUntil && performance.now() < w.knockedDownUntil) return false;
        return pointToSegmentDist(w.x, w.y - 20, b.prevX, b.prevY - 20, b.x, b.y - 20) < HIT_RADIUS;
      });
      if (!hit) return true;
      applyImpact(hit, b.vx, b.vy, 3.4);
      return false;
    });
  } else if (scene === 'interior') {
    resolveBulletHits(currentBuilding.npcs, 'interior');
  }

  citizens.forEach(c => applyKnockbackDecay(c, dt));
  parkWalkers.forEach(w => applyKnockbackDecay(w, dt, (px, py) =>
    px > PARK_POND.x - 12 && px < PARK_POND.x + PARK_POND.w + 12 &&
    py > PARK_POND.y - 12 && py < PARK_POND.y + PARK_POND.h + 12
  ));
  lakeSwimmers.forEach(w => applyKnockbackDecay(w, dt));
  farmhands.forEach(w => applyKnockbackDecay(w, dt));
  if (scene === 'interior' && currentBuilding) currentBuilding.npcs.forEach(n => applyKnockbackDecay(n, dt));

  citizens.forEach(c => { if (c.knockedDownUntil && timestamp > c.knockedDownUntil && !c.recovered) { c.recovered = true; c.nextDecision = 0; } });
  lakeSwimmers.forEach(w => { if (w.knockedDownUntil && timestamp > w.knockedDownUntil && !w.recovered) { w.recovered = true; w.nextDecision = 0; } });
  farmhands.forEach(w => { if (w.knockedDownUntil && timestamp > w.knockedDownUntil && !w.recovered) { w.recovered = true; w.nextDecision = 0; } });
  parkWalkers.forEach(w => { if (w.knockedDownUntil && timestamp > w.knockedDownUntil && !w.recovered) { w.recovered = true; w.nextDecision = 0; } });
  buildings.forEach(b => b.npcs.forEach(n => { if (n.knockedDownUntil && timestamp > n.knockedDownUntil && !n.recovered) { n.recovered = true; n.nextDecision = 0; } }));

  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

  // touch thumbstick (main.js): screen-relative, so in the iso view a
  // push "up" on screen is turned back into the matching world direction
  if (joystick.active && joystick.mag > 0) {
    let sx = joystick.dx, sy = joystick.dy;
    if (ISO_VIEW && scene === 'outside') { const wx = sx / 2 + sy, wy = sy - sx / 2, l = Math.hypot(wx, wy) || 1; sx = wx / l; sy = wy / l; }
    dx = sx; dy = sy;
  }
  const running = keys['shift'] || (joystick.active && joystick.run);

  player.moving = !player.sitting && !player.lying && !player.showering && (dx !== 0 || dy !== 0);
  if (player.moving) {
    if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? 'right' : 'left';
    else player.facing = dy > 0 ? 'down' : 'up';
  }

  // in the lake or the ocean, on foot, and not already in some other
  // vehicle - swimming slows you down and is the one case where the
  // water doesn't block movement
  player.swimming = scene === 'outside' && !player.onMotorcycle && !player.onCar && !player.onBoat && !player.onSurfboard &&
    (inLake(player.x + player.w / 2, player.y + player.h / 2) || inLake2(player.x + player.w / 2, player.y + player.h / 2) || inLake3(player.x + player.w / 2, player.y + player.h / 2) || inOcean(player.x + player.w / 2, player.y + player.h / 2));

  // body surfing: swimming shoreward (toward the beach) while still inside
  // the breakers catches the wave and carries you in a lot faster, on top
  // of/instead of the ambient pushback the breakers already apply
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  const inOceanBreakers = inOcean(pcx, pcy) && OCEAN_X1 - pcx > 0 && OCEAN_X1 - pcx < BREAKER_WIDTH;
  const inBreakers = player.swimming && inOceanBreakers;
  const bodySurfing = inBreakers && dx > 0;

  // catching a tall wave (X while surfboardOnBigWave() is true) pins the
  // board to that exact real wave's crest peak and rides along with it -
  // handled just after the normal movement is applied below
  const catchingWave = player.onSurfboard && player.ridingWave;
  if (catchingWave) { dx = 0; dy = 0; }

  if (player.moving && !player.onCar && !player.onMotorcycle && !player.onBoat && !player.onSurfboard && timestamp > (player.nextFootstepAt || 0)) {
    playFootstep();
    player.nextFootstepAt = timestamp + (running ? 220 : 340);
  }

  const moveSpeed = player.onCar
    ? (running ? player.carBoostSpeed : player.carSpeed)
    : player.onMotorcycle
    ? (running ? player.motoBoostSpeed : player.motoSpeed)
    : player.onBoat
    ? player.boatSpeed
    : player.onSurfboard
    ? player.surfSpeed
    : player.swimming
    ? player.speed * (bodySurfing ? 1.6 : 0.55)
    : (running ? player.runSpeed : player.speed);

  // vehicles build up to speed rather than snapping straight to it - walking,
  // swimming, and running on foot stay instant, only the car/bike/boat ramp
  if (player.onCar || player.onMotorcycle || player.onBoat) {
    if (dx !== 0 || dy !== 0) {
      player.rideSpeed = (player.rideSpeed || 0) + (moveSpeed - (player.rideSpeed || 0)) * 0.05 * dt;
    } else {
      player.rideSpeed = 0; // stopped - starts building up from zero again next time
    }
  } else {
    player.rideSpeed = 0;
  }
  const appliedSpeed = (player.onCar || player.onMotorcycle || player.onBoat) ? player.rideSpeed : moveSpeed;

  if (player.onCar || player.onMotorcycle) {
    const maxSpeed = player.onCar ? player.carBoostSpeed : player.motoBoostSpeed;
    updateEngine(player.rideSpeed / maxSpeed);
  }

  // popping into a wheelie the moment you kick into a run on the bike,
  // on top of the manual trigger from the WHEELIE button/key
  const boostingOnBike = player.onMotorcycle && running && (dx !== 0 || dy !== 0);
  if (boostingOnBike && !wasBoostingOnBike) tryWheelie();
  wasBoostingOnBike = boostingOnBike;

  if (scene === 'outside') {
    if (performance.now() > playerHitUntil) tryMoveOutside(dx * appliedSpeed * dt, dy * appliedSpeed * dt);

    // caught a real wave - pin the board to that exact hump's crest
    // peak every frame, so it rides in at exactly that wave's own pace
    // instead of some arbitrary boosted speed. The peak's position is
    // just the hump's fixed spot in the world plus however far the
    // wave's own phase has drifted since - the same formula drawOcean()
    // renders with, so the board always sits right on the real crest
    if (catchingWave) {
      const info = oceanRowWaveInfo(player.ridingRowWy, timestamp / 1000);
      const peakX = player.ridingHumpIdx * info.humpW + WAVE_PEAK_F * info.humpW + info.phase;
      player.x = peakX - player.w / 2;
      player.y = player.ridingRowWy - player.h / 2;
      player.facing = 'right';
      // the ride ends the moment the wave actually reaches the shore -
      // no fixed timer, so it always carries the board all the way in
      if (peakX >= OCEAN_X1) player.ridingWave = false;
    }

    // the breakers - swimming within BREAKER_WIDTH of the shore gets
    // shoved back toward the beach in rolling pulses, strongest right at
    // the shoreline and fading out the further you push past it; clear
    // the whole band and it's calm, push-free open water
    if (player.swimming || player.onSurfboard) {
      const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
      if (inOcean(pcx, pcy)) {
        const distFromShore = OCEAN_X1 - pcx;
        if (distFromShore > 0 && distFromShore < BREAKER_WIDTH) {
          // peak resistance is well under the player's own swim speed
          // (~0.88 at the default speed/0.55 swim multiplier) - a real
          // shove, not a wall you can never push through
          const strength = 1 - distFromShore / BREAKER_WIDTH;
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 1.4);
          player.x += pulse * strength * 0.5 * dt;
        }

        // the riptide - same idea in reverse, out at the far/open-water
        // edge, so open water reads as "as far out as you'd want to go"
        // rather than something you can swim clean across to the world edge
        const distFromWorldEdge = pcx - OCEAN_X0;
        if (distFromWorldEdge > 0 && distFromWorldEdge < RIPTIDE_WIDTH) {
          const ripStrength = 1 - distFromWorldEdge / RIPTIDE_WIDTH;
          const ripPulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 1.1);
          player.x += ripPulse * ripStrength * 0.5 * dt;
        }
      }
    }

    const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (const b of buildings) {
      if (player.facing === 'up' && rectsOverlap(playerRect, b.doorZone)) {
        enterBuilding(b);
        break;
      }
    }

    nearbyNPC = null;
    const ppx = player.x + player.w / 2;
    const ppy = player.y + player.h / 2;

    nearbyQuestSpot = null;
    QUEST_SPOTS.forEach(spot => {
      if (!questSpotVisible(spot, player)) return;
      if (Math.hypot(spot.x - ppx, spot.y - ppy) < QUEST_SPOT_RADIUS) nearbyQuestSpot = spot;
    });

    citizens.forEach(c => {
      if (c.state === 'inside') return;
      if (c.knockedDownUntil && timestamp < c.knockedDownUntil) return;

      const dist = Math.hypot(c.x - ppx, c.y - ppy);
      const isNear = dist < 42;
      if (isNear) { nearbyNPC = c; return; }

      if (!c.path && timestamp > c.nextDecision) {
        const roll = Math.random();
        let destX, destY;
        if (roll < 0.2) {
          const b = buildings[Math.floor(Math.random() * buildings.length)];
          destX = b.doorZone.x + b.doorZone.w / 2;
          destY = b.doorZone.y + b.doorZone.h;
          c.enterTarget = b;
        } else if (roll < 0.45) {
          destX = c.homeX;
          destY = c.homeY;
          c.enterTarget = null;
        } else {
          const p = randomSidewalkPoint();
          destX = p.x;
          destY = p.y;
          c.enterTarget = null;
        }
        c.path = buildSidewalkPath(c.x, c.y, destX, destY);
        c.pathIndex = 0;
        c.nextDecision = timestamp + 5000 + Math.random() * 6000;
      }

      if (c.path && c.pathIndex < c.path.length) {
        const wp = c.path[c.pathIndex];
        const cdx = wp.x - c.x, cdy = wp.y - c.y;
        const cdist = Math.hypot(cdx, cdy);
        if (cdist > 4) {
          if (Math.abs(cdx) > Math.abs(cdy)) c.facing = cdx > 0 ? 'right' : 'left';
          else c.facing = cdy > 0 ? 'down' : 'up';
          c.x += (cdx / cdist) * c.speed * dt;
          c.y += (cdy / cdist) * c.speed * dt;
        } else {
          c.pathIndex++;
          if (c.pathIndex >= c.path.length) {
            c.path = null;
            if (c.enterTarget) {
              const b = c.enterTarget;
              c.state = 'inside';
              c.insideBuilding = b;
              c.insideUntil = timestamp + 8000 + Math.random() * 14000;
              b.npcs.push({
                name: c.name, color: c.color, isCitizen: true, citizenRef: c,
                gender: c.gender, hairColor: c.hairColor, hairstyle: c.hairstyle, skinTone: c.skinTone, skirt: c.skirt, skirtColor: c.skirtColor,
                x: ROOM_W / 2, y: ROOM_H - 140, targetX: ROOM_W / 2, targetY: ROOM_H - 140, nextDecision: 0,
                knockedDownUntil: 0
              });
              c.enterTarget = null;
            } else {
              c.nextDecision = 0;
            }
          }
        }
      }
    });

    parkWalkers.forEach(w => {
      if (w.knockedDownUntil && timestamp < w.knockedDownUntil) return;

      const wx = PARK.x + w.x, wy = PARK.y + w.y;
      const dist = Math.hypot(wx - ppx, wy - ppy);
      const isNear = dist < 42;
      if (isNear) { nearbyNPC = w; return; }

      if (timestamp > w.nextDecision) {
        let tx, ty;
        do {
          tx = 40 + Math.random() * (PARK.w - 80);
          ty = 40 + Math.random() * (PARK.h - 80);
        } while (
          tx > PARK_POND.x - 20 && tx < PARK_POND.x + PARK_POND.w + 20 &&
          ty > PARK_POND.y - 20 && ty < PARK_POND.y + PARK_POND.h + 20
        );
        w.targetX = tx;
        w.targetY = ty;
        w.nextDecision = timestamp + 2000 + Math.random() * 3000;
      }
      const wdx = w.targetX - w.x, wdy = w.targetY - w.y;
      const wdist = Math.hypot(wdx, wdy);
      if (wdist > 2) {
        const margin = 12;
        // only blocks stepping IN - if something (e.g. an old knockback bug,
        // or a save from before this fix) already left a walker inside the
        // pond box, this must never prevent them from stepping back out
        const wasInPond =
          w.x > PARK_POND.x - margin && w.x < PARK_POND.x + PARK_POND.w + margin &&
          w.y > PARK_POND.y - margin && w.y < PARK_POND.y + PARK_POND.h + margin;
        const pondBlocks = (px, py) => !wasInPond &&
          px > PARK_POND.x - margin && px < PARK_POND.x + PARK_POND.w + margin &&
          py > PARK_POND.y - margin && py < PARK_POND.y + PARK_POND.h + margin;

        const stepX = (wdx / wdist) * w.speed * dt;
        const stepY = (wdy / wdist) * w.speed * dt;

        const nx = w.x + stepX;
        if (!pondBlocks(nx, w.y)) w.x = nx;

        const ny = w.y + stepY;
        if (!pondBlocks(w.x, ny)) w.y = ny;
      }
    });

    // lake swimmers - wander freely within the lake's bounds, same
    // decision-timer pattern as the park walkers, just with nowhere to
    // avoid since the whole wander area is the water
    lakeSwimmers.forEach(w => {
      if (w.knockedDownUntil && timestamp < w.knockedDownUntil) return;

      const dist = Math.hypot(w.x - ppx, w.y - ppy);
      const isNear = dist < 42;
      if (isNear) { nearbyNPC = w; return; }

      if (timestamp > w.nextDecision) {
        // rejection-sample within the lake's ellipse (not just its
        // bounding box) so swimmers never target a "dry corner" spot
        let tx, ty;
        do {
          tx = LAKE.x + 60 + Math.random() * (LAKE.w - 120);
          ty = LAKE.y + 60 + Math.random() * (LAKE.h - 120);
        } while (!inLake(tx, ty));
        w.targetX = tx;
        w.targetY = ty;
        w.nextDecision = timestamp + 2000 + Math.random() * 3000;
      }
      const wdx = w.targetX - w.x, wdy = w.targetY - w.y;
      const wdist = Math.hypot(wdx, wdy);
      if (wdist > 2) {
        w.x += (wdx / wdist) * w.speed * dt;
        w.y += (wdy / wdist) * w.speed * dt;
      }
    });

    // farmhands - wander the open fields, steering clear of the road
    // band running through the middle of the farmland
    farmhands.forEach(w => {
      if (w.knockedDownUntil && timestamp < w.knockedDownUntil) return;

      const dist = Math.hypot(w.x - ppx, w.y - ppy);
      const isNear = dist < 42;
      if (isNear) { nearbyNPC = w; return; }

      if (timestamp > w.nextDecision) {
        let tx, ty;
        do {
          tx = -1400 + Math.random() * 1300;
          ty = 560 + Math.random() * 600;
        } while (ty > WEST_ROAD_Y - 30 && ty < WEST_ROAD_Y + ROAD_W + 30);
        w.targetX = tx;
        w.targetY = ty;
        w.nextDecision = timestamp + 2000 + Math.random() * 3000;
      }
      const fdx = w.targetX - w.x, fdy = w.targetY - w.y;
      const fdist = Math.hypot(fdx, fdy);
      if (fdist > 2) {
        w.x += (fdx / fdist) * w.speed * dt;
        w.y += (fdy / fdist) * w.speed * dt;
      }
    });

    // background traffic - bouncing back and forth along their street, and
    // easing over into the correct right-hand lane for whichever direction
    // they're currently heading (so a U-turn also means a lane change).
    // Cars (and bikes) hold at a red or yellow light rather than driving
    // straight through.
    trafficCars.forEach(car => {
      const stopped = carShouldStopAtLight(car, timestamp) || carAhead(car);
      moveVehicleAlongLane(car, dt, stopped);

      // a car passing close by plays once, then cools down for a bit so it
      // doesn't spam the same whoosh every frame while idling nearby at a light
      if (!stopped && timestamp > (car.soundCooldown || 0) && Math.hypot(car.x - ppx, car.y - ppy) < 160) {
        playPassingCar();
        if (Math.random() < 0.2) playHonk();
        car.soundCooldown = timestamp + 4000;
      }
    });

    trafficBikes.forEach(bike => {
      const stopped = carShouldStopAtLight(bike, timestamp) || carAhead(bike);
      moveVehicleAlongLane(bike, dt, stopped);
    });

    // collisions with traffic: pedestrians (and the player, unless safely
    // inside their own car) get bounced and knocked flat
    const hitNow = performance.now();
    trafficCars.forEach(car => {
      const cr = trafficCarRect(car);
      const carCx = cr.x + cr.w / 2, carCy = cr.y + cr.h / 2;

      // player, when on foot or on the bike
      if (!player.onCar && hitNow > playerHitUntil) {
        const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
        if (rectsOverlap(pr, cr)) {
          const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
          applyImpact(player, pcx - carCx, pcy - carCy, 4.6);
          if (player.onMotorcycle) {
            player.onMotorcycle = false;
            motorcycleParked = { x: player.x + player.w / 2, y: player.y + player.h, facing: player.facing, color: player.motoColor };
            stopEngine();
          }
          player.money = Math.max(0, player.money - HIT_COST);
          player.finesOwed += JAYWALK_FINE;
          playerHitUntil = hitNow + 1500;
          playerHitPending = true;
        }
      }

      // wandering citizens get the same treatment as being shot: a real
      // bounce that slides to a stop, sprawled on the ground for a bit,
      // then get up and carry on
      citizens.forEach(c => {
        if (c.state === 'inside') return;
        if (c.knockedDownUntil && hitNow < c.knockedDownUntil) return;
        const ncr = { x: c.x - 8, y: c.y - 30, w: 16, h: 32 };
        if (rectsOverlap(ncr, cr)) {
          applyImpact(c, c.x - carCx, c.y - carCy, 4.2);
        }
      });
    });

    // keep the player sliding to a stop after a car impact, same as NPCs
    if (hitNow < playerHitUntil) applyKnockbackDecay(player, dt);

    // hospital wake-up after being hit
    if (playerHitPending && performance.now() > playerHitUntil) {
      playerHitPending = false;
      const hospital = buildings.find(b => b.name === 'Hospital');
      enterBuilding(hospital);
      infoEl.textContent = `You got hit by a car! -$${HIT_COST} hospital bill, and a $${JAYWALK_FINE} jaywalking ticket to pay at the Courthouse. Walk down to the door to leave.`;
    }
  } else if (scene === 'interior') {
    if (!player.sitting && !player.lying && !player.showering) tryMoveInterior(dx * moveSpeed * dt, dy * moveSpeed * dt);

    const exitZone = { x: ROOM_W/2 - 30, y: ROOM_H - WALL_THICK - 14, w: 60, h: 20 };
    const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (!player.sitting && !player.lying && !player.showering && player.facing === 'down' && rectsOverlap(playerRect, exitZone)) {
      exitBuilding();
      return;
    }

    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;

    nearbySeat = null;
    nearbyBed = null;
    nearbyShower = null;
    nearbyFixture = null;
    if (!player.sitting && !player.lying && !player.showering && timestamp > interactCooldownUntil) {
      getBuildingSeats(currentBuilding).forEach(s => {
        if (Math.hypot(s.x - px, s.y - py) < 26) nearbySeat = s;
      });
      getBuildingBeds(currentBuilding).forEach(bd => {
        // distance to the nearest point on the bed's own footprint, not
        // one fixed approach spot - lets you climb in from any side
        const nx = Math.max(bd.rect.x, Math.min(px, bd.rect.x + bd.rect.w));
        const ny = Math.max(bd.rect.y, Math.min(py, bd.rect.y + bd.rect.h));
        if (Math.hypot(nx - px, ny - py) < 26) nearbyBed = bd;
      });
      getBuildingShowers(currentBuilding).forEach(s => {
        if (Math.hypot(s.x - px, s.y - py) < 26) nearbyShower = s;
      });
    }
    if (!player.sitting && !player.lying && !player.showering) {
      getBuildingFixtures(currentBuilding).forEach(f => {
        if (Math.hypot(f.x - px, f.y - py) < 26) nearbyFixture = f;
      });
    }

    nearbyNPC = null;
    currentBuilding.npcs.forEach(n => {
      if (n.knockedDownUntil && timestamp < n.knockedDownUntil) return;

      const npcDist = Math.hypot(n.x - px, n.y - py);
      const isNear = npcDist < (n.behindBar ? 65 : 42);
      if (isNear) nearbyNPC = n;

      if (isNear) return;

      if (timestamp > n.nextDecision) {
        if (n.onStage && currentBuilding.stage) {
          const s = currentBuilding.stage;
          n.targetX = s.x + 20 + Math.random() * (s.w - 40);
          n.targetY = s.y + 20 + Math.random() * (s.h - 40);
        } else if (n.guardDoor) {
          // small patrol area right by the front door, not blocking it
          n.targetX = ROOM_W/2 - 100 + Math.random() * 60;
          n.targetY = ROOM_H - 90 + Math.random() * 30;
        } else if (n.behindBar && currentBuilding.bar) {
          const bBar = currentBuilding.bar;
          if (bBar.orientation === 'vertical') {
            // wall is to the right of a right-side counter - stand between them
            n.targetX = Math.min(ROOM_W - WALL_THICK - 6, bBar.x + bBar.w + 5) + Math.random() * 18;
            n.targetY = bBar.y + 25 + Math.random() * (bBar.h - 50);
          } else {
            n.targetX = bBar.x + 30 + Math.random() * (bBar.w - 60);
            n.targetY = Math.max(WALL_THICK + 6, bBar.y - 25) + Math.random() * 18;
          }
        } else {
          const s = currentBuilding.stage;
          let tx, ty, guard = 0;
          do {
            tx = WALL_THICK + 20 + Math.random() * (ROOM_W - WALL_THICK*2 - 40);
            ty = WALL_THICK + 20 + Math.random() * (ROOM_H - WALL_THICK*2 - 60);
            guard++;
          } while (s && tx > s.x - 15 && tx < s.x + s.w + 15 && ty > s.y - 15 && ty < s.y + s.h + 15 && guard < 20);
          n.targetX = tx;
          n.targetY = ty;
        }
        n.nextDecision = timestamp + 1500 + Math.random() * 2500;
      }
      const ndx = n.targetX - n.x;
      const ndy = n.targetY - n.y;
      const dist = Math.hypot(ndx, ndy);
      if (dist > 2) {
        const stepX = (ndx / dist) * 0.85 * dt;
        const stepY = (ndy / dist) * 0.85 * dt;
        const s = currentBuilding.stage;
        const stageBlocks = (x, y) => !n.onStage && s && x > s.x - 8 && x < s.x + s.w + 8 && y > s.y - 8 && y < s.y + s.h + 8;

        if (!stageBlocks(n.x + stepX, n.y)) n.x += stepX;
        if (!stageBlocks(n.x, n.y + stepY)) n.y += stepY;
      }
    });
  }
}
