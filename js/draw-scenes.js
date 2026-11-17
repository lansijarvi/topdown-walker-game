function drawOutside() {
  const { camX, camY } = getCamera();
  const nightFactor = getNightFactor(performance.now());

  // textured ground per region (see visuals.js)
  drawGroundLayer(camX, camY);

  // paths/trails are drawn before any road that might cross them, so the
  // road paints over the crossing instead of the thin path cutting
  // visibly across the dirt - the lake itself still covers the submerged
  // stretch of the lake paths afterward, further down
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
  drawDecor(camX, camY);

  const currentPhase = getLightPhase(performance.now());
  TRAFFIC_LIGHTS.forEach(light => {
    drawTrafficLight(light.x, light.y, currentPhase[light.axis], camX, camY);
  });

  STREET_LAMPS.forEach(lamp => {
    drawStreetLamp(lamp.x, lamp.y, camX, camY, nightFactor);
  });

  const drawables = [
    ...buildings.map(b => ({ type: 'building', obj: b, sortY: b.y + b.h })),
    ...citizens.filter(c => c.state !== 'inside').map(c => ({ type: 'citizen', obj: c, sortY: c.y })),
    ...PARK_TREES.map(t => ({ type: 'tree', obj: t, sortY: PARK.y + t.y })),
    ...CITY_TREES.map(t => ({ type: 'citytree', obj: t, sortY: t.y })),
    ...FOREST_TREES.map(t => ({ type: 'citytree', obj: t, sortY: t.y })),
    ...WEST_FOREST_TREES.map(t => ({ type: 'citytree', obj: t, sortY: t.y })),
    ...LIFEGUARD_STANDS.map(s => ({ type: 'lifeguard', obj: s, sortY: s.y })),
    ...QUEST_SPOTS.filter(s => questSpotVisible(s, player)).map(s => ({ type: 'questspot', obj: s, sortY: s.y })),
    ...parkWalkers.map(w => ({ type: 'parkwalker', obj: w, sortY: PARK.y + w.y })),
    ...(motorcycleParked ? [{ type: 'parkedmoto', obj: motorcycleParked, sortY: motorcycleParked.y }] : []),
    ...(!player.hasMotorcycle ? [{ type: 'parkedmoto', obj: MOTO_SHOWROOM_SPOT, sortY: MOTO_SHOWROOM_SPOT.y }] : []),
    ...(carParked ? [{ type: 'parkedcar', obj: carParked, sortY: carParked.y }] : []),
    ...(!player.hasCar ? [{ type: 'parkedcar', obj: CAR_SHOWROOM_SPOT, sortY: CAR_SHOWROOM_SPOT.y }] : []),
    ...(boatParked ? [{ type: 'parkedboat', obj: boatParked, sortY: boatParked.y }] : []),
    ...(surfboardParked ? [{ type: 'parkedsurfboard', obj: surfboardParked, sortY: surfboardParked.y }] : []),
    ...trafficCars.map(car => ({ type: 'trafficcar', obj: car, sortY: car.y })),
    ...trafficBikes.map(bike => ({ type: 'trafficbike', obj: bike, sortY: bike.y })),
    ...lakeSwimmers.map(w => ({ type: 'lakeswimmer', obj: w, sortY: w.y })),
    ...farmhands.map(w => ({ type: 'farmhand', obj: w, sortY: w.y })),
    { type: 'player', sortY: player.y + player.h }
  ];
  drawables.sort((a, b) => a.sortY - b.sortY);

  drawables.forEach(d => {
    if (d.type === 'building') {
      drawBuildingExterior(d.obj, camX, camY, nightFactor, isPlayerBehindBuilding(d.obj));
    } else if (d.type === 'citizen') {
      const c = d.obj;
      const isDown = c.knockedDownUntil && performance.now() < c.knockedDownUntil;
      drawBloodSpot(c, camX, camY);
      drawDude(c.x - camX, c.y - camY, c.color, null, { facing: c.facing, gender: c.gender, hairColor: c.hairColor, hairstyle: c.hairstyle, skinTone: c.skinTone, skirt: c.skirt, skirtColor: c.skirtColor, dirty: c.dirty, knockedDown: isDown, moving: !!c.path });
    } else if (d.type === 'tree') {
      drawTree(PARK.x + d.obj.x, PARK.y + d.obj.y, camX, camY);
    } else if (d.type === 'citytree') {
      const t = d.obj;
      if (t.pine) drawPineTree(t.x, t.y, camX, camY, t.scale);
      else drawTree(t.x, t.y, camX, camY, t.scale);
    } else if (d.type === 'lifeguard') {
      drawLifeguardStand(d.obj.x, d.obj.y, camX, camY);
    } else if (d.type === 'questspot') {
      drawQuestSpot(d.obj, camX, camY);
    } else if (d.type === 'parkwalker') {
      const w = d.obj;
      const isDown = w.knockedDownUntil && performance.now() < w.knockedDownUntil;
      drawBloodSpot(w, camX - PARK.x, camY - PARK.y);
      drawDude(PARK.x + w.x - camX, PARK.y + w.y - camY, w.color, null, { gender: w.gender, hairColor: w.hairColor, hairstyle: w.hairstyle, skinTone: w.skinTone, skirt: w.skirt, skirtColor: w.skirtColor, knockedDown: isDown, moving: Math.hypot(w.targetX - w.x, w.targetY - w.y) > 2 });
    } else if (d.type === 'parkedmoto') {
      drawMotorcycle(d.obj.x - camX, d.obj.y - camY, d.obj.facing, d.obj.color);
    } else if (d.type === 'parkedcar') {
      drawCar(d.obj.x - camX, d.obj.y - camY, d.obj.facing, d.obj.color, false, nightFactor);
    } else if (d.type === 'parkedboat') {
      drawPaddleboard(d.obj.x - camX, d.obj.y - camY, d.obj.facing, player.boatColor);
    } else if (d.type === 'parkedsurfboard') {
      drawSurfboard(d.obj.x - camX, d.obj.y - camY, d.obj.facing, player.surfboardColor);
    } else if (d.type === 'lakeswimmer') {
      const w = d.obj;
      const isDown = w.knockedDownUntil && performance.now() < w.knockedDownUntil;
      drawBloodSpot(w, camX, camY);
      drawDude(w.x - camX, w.y - camY, w.color, null, { gender: w.gender, hairColor: w.hairColor, hairstyle: w.hairstyle, skinTone: w.skinTone, skirt: w.skirt, skirtColor: w.skirtColor, knockedDown: isDown, swimming: !isDown, moving: Math.hypot(w.targetX - w.x, w.targetY - w.y) > 2 });
    } else if (d.type === 'farmhand') {
      const w = d.obj;
      const isDown = w.knockedDownUntil && performance.now() < w.knockedDownUntil;
      drawBloodSpot(w, camX, camY);
      drawDude(w.x - camX, w.y - camY, w.color, null, { gender: w.gender, hairColor: w.hairColor, hairstyle: w.hairstyle, skinTone: w.skinTone, skirt: w.skirt, skirtColor: w.skirtColor, knockedDown: isDown, moving: Math.hypot(w.targetX - w.x, w.targetY - w.y) > 2 });
    } else if (d.type === 'trafficcar') {
      const car = d.obj;
      const facing = car.axis === 'h' ? (car.dir > 0 ? 'right' : 'left') : (car.dir > 0 ? 'down' : 'up');
      drawCar(car.x - camX, car.y - camY, facing, car.color, car.police, nightFactor);
    } else if (d.type === 'trafficbike') {
      const bike = d.obj;
      const facing = bike.axis === 'h' ? (bike.dir > 0 ? 'right' : 'left') : (bike.dir > 0 ? 'down' : 'up');
      const bx = bike.x - camX, by = bike.y - camY;
      drawMotorcycle(bx, by, facing, bike.color, true);
      const r = bike.rider;
      drawDude(bx, by, r.color, null, { facing, gender: r.gender, hairColor: r.hairColor, hairstyle: r.hairstyle, skinTone: r.skinTone, riding: true });
    } else {
      const px = player.x + player.w / 2 - camX;
      const py = player.y + player.h - camY;
      if (player.onCar) {
        drawCar(px, py, player.facing, player.carColor, false, nightFactor);
      } else if (player.onBoat) {
        drawPaddleboard(px, py, player.facing, player.boatColor);
        drawBloodSpot(player, camX, camY);
        drawDude(px, py, '#3a6fd8', null, { facing: player.facing, gender: player.gender, hairColor: player.hairColor, hairstyle: player.hairstyle, skinTone: player.skinTone, gunEquipped: player.gunEquipped, knockedDown: performance.now() < playerHitUntil, moving: false });
      } else if (player.onSurfboard) {
        // caught a wave: the board is pinned (in update()) to the exact
        // peak of a real tall wave drawOcean() is already rendering right
        // there, so lifting the rider up by that same crest's real height
        // puts them visibly standing on top of the actual wave itself,
        // not a separate shape drawn underneath them
        // envelope based on how far along the ride is (by distance
        // covered, not a fixed timer) so it always eases in at the catch
        // and back out right as it reaches shore, however long that takes
        const distLeft = OCEAN_X1 - (player.x + player.w / 2);
        const rideProgress = player.ridingWave ? 1 - Math.min(1, Math.max(0, distLeft / player.ridingStartDist)) : 0;
        const waveLift = player.ridingWave ? Math.sin(rideProgress * Math.PI) : 0;
        const crestHeight = 22 * WAVE_TALL_MULT; // matches the front wave layer's tall-hump amplitude
        drawBloodSpot(player, camX, camY);
        if (waveLift > 0) {
          ctx.save();
          ctx.translate(px, py);
          ctx.translate(0, -crestHeight * waveLift);
          ctx.scale(1 + waveLift * 0.15, 1 + waveLift * 0.15);
          ctx.translate(-px, -py);
          drawSurfSpray(px, py, player.facing, waveLift);
        }
        drawSurfboard(px, py, player.facing, player.surfboardColor);
        drawDude(px, py, '#3a6fd8', null, { facing: player.facing, gender: player.gender, hairColor: player.hairColor, hairstyle: player.hairstyle, skinTone: player.skinTone, gunEquipped: player.gunEquipped, knockedDown: performance.now() < playerHitUntil, moving: false });
        if (waveLift > 0) ctx.restore();
      } else {
        // ramp jump: the bike+rider group hops up and grows slightly
        // (bigger = closer to camera = airborne) while a real shadow stays
        // pinned to the ground and shrinks - that separation between bike
        // and shadow is what actually reads as "in the air". Even without
        // a real jump triggered, just riding across a ramp's slope gives
        // the same treatment at a much smaller scale, so the bike visibly
        // dips up and back down following the ground under it
        const jumpLeft = player.jumpUntil - performance.now();
        const isJumping = player.onMotorcycle && jumpLeft > 0;
        const terrainLift = (player.onMotorcycle && !isJumping)
          ? rampGroundLift(player.x + player.w / 2, player.y + player.h / 2)
          : 0;
        let jLift = 0;
        if (isJumping) {
          const jProgress = 1 - jumpLeft / player.jumpTotalMs;
          jLift = Math.sin(jProgress * Math.PI) * player.jumpHeightMult;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(px, py + 4, 22 * Math.max(0.3, 1 - jLift * 0.5), 8 * Math.max(0.3, 1 - jLift * 0.5), 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (terrainLift > 0) {
          jLift = terrainLift * 0.4;
        }
        drawBloodSpot(player, camX, camY);
        if (jLift > 0) {
          ctx.save();
          ctx.translate(px, py);
          ctx.translate(0, -jLift * 34);
          ctx.scale(1 + jLift * 0.22, 1 + jLift * 0.22);
          ctx.translate(-px, -py);
        }

        // wheelie: tilt the bike+rider back around the rear wheel, front
        // end lifting up then settling back down over the duration
        const wheelieLeft = player.wheelieUntil - performance.now();
        const doingWheelie = player.onMotorcycle && wheelieLeft > 0 && (player.facing === 'left' || player.facing === 'right');
        if (doingWheelie) {
          const progress = 1 - wheelieLeft / WHEELIE_DURATION;
          const dir = player.facing === 'right' ? 1 : -1;
          const lift = Math.sin(progress * Math.PI) * 0.4;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(-dir * lift);
          ctx.translate(-px, -py);
        }
        if (player.onMotorcycle) drawMotorcycle(px, py, player.facing, player.motoColor, true, isJumping);
        drawDude(px, py, '#3a6fd8', null, { facing: player.facing, gender: player.gender, hairColor: player.hairColor, hairstyle: player.hairstyle, skinTone: player.skinTone, gunEquipped: player.gunEquipped, muzzleFlash: performance.now() < muzzleFlashUntil, riding: player.onMotorcycle, knockedDown: performance.now() < playerHitUntil, swimming: player.swimming, moving: player.moving });
        if (doingWheelie) ctx.restore();
        if (jLift > 0) ctx.restore();
      }
    }
  });

  bullets.forEach(b => {
    if (b.scene !== 'outside') return;
    ctx.save();
    ctx.translate(b.x - camX, b.y - camY);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  drawCloudShadows(camX, camY, nightFactor);
  drawNightLighting(camX, camY, nightFactor);

  // gentle vignette - gives the scene a bit of depth/focus instead of
  // reading as a flat, evenly-lit sheet all the way to the screen edges
  const vignette = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height) * 0.7
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRideHints();
  drawDialogueUI();
}

// "[M] to ride" style prompts when standing next to a parked vehicle
function drawRideHints() {
  if (document.body.classList.contains('touch')) return; // the touch buttons carry their own labels
  if (motorcycleParked && !player.onMotorcycle) {
    const mdist = Math.hypot(
      (player.x + player.w / 2) - motorcycleParked.x,
      (player.y + player.h / 2) - motorcycleParked.y
    );
    if (mdist < MOUNT_RADIUS) {
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      const hint = '[F] to ride';
      const hw = ctx.measureText(hint).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(canvas.width/2 - hw/2 - 8, canvas.height - 40, hw + 16, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, canvas.width/2, canvas.height - 23);
    }
  }

  if (carParked && !player.onCar) {
    const cdist = Math.hypot(
      (player.x + player.w / 2) - carParked.x,
      (player.y + player.h / 2) - carParked.y
    );
    if (cdist < MOUNT_RADIUS) {
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      const hint = '[F] to drive';
      const hw = ctx.measureText(hint).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(canvas.width/2 - hw/2 - 8, canvas.height - 40, hw + 16, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, canvas.width/2, canvas.height - 23);
    }
  }

  if (boatParked && !player.onBoat) {
    const bdist = Math.hypot(
      (player.x + player.w / 2) - boatParked.x,
      (player.y + player.h / 2) - boatParked.y
    );
    if (bdist < MOUNT_RADIUS) {
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      const hint = '[F] to hop on paddleboard';
      const hw = ctx.measureText(hint).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(canvas.width/2 - hw/2 - 8, canvas.height - 40, hw + 16, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, canvas.width/2, canvas.height - 23);
    }
  }

  if (surfboardParked && !player.onSurfboard) {
    const sdist = Math.hypot(
      (player.x + player.w / 2) - surfboardParked.x,
      (player.y + player.h / 2) - surfboardParked.y
    );
    if (sdist < MOUNT_RADIUS) {
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      const hint = '[F] to grab surfboard';
      const hw = ctx.measureText(hint).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(canvas.width/2 - hw/2 - 8, canvas.height - 40, hw + 16, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, canvas.width/2, canvas.height - 23);
    }
  }
}

function drawTable(rx, ry, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(rx + t.x + t.w / 2, ry + t.y + t.h + 4, t.w / 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(rx + t.x, ry + t.y, t.w, t.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + t.x, ry + t.y, t.w, t.h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(rx + t.x, ry + t.y, t.w, 5);
}

function drawChair(rx, ry, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(rx + s.x, ry + s.y + 3, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3a20';
  ctx.beginPath();
  ctx.arc(rx + s.x, ry + s.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCouch(rx, ry, c) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(rx + c.x, ry + c.y + c.h, c.w, 5);
  const grad = ctx.createLinearGradient(0, ry + c.y, 0, ry + c.y + c.h);
  grad.addColorStop(0, shadeColor('#7a3f5f', 20));
  grad.addColorStop(1, shadeColor('#7a3f5f', -20));
  ctx.fillStyle = grad;
  ctx.fillRect(rx + c.x, ry + c.y, c.w, c.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + c.x, ry + c.y, c.w, c.h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(rx + c.x, ry + c.y, c.w, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(rx + c.x, ry + c.y + 6, c.w, 6);
  // cushion divider
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx + c.x + c.w / 2, ry + c.y + 12);
  ctx.lineTo(rx + c.x + c.w / 2, ry + c.y + c.h);
  ctx.stroke();
}

// pillow sits against whichever edge is the headboard - the short edge
// for a portrait bed (head at the top), or the left edge for a landscape
// one (headboard against a side wall), matching however wide vs tall
// this particular bed happens to be
function drawBed(rx, ry, b) {
  const landscape = b.w > b.h;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(rx + b.x, ry + b.y + b.h, b.w, 5);
  ctx.fillStyle = '#5a4a3a'; // frame
  ctx.fillRect(rx + b.x, ry + b.y, b.w, b.h);
  if (landscape) {
    const grad = ctx.createLinearGradient(rx + b.x, 0, rx + b.x + b.w, 0);
    grad.addColorStop(0, shadeColor('#3a5a7a', 14));
    grad.addColorStop(1, shadeColor('#3a5a7a', -14));
    ctx.fillStyle = grad; // blanket
    ctx.fillRect(rx + b.x + 22, ry + b.y + 4, b.w - 26, b.h - 8);
    ctx.fillStyle = '#e8e0d0'; // pillow, against the headboard on the left
    ctx.fillRect(rx + b.x + 6, ry + b.y + 8, 16, b.h - 16);
  } else {
    const grad = ctx.createLinearGradient(0, ry + b.y, 0, ry + b.y + b.h);
    grad.addColorStop(0, shadeColor('#3a5a7a', 14));
    grad.addColorStop(1, shadeColor('#3a5a7a', -14));
    ctx.fillStyle = grad; // blanket
    ctx.fillRect(rx + b.x + 4, ry + b.y + 22, b.w - 8, b.h - 26);
    ctx.fillStyle = '#e8e0d0'; // pillow, against the headboard at the top
    ctx.fillRect(rx + b.x + 8, ry + b.y + 6, b.w - 16, 16);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + b.x, ry + b.y, b.w, b.h);
}

function drawBarstool(rx, ry, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(rx + s.x, ry + s.y + 4, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#707070'; // footrest ring
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(rx + s.x, ry + s.y + 2, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#3a3a3a'; // round seat
  ctx.beginPath();
  ctx.arc(rx + s.x, ry + s.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(rx + s.x - 2, ry + s.y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSink(rx, ry, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(rx + r.x, ry + r.y + r.h, r.w, 4);
  ctx.fillStyle = '#c8ccd0';
  ctx.fillRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.fillStyle = '#8a949e';
  ctx.fillRect(rx + r.x + 6, ry + r.y + 6, r.w - 12, r.h - 14);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.fillStyle = '#a0a8b0'; // faucet
  ctx.fillRect(rx + r.x + r.w / 2 - 2, ry + r.y - 8, 4, 10);
}

// tank against the wall on the left, bowl extending right - matches a
// toilet mounted on a side wall with the open side facing into the room
function drawToilet(rx, ry, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(rx + r.x + r.w + 3, ry + r.y + r.h / 2, 4, r.w / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(rx + r.x, ry + r.y + r.h * 0.15, r.w * 0.4, r.h * 0.7); // tank
  ctx.fillRect(rx + r.x + r.w * 0.3, ry + r.y, r.w * 0.7, r.h); // bowl
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx + r.x + r.w * 0.3, ry + r.y, r.w * 0.7, r.h);
  ctx.beginPath();
  ctx.ellipse(rx + r.x + r.w * 0.68, ry + r.y + r.h / 2, r.w * 0.28, r.h * 0.32, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
}

function drawShower(rx, ry, r, active) {
  ctx.fillStyle = 'rgba(140,180,200,0.18)';
  ctx.fillRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.strokeStyle = '#9ab8c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + r.x, ry + r.y, r.w, r.h);
  // angled glass partition, corner to corner - the classic quadrant shower
  // door look, purely decorative
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rx + r.x + r.w * 0.35, ry + r.y);
  ctx.lineTo(rx + r.x, ry + r.y + r.h * 0.85);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  [0.35, 0.65].forEach(t => {
    ctx.beginPath();
    ctx.arc(rx + r.x + r.w * 0.35 * (1 - t), ry + r.y + r.h * 0.85 * t, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#c8ccd0'; // showerhead
  ctx.fillRect(rx + r.x + r.w / 2 - 7, ry + r.y + 4, 14, 5);
  ctx.strokeStyle = active ? 'rgba(200,235,255,0.7)' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = active ? 2 : 1;
  // when running, extra water streaks plus a puddle at the base - purely a
  // visual treat for "standing under the water", no gameplay effect
  const streakCount = active ? 5 : 3;
  const streakTop = active ? (performance.now() / 80) % 8 : 0;
  for (let i = 0; i < streakCount; i++) {
    const sx = r.x + r.w / 2 - (streakCount - 1) * 2 + i * 4;
    ctx.beginPath();
    ctx.moveTo(rx + sx, ry + r.y + 10 + streakTop);
    ctx.lineTo(rx + sx, ry + r.y + r.h - 10);
    ctx.stroke();
  }
  if (active) {
    ctx.fillStyle = 'rgba(200,235,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(rx + r.x + r.w / 2, ry + r.y + r.h - 6, r.w / 2 - 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBathroomWalls(rx, ry) {
  ctx.fillStyle = '#000';
  getBathroomWallObstacles().forEach(w => {
    ctx.fillRect(rx + w.x, ry + w.y, w.w, w.h);
  });
}

function drawStove(rx, ry, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(rx + r.x, ry + r.y + r.h, r.w, 4);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.fillStyle = '#555';
  [[0.28, 0.32], [0.72, 0.32], [0.28, 0.72], [0.72, 0.72]].forEach(([fx, fy]) => {
    ctx.beginPath();
    ctx.arc(rx + r.x + r.w * fx, ry + r.y + r.h * fy, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFridge(rx, ry, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(rx + r.x, ry + r.y + r.h, r.w, 4);
  ctx.fillStyle = '#d8dce0';
  ctx.fillRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(rx + r.x, ry + r.y + r.h * 0.4);
  ctx.lineTo(rx + r.x + r.w, ry + r.y + r.h * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#a0a8b0'; // handle
  ctx.fillRect(rx + r.x + r.w - 6, ry + r.y + 6, 3, r.h * 0.3);
}

function drawWasher(rx, ry, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(rx + r.x, ry + r.y + r.h, r.w, 4);
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + r.x, ry + r.y, r.w, r.h);
  const cx = rx + r.x + r.w / 2, cy = ry + r.y + r.h * 0.55, rad = Math.min(r.w, r.h) * 0.32;
  ctx.fillStyle = '#2a2a2a'; // door
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,180,210,0.5)'; // drum window
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8f8f5f'; // control knob
  ctx.beginPath();
  ctx.arc(rx + r.x + r.w * 0.2, ry + r.y + r.h * 0.15, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDryer(rx, ry, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(rx + r.x, ry + r.y + r.h, r.w, 4);
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(rx + r.x, ry + r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + r.x, ry + r.y, r.w, r.h);
  const cx = rx + r.x + r.w / 2, cy = ry + r.y + r.h * 0.55, rad = Math.min(r.w, r.h) * 0.32;
  ctx.fillStyle = '#2a2a2a'; // door
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(210,170,120,0.5)'; // drum window (warm tint vs washer's cool tint)
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8f8f5f'; // control knob
  ctx.beginPath();
  ctx.arc(rx + r.x + r.w * 0.2, ry + r.y + r.h * 0.15, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBookshelf(rx, ry, b) {
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(rx + b.x, ry + b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + b.x, ry + b.y, b.w, b.h);
  const bookColors = ['#c25f5f', '#5f8fc2', '#8fc25f', '#c2905f', '#9a5fc2'];
  const rowH = (b.h - 16) / 3;
  for (let row = 0; row < 3; row++) {
    const sy = b.y + 8 + row * rowH;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(rx + b.x, ry + sy + rowH);
    ctx.lineTo(rx + b.x + b.w, ry + sy + rowH);
    ctx.stroke();
    let bx = b.x + 3;
    let i = 0;
    while (bx < b.x + b.w - 3) {
      const bw = 3 + hashNoise(bx, sy + row) * 3;
      ctx.fillStyle = bookColors[i % bookColors.length];
      ctx.fillRect(rx + bx, ry + sy + 2, bw, rowH - 4);
      bx += bw + 1;
      i++;
    }
  }
}

// fills a rug-shaped rect with a color and one of a few simple patterns -
// shared by the actual rendered rug and the pattern-picker's swatches
function drawRugFill(x, y, w, h, color, pattern) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (pattern === 'stripes') {
    ctx.fillStyle = shadeColor(color, -25);
    const stripeW = Math.max(4, w / 8);
    for (let sx = 0; sx < w; sx += stripeW * 2) {
      ctx.fillRect(x + sx, y, Math.min(stripeW, w - sx), h);
    }
  } else if (pattern === 'diamond') {
    ctx.strokeStyle = shadeColor(color, 35);
    ctx.lineWidth = Math.max(1, w / 60);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(x + w - 2, cy);
    ctx.lineTo(cx, y + h - 2);
    ctx.lineTo(x + 2, cy);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawRug(rx, ry, r, color, pattern) {
  drawRugFill(rx + r.x, ry + r.y, r.w, r.h, color, pattern);
  ctx.strokeStyle = '#c2a05f';
  ctx.lineWidth = 3;
  ctx.strokeRect(rx + r.x + 6, ry + r.y + 6, r.w - 12, r.h - 12);
}

// palette overlay while rearranging the rug - a dashed outline around it
// plus color/pattern swatches, drawn in screen space over the room
function drawFurnitureEditorUI(rx, ry) {
  if (!furnitureEditorOpen) return;
  const r = currentRugRect();
  ctx.save();
  ctx.strokeStyle = draggingRug ? 'rgba(255,255,0,0.9)' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(rx + r.x - 3, ry + r.y - 3, r.w + 6, r.h + 6);
  ctx.restore();

  const { colorSwatches, patternSwatches } = getRugPaletteLayout();
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('Rug color', colorSwatches[0].x, colorSwatches[0].y - 6);
  ctx.fillText('Pattern', patternSwatches[0].x, patternSwatches[0].y - 6);

  colorSwatches.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = s.color === player.rugColor ? '#ffd27f' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = s.color === player.rugColor ? 3 : 1;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  });
  patternSwatches.forEach(s => {
    drawRugFill(s.x, s.y, s.w, s.h, player.rugColor, s.pattern);
    ctx.strokeStyle = s.pattern === player.rugPattern ? '#ffd27f' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = s.pattern === player.rugPattern ? 3 : 1;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  });
}

function drawInterior() {
  const camX = (ROOM_W - canvas.width) / 2;
  const camY = (ROOM_H - canvas.height) / 2;

  const rx = -camX, ry = -camY;

  // walls, floor, back wall decor, doorway (see visuals.js)
  drawInteriorShell(rx, ry, currentBuilding);

  if (currentBuilding.stage) {
    const s = currentBuilding.stage;
    // raised stage platform
    ctx.fillStyle = '#4a2f4a';
    ctx.fillRect(rx + s.x, ry + s.y, s.w, s.h);
    ctx.strokeStyle = '#ffd27f';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx + s.x, ry + s.y, s.w, s.h);
    // string lights along the front edge
    ctx.fillStyle = '#ffe066';
    for (let lx = s.x + 6; lx < s.x + s.w - 6; lx += 14) {
      ctx.beginPath();
      ctx.arc(rx + lx, ry + s.y + s.h, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // pole, running floor to ceiling in the middle of the stage
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(rx + s.poleX, ry + s.poleY + 4, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(rx + s.poleX - 3, ry + s.y - 10, 6, s.h + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(rx + s.poleX - 1, ry + s.y - 10, 2, s.h + 10);
  }

  if (currentBuilding.bar) {
    const bBar = currentBuilding.bar;
    // wooden counter
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(rx + bBar.x, ry + bBar.y, bBar.w, bBar.h);
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx + bBar.x, ry + bBar.y, bBar.w, bBar.h);

    if (bBar.orientation === 'vertical') {
      // top edge highlight along the customer-facing (left) side
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(rx + bBar.x, ry + bBar.y, 5, bBar.h);
      // shelf of bottles against the wall, to the right of the counter
      ctx.fillStyle = '#3a2a15';
      ctx.fillRect(rx + bBar.x + bBar.w, ry + bBar.y + 10, 10, bBar.h - 20);
      ctx.fillStyle = '#7fc2e0';
      for (let by = bBar.y + 20; by < bBar.y + bBar.h - 20; by += 18) {
        ctx.fillRect(rx + bBar.x + bBar.w + 1, ry + by, 9, 5);
      }
    } else {
      // top edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(rx + bBar.x, ry + bBar.y, bBar.w, 5);
      // shelf of bottles along the back wall
      ctx.fillStyle = '#3a2a15';
      ctx.fillRect(rx + bBar.x + 10, ry + bBar.y - 16, bBar.w - 20, 10);
      ctx.fillStyle = '#7fc2e0';
      for (let bx = bBar.x + 20; bx < bBar.x + bBar.w - 20; bx += 18) {
        ctx.fillRect(rx + bx, ry + bBar.y - 15, 5, 9);
      }
    }
  }

  if (currentBuilding.name === 'Home' && player.homeFurniture.includes('rug')) {
    drawRug(rx, ry, currentRugRect(), player.rugColor, player.rugPattern);
  }
  (currentBuilding.tables || []).forEach(t => drawTable(rx, ry, t));
  (currentBuilding.bedRects || []).forEach(b => drawBed(rx, ry, b));
  if (hasBathroom(currentBuilding)) {
    drawBathroomWalls(rx, ry);
    drawSink(rx, ry, BATHROOM_FIXTURES.sink);
    drawToilet(rx, ry, BATHROOM_FIXTURES.toilet);
    drawShower(rx, ry, BATHROOM_FIXTURES.shower, player.showering);
  }
  if (hasKitchen(currentBuilding)) {
    drawFridge(rx, ry, KITCHEN_FIXTURES.fridge);
    drawStove(rx, ry, KITCHEN_FIXTURES.stove);
    drawSink(rx, ry, KITCHEN_FIXTURES.kitchenSink);
  }
  if (hasLaundry(currentBuilding)) {
    drawWasher(rx, ry, LAUNDRY_FIXTURES.washer);
    drawDryer(rx, ry, LAUNDRY_FIXTURES.dryer);
  }
  if (currentBuilding.name === 'Home') {
    if (player.homeFurniture.includes('bookshelf')) drawBookshelf(rx, ry, HOME_FURNITURE_LAYOUT.bookshelf);
    if (player.homeFurniture.includes('couch')) drawCouch(rx, ry, HOME_FURNITURE_LAYOUT.couch);
    if (player.homeFurniture.includes('bed')) drawBed(rx, ry, HOME_FURNITURE_LAYOUT.bed);
    if (player.homeFurniture.includes('barstools')) HOME_FURNITURE_LAYOUT.barstools.forEach(s => drawBarstool(rx, ry, s));
  }
  // only draw chair icons for actual chairs (table seats) - the couch's
  // own seats are already part of its drawn shape above
  (currentBuilding.seats || []).forEach(s => drawChair(rx, ry, s));

  // (room name now sits on a plaque on the back wall - drawInteriorShell)
  drawInteriorDecor(rx, ry, currentBuilding);

  const drawables = [
    ...(currentBuilding.displayBikes || []).map(bk => ({ type: 'displaybike', obj: bk, sortY: bk.y })),
    ...currentBuilding.npcs.map(n => ({ type: 'npc', obj: n, sortY: n.y })),
    { type: 'player', sortY: player.y + player.h }
  ];
  drawables.sort((a, b) => a.sortY - b.sortY);

  drawables.forEach(d => {
    if (d.type === 'npc') {
      const isDown = d.obj.knockedDownUntil && performance.now() < d.obj.knockedDownUntil;
      drawBloodSpot(d.obj, -rx, -ry);
      drawDude(rx + d.obj.x, ry + d.obj.y, d.obj.color, d.obj.name, { gender: d.obj.gender, hairColor: d.obj.hairColor, hairstyle: d.obj.hairstyle, skinTone: d.obj.skinTone, kid: d.obj.isKid, big: d.obj.big, skirt: d.obj.skirt, skirtColor: d.obj.skirtColor, bikini: d.obj.bikini, bikiniColor: d.obj.bikiniColor, dirty: d.obj.dirty, knockedDown: isDown, moving: Math.hypot(d.obj.targetX - d.obj.x, d.obj.targetY - d.obj.y) > 2 });
      if (!isDown && npcHasQuestPing(d.obj, player)) drawQuestPing(rx + d.obj.x, ry + d.obj.y - 42);
    } else if (d.type === 'displaybike') {
      drawMotorcycle(rx + d.obj.x, ry + d.obj.y, d.obj.facing, d.obj.color);
    } else {
      drawDude(rx + player.x + player.w/2, ry + player.y + player.h, '#3a6fd8', null, { facing: player.facing, gender: player.gender, hairColor: player.hairColor, hairstyle: player.hairstyle, skinTone: player.skinTone, gunEquipped: player.gunEquipped, muzzleFlash: performance.now() < muzzleFlashUntil, moving: player.moving, lying: player.lying, lieAngle: player.lieAngle, sitting: player.sitting });
    }
  });

  bullets.forEach(b => {
    if (b.scene !== 'interior') return;
    ctx.save();
    ctx.translate(rx + b.x, ry + b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  drawFurnitureEditorUI(rx, ry);
  updateFurnitureEditorInfo();
  drawDialogueUI();
}

function drawDialogueUI() {
  const touch = document.body.classList.contains('touch');
  if (nearbyNPC && !dialogueOpen && !touch) {
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const hint = '[E] to talk';
    const hw = ctx.measureText(hint).width;
    drawPanel(canvas.width/2 - hw/2 - 8, canvas.height - 40, hw + 16, 24, 'rgba(30,30,30,0.75)', 'rgba(5,5,5,0.75)', 'rgba(255,255,255,0.25)', 6);
    ctx.fillStyle = '#fff';
    ctx.fillText(hint, canvas.width/2, canvas.height - 23);
  }

  if (!dialogueOpen && !touch) {
    let hint = null;
    if (player.sitting) hint = '[E] to stand';
    else if (player.lying) hint = '[E] to get up';
    else if (player.showering) hint = '[E] to step out';
    else if (nearbySeat) hint = '[E] to sit';
    else if (nearbyBed) hint = '[E] to lie down';
    else if (nearbyShower) hint = '[E] to shower';
    else if (nearbyFixture) hint = nearbyFixture.hint;
    else if (nearbyQuestSpot) hint = nearbyQuestSpot.kind === 'pickup' ? `[E] to pick up ${nearbyQuestSpot.label}` : `[E] to investigate`;
    if (hint) {
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      const hw = ctx.measureText(hint).width;
      drawPanel(canvas.width/2 - hw/2 - 8, canvas.height - 40, hw + 16, 24, 'rgba(30,30,30,0.75)', 'rgba(5,5,5,0.75)', 'rgba(255,255,255,0.25)', 6);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, canvas.width/2, canvas.height - 23);
    }
  }

  if (performance.now() < flavorMessageUntil) {
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const hw = ctx.measureText(flavorMessage).width;
    drawPanel(canvas.width/2 - hw/2 - 10, canvas.height - 70, hw + 20, 26, 'rgba(30,30,30,0.85)', 'rgba(5,5,5,0.85)', 'rgba(255,255,255,0.3)', 6);
    ctx.fillStyle = '#fff';
    ctx.fillText(flavorMessage, canvas.width/2, canvas.height - 52);
  }

  if (dialogueOpen && nearbyNPC && dialogueTree) {
    const node = dialogueTree[dialogueNodeKey];
    const options = node.options ? (typeof node.options === 'function' ? node.options(player) : node.options) : null;
    const boxH = 90;

    drawPanel(20, canvas.height - boxH - 20, canvas.width - 40, boxH, 'rgba(28,28,32,0.94)', 'rgba(8,8,10,0.94)', 'rgba(255,255,255,0.4)', 10);

    const speaker = node.speaker === 'npc' ? nearbyNPC.name : 'You';
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = node.speaker === 'npc' ? '#ffd27f' : '#7fd0ff';
    ctx.fillText(speaker + ':', 38, canvas.height - boxH + 4);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#fff';
    const nodeText = typeof node.text === 'function' ? node.text(player) : node.text;
    ctx.fillText(nodeText, 38, canvas.height - boxH + 30);

    if (options) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#7fffb0';
      ctx.textAlign = 'right';
      ctx.fillText('Choose below, or press 1-9', canvas.width - 38, canvas.height - 30);
    } else {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'right';
      ctx.fillText(node.end ? '[E] to close' : '[E] to continue', canvas.width - 38, canvas.height - 30);
    }
  }
}

// a little colored dot with a dark outline, used for every marker on the
// full map (player, motorcycle, car) so they all read the same way
function drawMapMarker(x, y, color, big) {
  ctx.beginPath();
  ctx.arc(x, y, big ? 7 : 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// full-city map overlay - toggled with N (or the MAP touch button), shows
// every street/building/the park at a glance, plus where the player is and
// where their motorcycle/car is parked if they own one and aren't riding it
function drawMinimap() {
  const pad = 20;
  const mw = canvas.width - pad * 2;
  const mh = canvas.height - pad * 2 - 20;
  const totalW = WORLD_W - WORLD_LEFT;
  const totalH = WORLD_H - WORLD_TOP;
  // zoom/pan: mapView (player.js) holds the zoom and the world point at screen centre
  mapView.fit = Math.min(mw / totalW, mh / totalH);
  const scale = mapView.fit * mapView.zoom;
  const ox = canvas.width / 2 - (mapView.cx - WORLD_LEFT) * scale;
  const oy = canvas.height / 2 - (mapView.cy - WORLD_TOP) * scale;
  const wx = x => ox + (x - WORLD_LEFT) * scale;
  const wy = y => oy + (y - WORLD_TOP) * scale;
  const onScreen = (x, y) => x > -80 && x < canvas.width + 80 && y > -20 && y < canvas.height + 20;
  const lz = Math.min(1.7, 1 + (mapView.zoom - 1) * 0.12); // labels grow a little as you zoom in
  const font = (px, bold) => `${bold ? 'bold ' : ''}${Math.round(px * lz)}px monospace`;

  ctx.save();
  ctx.fillStyle = 'rgba(8,12,10,0.94)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2f6a3f';
  ctx.fillRect(wx(WORLD_LEFT), wy(WORLD_TOP), totalW * scale, totalH * scale);

  // farmland/seaside country west of downtown
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(wx(WORLD_LEFT), wy(0), (0 - WORLD_LEFT) * scale, Math.max(2, WORLD_H * scale));
  ctx.fillStyle = '#1a5a78';
  ctx.fillRect(wx(OCEAN_X0), wy(OCEAN_Y0), (OCEAN_X1 - OCEAN_X0) * scale, Math.max(2, (OCEAN_Y1 - OCEAN_Y0) * scale));
  ctx.fillStyle = '#8a7355';
  ctx.fillRect(wx(WEST_ROAD_X0), wy(WEST_ROAD_Y), (0 - WEST_ROAD_X0) * scale, Math.max(1, ROAD_W * scale));

  ctx.fillStyle = '#3f8a4f';
  ctx.fillRect(wx(PARK.x), wy(PARK.y), PARK.w * scale, PARK.h * scale);

  // the wilderness north of the second river - forest, then bare
  // mountain ground, tinted distinctly from the city
  ctx.fillStyle = '#354a2c';
  ctx.fillRect(wx(0), wy(MOUNTAIN_Y), WORLD_W * scale, Math.max(2, (FOREST_Y - MOUNTAIN_Y) * scale));
  // the matching strip of woods on the west side, between the farmland
  // and the mountains (shallower - it only comes down to WEST_FOREST_Y,
  // and stops at the shore so it doesn't paint over the ocean fill below)
  ctx.fillRect(wx(-2400), wy(MOUNTAIN_Y), Math.max(2, 2400 * scale), Math.max(2, (WEST_FOREST_Y - MOUNTAIN_Y) * scale));
  ctx.fillStyle = '#6a6a62';
  ctx.fillRect(wx(WORLD_LEFT), wy(WORLD_TOP), totalW * scale, Math.max(2, (MOUNTAIN_Y - WORLD_TOP) * scale));
  // the east mountain wall, closing off the far side of the map
  ctx.fillRect(wx(WORLD_W - EAST_MOUNTAIN_DEPTH), wy(MOUNTAIN_Y), Math.max(2, EAST_MOUNTAIN_DEPTH * scale), Math.max(2, (WORLD_H - MOUNTAIN_Y) * scale));

  ctx.fillStyle = '#2a5a8a';
  ctx.fillRect(wx(0), wy(RIVER_Y), WORLD_W * scale, Math.max(2, RIVER_H * scale));
  ctx.fillStyle = '#2a6a78';
  ctx.fillRect(wx(0), wy(RIVER2_Y), WORLD_W * scale, Math.max(2, RIVER2_H * scale));
  ctx.fillStyle = '#33708f';
  ctx.fillRect(wx(LAKE.x), wy(LAKE.y), Math.max(2, LAKE.w * scale), Math.max(2, LAKE.h * scale));
  ctx.fillRect(wx(LAKE2.x), wy(LAKE2.y), Math.max(2, LAKE2.w * scale), Math.max(2, LAKE2.h * scale));
  ctx.fillRect(wx(LAKE3.x), wy(LAKE3.y), Math.max(2, LAKE3.w * scale), Math.max(2, LAKE3.h * scale));

  ctx.fillStyle = '#555';
  NUMBERED_STREETS.forEach(s => ctx.fillRect(wx(0), wy(s.y), WORLD_W * scale, Math.max(1, ROAD_W * scale)));
  NAMED_STREETS.forEach(s => ctx.fillRect(wx(s.x), wy(0), Math.max(1, ROAD_W * scale), DOWNTOWN_H * scale));
  ctx.fillStyle = '#8a7355';
  NORTH_ROADS.forEach(s => ctx.fillRect(wx(s.x), wy(WORLD_TOP), Math.max(1, ROAD_W * scale), (0 - WORLD_TOP) * scale));
  RIDGE_ROADS.forEach(s => ctx.fillRect(wx(0), wy(s.y), WORLD_W * scale, Math.max(1, ROAD_W * scale)));
  LOOP_SEGMENTS.forEach(s => {
    if (s.horizontal) ctx.fillRect(wx(s.x0), wy(s.y), (s.x1 - s.x0) * scale, Math.max(1, ROAD_W * scale));
    else ctx.fillRect(wx(s.x), wy(Math.min(s.y0, s.y1)), Math.max(1, ROAD_W * scale), Math.abs(s.y1 - s.y0) * scale);
  });

  buildings.forEach(b => {
    ctx.fillStyle = b.roof;
    ctx.fillRect(wx(b.x), wy(b.y), Math.max(1.5, b.w * scale), Math.max(1.5, (b.h + b.wallH) * scale));
  });

  // building names, so the map actually shows what things are and not
  // just where they are - every label gets shown, but one that would
  // overlap an already-placed label gets nudged up/down in small steps
  // (progressively further out) until it finds a clear spot, rather than
  // being skipped or drawn on top of another name
  const placedLabels = [];
  function placeLabel(text, cx, cy, font, color) {
    if (!onScreen(cx, cy)) return false;
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const h = parseInt(font.match(/(\d+)px/)[1], 10) + 1;
    let finalY = cy;
    let found = false;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      const testY = attempt === 0 ? cy : cy + (attempt % 2 === 1 ? -1 : 1) * Math.ceil(attempt / 2) * h;
      const rect = { x: cx - tw / 2 - 2, y: testY - h, w: tw + 4, h: h + 2 };
      const overlaps = placedLabels.some(r => rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y);
      if (!overlaps) { finalY = testY; found = true; placedLabels.push(rect); }
    }
    if (!found) placedLabels.push({ x: cx - tw / 2 - 2, y: cy - h, w: tw + 4, h: h + 2 });
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, finalY);
    return true;
  }

  // rivers / mountains get their label repeated so one is always in view when zoomed in
  const along = (y, text, f, col) => { for (let x = 300; x < WORLD_W; x += 1600) placeLabel(text, wx(x), wy(y) + 3, f, col); };
  along(RIVER_Y + RIVER_H / 2, 'River', font(9, true), 'rgba(220,240,255,0.85)');
  along(RIVER2_Y + RIVER2_H / 2, 'Widow Creek', font(9, true), 'rgba(220,240,255,0.85)');
  along(WORLD_TOP + (MOUNTAIN_Y - WORLD_TOP) / 2, 'The Mountains', font(10, true), 'rgba(235,240,245,0.85)');
  placeLabel('Park', wx(PARK.x + PARK.w / 2), wy(PARK.y + PARK.h / 2), font(10, true), 'rgba(220,255,220,0.85)');
  placeLabel('Lake', wx(LAKE.x + LAKE.w / 2), wy(LAKE.y + LAKE.h / 2), font(9, true), 'rgba(220,240,255,0.85)');
  placeLabel('The Ocean', wx((OCEAN_X0 + OCEAN_X1) / 2), wy((OCEAN_Y0 + OCEAN_Y1) / 2), font(10, true), 'rgba(220,240,255,0.85)');
  // street names once there's room to read them
  if (mapView.zoom >= 2) {
    NUMBERED_STREETS.forEach(st => { for (let x = 680; x < WORLD_W; x += 1080) placeLabel(st.name, wx(x), wy(st.y + ROAD_W / 2) + 4, font(9), 'rgba(255,255,255,0.6)'); });
    NAMED_STREETS.forEach(st => { for (let y = 680; y < DOWNTOWN_H; y += 1080) placeLabel(st.name, wx(st.x + ROAD_W / 2), wy(y), font(9), 'rgba(255,255,255,0.6)'); });
  }

  // home gets its own bright outline and bold label, placed first so it
  // always wins any overlap against a regular building name
  const home = buildings.find(bd => bd.name === 'Home');
  if (home) {
    const hx = wx(home.x), hy = wy(home.y);
    const hw = Math.max(1.5, home.w * scale), hh = Math.max(1.5, (home.h + home.wallH) * scale);
    ctx.strokeStyle = '#ffd27f';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx - 1.5, hy - 1.5, hw + 3, hh + 3);
    placeLabel('HOME', hx + hw / 2, hy - 5, font(10, true), '#ffd27f');
  }

  buildings.forEach(b => {
    if (b.name === 'Home') return;
    const cx = wx(b.x) + Math.max(1.5, b.w * scale) / 2;
    placeLabel(b.name, cx, wy(b.y) - 3, font(8), 'rgba(255,255,255,0.85)');
  });

  if (player.hasMotorcycle && motorcycleParked && !player.onMotorcycle) {
    drawMapMarker(wx(motorcycleParked.x), wy(motorcycleParked.y), '#ffcc33');
    placeLabel('bike', wx(motorcycleParked.x), wy(motorcycleParked.y) - 10, font(9, true), '#ffcc33');
  }
  if (player.hasCar && carParked && !player.onCar) {
    drawMapMarker(wx(carParked.x), wy(carParked.y), '#3ad6ff');
    placeLabel('car', wx(carParked.x), wy(carParked.y) - 10, font(9, true), '#3ad6ff');
  }

  const me = playerMapPos();
  drawMapMarker(wx(me.x), wy(me.y), '#ff3a3a', true);
  // pulsing ring so you can find yourself at any zoom
  ctx.strokeStyle = 'rgba(255,58,58,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(wx(me.x), wy(me.y), 11 + Math.sin(performance.now() / 250) * 3, 0, Math.PI * 2); ctx.stroke();

  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText('MAP', canvas.width / 2, 30);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#aaa';
  const touch = document.body.classList.contains('touch');
  ctx.fillText(touch ? 'drag to move · pinch to zoom · red: you  yellow: bike  blue: car'
    : 'drag to move · scroll to zoom · [M] close · red: you  yellow: bike  blue: car  gold: home', canvas.width / 2, canvas.height - 16);
  ctx.restore();
}

function drawHUD() {
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'right';
  const cashText = `$${player.money}`;
  const ctw = ctx.measureText(cashText).width;
  drawPanel(canvas.width - ctw - 34, 10, ctw + 24, 30, 'rgba(30,30,30,0.7)', 'rgba(5,5,5,0.7)', 'rgba(255,255,255,0.3)', 8);
  ctx.fillStyle = '#7fffb0';
  ctx.fillText(cashText, canvas.width - 22, 31);

  const saveRemaining = lastSaveFlashUntil - performance.now();
  if (saveRemaining > 0) {
    const alpha = Math.min(1, saveRemaining / 400);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const saveText = 'Saved';
    const stw = ctx.measureText(saveText).width;
    drawPanel(canvas.width / 2 - stw / 2 - 8, 10, stw + 16, 20, 'rgba(30,30,30,0.65)', 'rgba(5,5,5,0.65)', null, 6);
    ctx.fillStyle = '#7fffb0';
    ctx.fillText(saveText, canvas.width / 2, 24);
    ctx.restore();
  }

  if (player.hasGun) {
    const flashEmpty = performance.now() < lastShotBlockedFlashUntil;
    const ammoText = `${player.ammoInMag}/${MAG_SIZE}  •  ${player.spareMags} mag${player.spareMags === 1 ? '' : 's'}`;
    ctx.font = 'bold 14px monospace';
    const atw = ctx.measureText(ammoText).width;
    drawPanel(canvas.width - atw - 30, 46, atw + 20, 24, 'rgba(30,30,30,0.7)', 'rgba(5,5,5,0.7)', flashEmpty ? '#ff6b6b' : 'rgba(255,255,255,0.3)', 7);
    ctx.fillStyle = flashEmpty ? '#ff6b6b' : (player.ammoInMag === 0 ? '#ff9f7f' : '#ffd27f');
    ctx.fillText(ammoText, canvas.width - 20, 63);
  }

  updateTrackEditorInfo();

  if (dialogueOpen) return;

  const items = [];
  if (player.hasGun) {
    items.push({
      label: 'Glock',
      sub: player.gunEquipped ? `${player.ammoInMag}/${MAG_SIZE}` : 'Holstered',
      active: player.gunEquipped
    });
  }
  if (player.hasMotorcycle) {
    items.push({
      label: 'Motorcycle',
      sub: player.onMotorcycle ? 'Riding' : 'Parked',
      active: player.onMotorcycle
    });
  }
  if (player.hasCar) {
    items.push({
      label: 'Car',
      sub: player.onCar ? 'Driving' : 'Parked',
      active: player.onCar
    });
  }
  if (player.onBoat) {
    items.push({ label: 'Paddleboard', sub: 'Paddling', active: true });
  } else if (player.onSurfboard) {
    const sub = player.ridingWave ? 'Riding in!'
      : surfboardOnBigWave() ? 'CATCH IT!'
      : 'Paddling';
    items.push({ label: 'Surfboard', sub, active: true });
  } else if (player.swimming) {
    items.push({ label: 'Lake', sub: 'Swimming', active: true });
  }
  if (player.traits.tattoo && player.traits.tattoo !== 'none') {
    items.push({ label: player.traits.tattoo === 'skull' ? 'Skull Tat' : 'Flower Tat', sub: '', active: false });
  }
  if (items.length === 0) return;

  // right-aligned under the cash + ammo readout, clear of the touch
  // button cluster in the bottom-right corner
  const slotW = 62, slotH = 34, gap = 6;
  const totalW = items.length * slotW + (items.length - 1) * gap;
  let sx = canvas.width - 16 - totalW;
  const sy = 84;
  items.forEach(item => {
    drawPanel(sx, sy, slotW, slotH,
      item.active ? 'rgba(255,210,127,0.3)' : 'rgba(30,30,30,0.65)',
      item.active ? 'rgba(200,150,60,0.3)' : 'rgba(5,5,5,0.65)',
      item.active ? '#ffd27f' : 'rgba(255,255,255,0.3)', 6);

    ctx.textAlign = 'center';
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(item.label, sx + slotW / 2, sy + 14);
    if (item.sub) {
      ctx.font = '8px monospace';
      ctx.fillStyle = item.active ? '#ffd27f' : '#aaa';
      ctx.fillText(item.sub, sx + slotW / 2, sy + 26);
    }
    sx += slotW + gap;
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (scene === 'outside') (ISO_VIEW ? drawOutsideIso : drawOutside)();
  else drawInterior();
  drawHUD();
  if (mapOpen) drawMinimap();
}

function loop(timestamp) {
  timestamp = timestamp || 0;
  if (!lastFrameTime) lastFrameTime = timestamp;
  let dt = (timestamp - lastFrameTime) / (1000 / 60);
  dt = Math.max(0, Math.min(dt, 3));
  lastFrameTime = timestamp;

  update(timestamp, dt);
  draw();
  requestAnimationFrame(loop);
}
