function drawBuildingExterior(b, camX, camY, nightFactor, faded) {
  const sx = b.x - camX;
  const sy = b.y - camY;
  nightFactor = nightFactor || 0;
  const dz = b.doorZone;

  // buildings with a yard get a grass gap plus a walkway between the curb
  // (sidewalk, right at the original wallH edge) and the door - buildings
  // without one (b.yardDepth === 0) sit flush against the curb as before
  if (b.yardDepth > 0) {
    const yardY = sy + b.h + b.wallDepth;
    // no tidy lawn out front of a seedy place - bare dirt/gravel instead
    ctx.fillStyle = b.seedy ? '#4a4438' : '#5a8f4f';
    ctx.fillRect(sx, yardY, b.w, b.yardDepth);
    ctx.fillStyle = b.seedy
      ? (hashNoise(b.x, b.y + 90) > 0.5 ? '#5a5548' : '#4f4a3e')
      : (hashNoise(b.x, b.y + 90) > 0.5 ? '#9a8f74' : '#8a9a80');
    const walkW = dz.w - 6 + hashNoise(b.x + 5, b.y) * 8;
    ctx.fillRect(dz.x - camX + (dz.w - walkW) / 2, yardY, walkW, b.yardDepth);
  }

  ctx.save();
  if (faded) ctx.globalAlpha = 0.45;

  // soft ground shadow cast toward the bottom-right, grounding the
  // building instead of it looking like it's floating on the grass/sidewalk
  const shadowGrad = ctx.createLinearGradient(sx, sy + b.h + b.wallDepth, sx, sy + b.h + b.wallDepth + 16);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.28)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(sx + 6, sy + b.h + b.wallDepth, b.w, 16);

  ctx.fillStyle = b.wall;
  ctx.fillRect(sx, sy, b.w, b.h + b.wallDepth);
  drawBuildingWall(b, sx, sy);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, b.w, b.h + b.wallDepth);

  // framed windows (lit at night) and a proper door - see visuals.js
  drawBuildingWindows(b, camX, camY, nightFactor);
  drawBuildingDoor(b, camX, camY, sy, nightFactor);

  ctx.fillStyle = b.roof;
  ctx.fillRect(sx, sy, b.w, b.h);
  drawBuildingRoof(b, sx, sy);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(sx, sy, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(sx, sy, b.w, 8);

  if (b.name) {
    const labelX = sx + b.w / 2;
    const labelY = sy - 10;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    const textW = ctx.measureText(b.name).width;

    const neonColor = NIGHTLIFE_SIGN_COLORS[b.name];
    if (neonColor && nightFactor > 0.15) {
      // occasional stutter rather than a steady glow - seeded by building
      // position so each sign flickers on its own independent schedule
      const flickerBucket = Math.floor(performance.now() / 120);
      const flicker = hashNoise(b.x, flickerBucket) > 0.12 ? 1 : 0.35;
      const glowAlpha = nightFactor * flicker;
      ctx.save();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 12 * glowAlpha;
      ctx.fillStyle = 'rgba(10,5,15,0.75)';
      ctx.fillRect(labelX - textW/2 - 8, labelY - 15, textW + 16, 20);
      ctx.globalAlpha = 0.6 + 0.4 * glowAlpha;
      ctx.fillStyle = neonColor;
      ctx.fillText(b.name, labelX, labelY);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(labelX - textW/2 - 6, labelY - 14, textW + 12, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(b.name, labelX, labelY);
    }
  }
  ctx.restore();
}

function drawRoads(camX, camY) {
  const asphalt = '#3a3a3a';
  const sidewalk = '#9a9a92';
  const centerline = '#d4c24a';

  const namedZones = NAMED_STREETS.map(v => ({ start: v.x - SIDEWALK_W, end: v.x + ROAD_W + SIDEWALK_W }));
  const numberedZones = NUMBERED_STREETS.map(h => ({ start: h.y - SIDEWALK_W, end: h.y + ROAD_W + SIDEWALK_W }));

  NUMBERED_STREETS.forEach(street => {
    ctx.fillStyle = asphalt;
    ctx.fillRect(0 - camX, street.y - camY, WORLD_W, ROAD_W);
  });
  NAMED_STREETS.forEach(street => {
    ctx.fillStyle = asphalt;
    ctx.fillRect(street.x - camX, 0 - camY, ROAD_W, DOWNTOWN_H);
  });

  ROAD_WEAR_SPOTS.forEach(spot => {
    const sx = spot.x - camX, sy = spot.y - camY;
    if (sx < -30 || sx > canvas.width + 30 || sy < -30 || sy > canvas.height + 30) return;
    ctx.fillStyle = `rgba(0,0,0,${spot.a ?? 0.1})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, spot.r, spot.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = sidewalk;
  NUMBERED_STREETS.forEach(street => {
    freeSegments(WORLD_W, namedZones).forEach(seg => {
      ctx.fillRect(seg.start - camX, street.y - SIDEWALK_W - camY, seg.end - seg.start, SIDEWALK_W);
      ctx.fillRect(seg.start - camX, street.y + ROAD_W - camY, seg.end - seg.start, SIDEWALK_W);
    });
  });
  NAMED_STREETS.forEach(street => {
    freeSegments(DOWNTOWN_H, numberedZones).forEach(seg => {
      ctx.fillRect(street.x - SIDEWALK_W - camX, seg.start - camY, SIDEWALK_W, seg.end - seg.start);
      ctx.fillRect(street.x + ROAD_W - camX, seg.start - camY, SIDEWALK_W, seg.end - seg.start);
    });
  });

  // concrete slab seams - cheap, but reads immediately as poured concrete
  // instead of a flat grey stripe
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  const seamGap = 40;
  NUMBERED_STREETS.forEach(street => {
    freeSegments(WORLD_W, namedZones).forEach(seg => {
      for (let sxw = seg.start; sxw < seg.end; sxw += seamGap) {
        const sx = sxw - camX;
        if (sx < -5 || sx > canvas.width + 5) continue;
        ctx.beginPath();
        ctx.moveTo(sx, street.y - SIDEWALK_W - camY);
        ctx.lineTo(sx, street.y - camY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, street.y + ROAD_W - camY);
        ctx.lineTo(sx, street.y + ROAD_W + SIDEWALK_W - camY);
        ctx.stroke();
      }
    });
  });
  NAMED_STREETS.forEach(street => {
    freeSegments(DOWNTOWN_H, numberedZones).forEach(seg => {
      for (let syw = seg.start; syw < seg.end; syw += seamGap) {
        const sy = syw - camY;
        if (sy < -5 || sy > canvas.height + 5) continue;
        ctx.beginPath();
        ctx.moveTo(street.x - SIDEWALK_W - camX, sy);
        ctx.lineTo(street.x - camX, sy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(street.x + ROAD_W - camX, sy);
        ctx.lineTo(street.x + ROAD_W + SIDEWALK_W - camX, sy);
        ctx.stroke();
      }
    });
  });

  ctx.fillStyle = centerline;
  const dash = 30, gap = 20;
  NUMBERED_STREETS.forEach(street => {
    for (let dx = 20; dx < WORLD_W; dx += dash + gap) {
      const overlapsIntersection = namedZones.some(z => dx < z.end && dx + dash > z.start);
      if (!overlapsIntersection) {
        ctx.fillRect(dx - camX, street.y + ROAD_W/2 - 2 - camY, dash, 4);
      }
    }
  });
  NAMED_STREETS.forEach(street => {
    for (let dy = 20; dy < DOWNTOWN_H; dy += dash + gap) {
      const overlapsIntersection = numberedZones.some(z => dy < z.end && dy + dash > z.start);
      if (!overlapsIntersection) {
        ctx.fillRect(street.x + ROAD_W/2 - 2 - camX, dy - camY, 4, dash);
      }
    }
  });

  // crosswalks - a zebra-striped band on each of the four approaches to
  // every intersection, right where a car would stop for the light. Real
  // crosswalk stripes run parallel to the road they cross (so tires track
  // between them instead of grinding across), so a band on the north/south
  // approach (crossing the vertical road) is made of vertical stripes
  // spread across that road's width, and a band on the east/west approach
  // (crossing the horizontal road) is made of horizontal stripes spread
  // across its width.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const cwDepth = 26, cwStripe = 10, cwGap = 8, cwMargin = 10;
  NUMBERED_STREETS.forEach(hs => {
    NAMED_STREETS.forEach(vs => {
      for (let sx = vs.x + cwMargin; sx < vs.x + ROAD_W - cwMargin; sx += cwStripe + cwGap) {
        ctx.fillRect(sx - camX, hs.y - cwDepth - camY, cwStripe, cwDepth); // north approach
        ctx.fillRect(sx - camX, hs.y + ROAD_W - camY, cwStripe, cwDepth); // south approach
      }
      for (let sy = hs.y + cwMargin; sy < hs.y + ROAD_W - cwMargin; sy += cwStripe + cwGap) {
        ctx.fillRect(vs.x - cwDepth - camX, sy - camY, cwDepth, cwStripe); // west approach
        ctx.fillRect(vs.x + ROAD_W - camX, sy - camY, cwDepth, cwStripe); // east approach
      }
    });
  });

  ctx.fillStyle = sidewalk;
  NUMBERED_STREETS.forEach(hs => {
    NAMED_STREETS.forEach(vs => {
      ctx.fillRect(vs.x - SIDEWALK_W - camX, hs.y - SIDEWALK_W - camY, SIDEWALK_W, SIDEWALK_W);
      ctx.fillRect(vs.x + ROAD_W - camX, hs.y - SIDEWALK_W - camY, SIDEWALK_W, SIDEWALK_W);
      ctx.fillRect(vs.x - SIDEWALK_W - camX, hs.y + ROAD_W - camY, SIDEWALK_W, SIDEWALK_W);
      ctx.fillRect(vs.x + ROAD_W - camX, hs.y + ROAD_W - camY, SIDEWALK_W, SIDEWALK_W);
    });
  });

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const labelSpacing = 500;

  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  NUMBERED_STREETS.forEach(hs => {
    const textW = ctx.measureText(hs.name).width;
    for (let lx = 300; lx < WORLD_W; lx += labelSpacing) {
      const overlaps = namedZones.some(z => lx - textW/2 < z.end && lx + textW/2 > z.start);
      if (!overlaps) {
        ctx.fillText(hs.name, lx - camX, hs.y + 28 - camY);
      }
    }
  });

  NAMED_STREETS.forEach(vs => {
    const textW = ctx.measureText(vs.name).width;
    for (let ly = 300; ly < DOWNTOWN_H; ly += labelSpacing) {
      const overlaps = numberedZones.some(z => ly - textW/2 < z.end && ly + textW/2 > z.start);
      const inRiver = ly + textW/2 > RIVER_Y && ly - textW/2 < RIVER_Y + RIVER_H;
      if (!overlaps && !inRiver) {
        ctx.save();
        ctx.translate(vs.x + 28 - camX, ly - camY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(vs.name, 0, 0);
        ctx.restore();
      }
    }
  });
}

// the river separating downtown from the south side, drawn on top of the
// roads so it covers up Oak/Elm/Cedar's dead-ended pavement (they simply
// don't get painted this far south, per drawRoads' maxY cap) and Pine/
// Maple's plain asphalt gets a proper bridge deck laid over it instead.
// Generalized so the same function also draws the second river further
// south, with a rustic wood-plank bridge instead of a steel truss one.
function drawRiver(camX, camY, riverY = RIVER_Y, riverH = RIVER_H, crossings = NAMED_STREETS.filter(s => s.bridge), style = 'steel') {
  const y = riverY - camY;
  if (y > canvas.height + 20 || y + riverH < -20) return;

  const grad = ctx.createLinearGradient(0, y, 0, y + riverH);
  if (style === 'wood') {
    grad.addColorStop(0, '#3a7a8a');
    grad.addColorStop(0.5, '#2c5f70');
    grad.addColorStop(1, '#234a58');
  } else {
    grad.addColorStop(0, '#3a6fa0');
    grad.addColorStop(0.5, '#2c5580');
    grad.addColorStop(1, '#234868');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0 - camX, y, WORLD_W, riverH);

  // drifting shimmer streaks, same trick the park pond uses
  ctx.save();
  ctx.beginPath();
  ctx.rect(0 - camX, y, WORLD_W, riverH);
  ctx.clip();
  const t = performance.now() / 1000;
  for (let i = 0; i < 10; i++) {
    const phase = t * 0.3 + i * 1.7;
    const sx = (i * 500 + Math.sin(phase) * 250) % (WORLD_W + 500) - 250 - camX;
    const sy = y + riverH * 0.5 + Math.sin(phase * 0.6 + i) * riverH * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${(0.06 + 0.04 * Math.sin(phase * 1.2)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 110, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0 - camX, y); ctx.lineTo(WORLD_W - camX, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0 - camX, y + riverH); ctx.lineTo(WORLD_W - camX, y + riverH); ctx.stroke();

  if (style === 'wood') {
    // rustic single-lane wood-plank bridges, no sidewalks or lane paint -
    // just a plank deck with simple log rails and support posts
    crossings.forEach(s => {
      const bx = s.x - camX;

      const deckGrad = ctx.createLinearGradient(bx, 0, bx + ROAD_W, 0);
      deckGrad.addColorStop(0, '#6a4a2e');
      deckGrad.addColorStop(0.5, '#8a6440');
      deckGrad.addColorStop(1, '#6a4a2e');
      ctx.fillStyle = deckGrad;
      ctx.fillRect(bx, y, ROAD_W, riverH);

      // individual planks running crosswise
      ctx.strokeStyle = 'rgba(30,20,10,0.4)';
      ctx.lineWidth = 2;
      const plankGap = 14;
      ctx.beginPath();
      for (let py = 8; py < riverH; py += plankGap) {
        ctx.moveTo(bx, y + py);
        ctx.lineTo(bx + ROAD_W, y + py);
      }
      ctx.stroke();

      // log support posts poking up through the deck at intervals
      ctx.fillStyle = '#4a3320';
      const postGap = 60;
      for (let py = 20; py < riverH; py += postGap) {
        ctx.beginPath(); ctx.arc(bx + 10, y + py, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + ROAD_W - 10, y + py, 5, 0, Math.PI * 2); ctx.fill();
      }

      // simple log railings along each edge
      ctx.fillStyle = '#5a3f26';
      ctx.fillRect(bx - 4, y - 4, 4, riverH + 8);
      ctx.fillRect(bx + ROAD_W, y - 4, 4, riverH + 8);
    });
    return;
  }

  // bridges - a steel truss deck flanked by real sidewalks (matching the
  // sidewalks the road has everywhere else), laid right over the water at
  // every named street
  crossings.forEach(s => {
    const bx = s.x - camX;

    // sidewalks continue straight across on both sides of the deck
    ctx.fillStyle = '#9a9a92';
    ctx.fillRect(bx - SIDEWALK_W, y, SIDEWALK_W, riverH);
    ctx.fillRect(bx + ROAD_W, y, SIDEWALK_W, riverH);

    // steel deck
    const deckGrad = ctx.createLinearGradient(bx, 0, bx + ROAD_W, 0);
    deckGrad.addColorStop(0, '#5a6068');
    deckGrad.addColorStop(0.5, '#868d96');
    deckGrad.addColorStop(1, '#5a6068');
    ctx.fillStyle = deckGrad;
    ctx.fillRect(bx, y, ROAD_W, riverH);

    // truss cross-bracing, the classic zigzag of a steel girder bridge
    ctx.strokeStyle = 'rgba(20,25,30,0.5)';
    ctx.lineWidth = 3;
    const braceGap = 44;
    ctx.beginPath();
    for (let by = 0; by < riverH; by += braceGap) {
      ctx.moveTo(bx, y + by);
      ctx.lineTo(bx + ROAD_W, y + by + braceGap / 2);
      ctx.lineTo(bx, y + by + braceGap);
    }
    ctx.stroke();

    // faint lane line down the middle of the deck, same as the roads
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let ly = 10; ly < riverH; ly += 30) {
      ctx.fillRect(bx + ROAD_W / 2 - 1, y + ly, 2, 16);
    }

    // dark metal railings along the outer edge of each sidewalk
    ctx.fillStyle = '#33383e';
    ctx.fillRect(bx - SIDEWALK_W - 4, y - 4, 4, riverH + 8);
    ctx.fillRect(bx + ROAD_W + SIDEWALK_W, y - 4, 4, riverH + 8);
  });
}

// the dirt-road continuation of Pine/Maple St, from downtown's edge north
// through the wilderness - no sidewalks, no lane paint, just packed dirt
function drawNorthRoads(camX, camY) {
  NORTH_ROADS.forEach(s => {
    const bx = s.x - camX;
    const top = WORLD_TOP - camY;
    const h = 0 - WORLD_TOP;
    if (bx + ROAD_W < 0 || bx > canvas.width || top > canvas.height || top + h < 0) return;

    ctx.fillStyle = '#8a7355';
    ctx.fillRect(bx, top, ROAD_W, h);

    dirtTexture(camX, camY, bx, top, ROAD_W, h);

    // a few darker ruts/patches so it doesn't read as one flat tan block
    for (let ry = 0; ry < h; ry += 90) {
      const wy = WORLD_TOP + ry;
      const n = hashNoise(s.x, wy);
      ctx.fillStyle = `rgba(60,45,28,${0.15 + n * 0.15})`;
      ctx.fillRect(bx + 10 + n * (ROAD_W - 60), top + ry, 40, 18);
    }
  });
}

// a raised dirt mound spanning the FULL width of whichever road it's on
// (so there's no lane you could ride through to dodge it): a straight
// flat front edge (not a point), a short climb, a wide flat plateau
// across the middle, a short drop, then a straight flat back edge to
// match. `top` is the road's own screen-space top edge - shared by any
// road a ramp happens to belong to, not just Ridge Road
function drawRampMound(rx, top, r) {
  const halfLen = 70 * r.size;
  const plateauHalf = halfLen * 0.4;
  const edgeHalfH = (ROAD_W / 2) * 0.4; // half-height of the flat front/back edge
  if (rx + halfLen < -20 || rx - halfLen > canvas.width + 20) return;

  const topY = top, botY = top + ROAD_W, midY = top + ROAD_W / 2;
  const edgeTopY = midY - edgeHalfH, edgeBotY = midY + edgeHalfH;

  const grad = ctx.createLinearGradient(rx - halfLen, 0, rx + halfLen, 0);
  grad.addColorStop(0, '#6a4a2e');
  grad.addColorStop(0.5, '#b39264');
  grad.addColorStop(1, '#6a4a2e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(rx - halfLen, edgeTopY);   // straight front edge, top...
  ctx.lineTo(rx - halfLen, edgeBotY);   // ...to bottom
  ctx.lineTo(rx - plateauHalf, botY);   // climb up along the bottom
  ctx.lineTo(rx + plateauHalf, botY);   // plateau, bottom
  ctx.lineTo(rx + halfLen, edgeBotY);   // drop back down...
  ctx.lineTo(rx + halfLen, edgeTopY);   // straight back edge, bottom to top
  ctx.lineTo(rx + plateauHalf, topY);   // climb back up along the top
  ctx.lineTo(rx - plateauHalf, topY);   // plateau, top
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // plateau edges top and bottom, plus a couple of contour lines on
  // each slope so the climb/drop actually reads
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx - plateauHalf, topY); ctx.lineTo(rx + plateauHalf, topY);
  ctx.moveTo(rx - plateauHalf, botY); ctx.lineTo(rx + plateauHalf, botY);
  ctx.stroke();
  [0.35, 0.7].forEach(f => {
    const slopeLen = halfLen - plateauHalf;
    const lx1 = rx - plateauHalf - slopeLen * (1 - f), lx2 = rx + plateauHalf + slopeLen * (1 - f);
    const inset = edgeHalfH + (ROAD_W / 2 - edgeHalfH) * f;
    ctx.beginPath(); ctx.moveTo(lx1, midY - inset); ctx.lineTo(lx1, midY + inset); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx2, midY - inset); ctx.lineTo(lx2, midY + inset); ctx.stroke();
  });
}

// a dirt road running the full width of the world up near the mountains
function drawRidgeRoad(camX, camY) {
  const top = RIDGE_ROAD_Y - camY;
  if (top > canvas.height || top + ROAD_W < 0) return;

  ctx.fillStyle = '#8a7355';
  ctx.fillRect(0 - camX, top, WORLD_W, ROAD_W);

  dirtTexture(camX, camY, 0 - camX, top, WORLD_W, ROAD_W);

  for (let rx = 0; rx < WORLD_W; rx += 90) {
    const sx = rx - camX;
    if (sx < -30 || sx > canvas.width + 30) continue;
    const n = hashNoise(rx, RIDGE_ROAD_Y);
    ctx.fillStyle = `rgba(60,45,28,${0.15 + n * 0.15})`;
    ctx.fillRect(sx, top + 10 + n * (ROAD_W - 60), 18, 40);
  }
}

// the two loop trails - a vertical spur dropping off each end of Ridge
// Road, then a horizontal run back in to rejoin Pine St or Maple St
function drawLoopTrails(camX, camY) {
  LOOP_SEGMENTS.forEach(seg => {
    if (seg.horizontal) {
      const top = seg.y - camY;
      if (top > canvas.height || top + ROAD_W < 0) return;
      const left = seg.x0 - camX, right = seg.x1 - camX;
      if (right < 0 || left > canvas.width) return;
      ctx.fillStyle = '#8a7355';
      ctx.fillRect(left, top, right - left, ROAD_W);
      dirtTexture(camX, camY, left, top, right - left, ROAD_W);
      for (let rx = seg.x0; rx < seg.x1; rx += 90) {
        const sx = rx - camX;
        if (sx < -30 || sx > canvas.width + 30) continue;
        const n = hashNoise(rx, seg.y);
        ctx.fillStyle = `rgba(60,45,28,${0.15 + n * 0.15})`;
        ctx.fillRect(sx, top + 10 + n * (ROAD_W - 60), 18, 40);
      }
    } else {
      const left = seg.x - camX;
      const top = seg.y0 - camY, bottom = seg.y1 - camY;
      if (left + ROAD_W < 0 || left > canvas.width) return;
      if (bottom < 0 || top > canvas.height) return;
      ctx.fillStyle = '#8a7355';
      ctx.fillRect(left, Math.min(top, bottom), ROAD_W, Math.abs(bottom - top));
      dirtTexture(camX, camY, left, Math.min(top, bottom), ROAD_W, Math.abs(bottom - top));
      for (let ry = seg.y0; ry < seg.y1; ry += 90) {
        const sy = ry - camY;
        if (sy < -30 || sy > canvas.height + 30) continue;
        const n = hashNoise(seg.x, ry);
        ctx.fillStyle = `rgba(60,45,28,${0.15 + n * 0.15})`;
        ctx.fillRect(left + 10 + n * (ROAD_W - 60), sy, 18, 40);
      }
    }
  });
}

// every ramp the player has placed with the track editor, wherever it is
function drawTrackRamps(camX, camY) {
  TRACK_RAMPS.forEach((r, i) => {
    drawRampMound(r.x - camX, r.y - ROAD_W / 2 - camY, r);
    if (trackEditorOpen) {
      ctx.save();
      ctx.strokeStyle = i === draggingRampIndex ? 'rgba(255,255,0,0.9)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(r.x - camX - 70 * r.size, r.y - camY - ROAD_W / 2, 140 * r.size, ROAD_W);
      ctx.restore();
    }
  });
}

// still lake water in the middle of the forest - same shimmering-ellipse
// treatment as the park pond, just bigger. Takes a {x,y,w,h} rect so the
// smaller west-forest lakes can reuse the exact same rendering
function drawLake(camX, camY, lake) {
  lake = lake || LAKE;
  const lx = lake.x - camX, ly = lake.y - camY;
  if (lx + lake.w < -50 || lx > canvas.width + 50 || ly + lake.h < -50 || ly > canvas.height + 50) return;

  const cx = lx + lake.w / 2, cy = ly + lake.h / 2;
  const rx = lake.w / 2, ry = lake.h / 2;
  const grad = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, 4, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0, '#5b93c2');
  grad.addColorStop(0.55, '#33708f');
  grad.addColorStop(1, '#234a58');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#234a58';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  const t = performance.now() / 1000;
  for (let i = 0; i < 4; i++) {
    const phase = t * 0.22 + i * 2.4;
    const sx = cx + Math.sin(phase) * rx * 0.6;
    const sy = cy + Math.cos(phase * 0.7) * ry * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.07 + 0.05 * Math.sin(phase * 1.3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.3, ry * 0.1, phase * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// a small wooden dock sticking out from shore into the lake, where the
// boat is moored - drawn after the lake so the planks read as sitting
// on top of the water rather than under it
function drawDock(camX, camY) {
  const dx = LAKE_DOCK.x - camX, dy = LAKE_DOCK.y - camY;
  if (dx + LAKE_DOCK.w < -20 || dx > canvas.width + 20 || dy > canvas.height + 20 || dy + LAKE_DOCK.h < -20) return;

  ctx.fillStyle = '#6a4a2e';
  ctx.fillRect(dx, dy, LAKE_DOCK.w, LAKE_DOCK.h);

  ctx.strokeStyle = 'rgba(30,20,10,0.35)';
  ctx.lineWidth = 1.5;
  for (let py = 8; py < LAKE_DOCK.h; py += 12) {
    ctx.beginPath();
    ctx.moveTo(dx, dy + py);
    ctx.lineTo(dx + LAKE_DOCK.w, dy + py);
    ctx.stroke();
  }

  ctx.fillStyle = '#4a3320';
  for (let py = 14; py < LAKE_DOCK.h - 10; py += 40) {
    ctx.beginPath(); ctx.arc(dx - 3, dy + py, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx + LAKE_DOCK.w + 3, dy + py, 4, 0, Math.PI * 2); ctx.fill();
  }
}

// a stand-up paddleboard - long and narrow, sized so a standing rider
// (drawn separately, on top) actually fits on it, with a rounded nose
// pointed whichever way it's currently facing
function drawPaddleboard(cx, cy, facing, color) {
  ctx.save();
  ctx.translate(cx, cy);
  const angle = facing === 'left' ? Math.PI : facing === 'right' ? 0 : facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-50, 0, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // board outline - flat tail, rounded nose - noticeably longer than the
  // rider is tall, like a real paddleboard rather than a toy underneath them
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-55, -13);
  ctx.lineTo(34, -13);
  ctx.quadraticCurveTo(64, 0, 34, 13);
  ctx.lineTo(-55, 13);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shadeColor(color, -20);
  ctx.beginPath();
  ctx.moveTo(-46, -8);
  ctx.lineTo(25, -8);
  ctx.quadraticCurveTo(46, 0, 25, 8);
  ctx.lineTo(-46, 8);
  ctx.closePath();
  ctx.fill();

  // deck traction pad where the rider stands
  ctx.fillStyle = shadeColor(color, 25);
  ctx.fillRect(-30, -5, 46, 10);

  ctx.restore();
}

// a trailing wake behind the board while riding a wave in - stretched
// white speed-streak lines (for the sense of how fast it's carrying you)
// plus a plume of small droplets kicked up off the tail, both fading and
// shrinking with distance, flickering a bit frame to frame for some life
function drawSurfSpray(px, py, facing, intensity) {
  if (intensity <= 0) return;
  const dir = facing === 'right' ? -1 : facing === 'left' ? 1 : 0;
  const t = performance.now() / 90;

  // long streak lines stretching back from the tail - the classic
  // "moving fast" cue, strongest right behind the board
  for (let i = 0; i < 4; i++) {
    const seed = i * 9.3;
    const across = (i - 1.5) * 6;
    const len = 26 + i * 10 + Math.sin(t * 2 + seed) * 6;
    const startX = px + dir * 6;
    const startY = py + 4 + across;
    const endX = startX + dir * len;
    const alpha = intensity * (0.5 - i * 0.09) * (0.7 + 0.3 * Math.sin(t * 3 + seed));
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = 2.5 - i * 0.4;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, startY);
    ctx.stroke();
  }

  // a plume of small droplets kicked up off the tail
  for (let i = 0; i < 6; i++) {
    const seed = i * 13.7;
    const spread = 8 + i * 6;
    const jitterAlong = Math.sin(t + seed) * 4;
    const jitterAcross = Math.cos(t * 1.4 + seed) * (4 + i);
    const sx = px + dir * (spread + jitterAlong);
    const sy = py + 6 - i * 1.4 + jitterAcross;
    const alpha = intensity * (1 - i / 6) * (0.35 + 0.3 * Math.sin(t * 2 + seed));
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 5 - i * 0.5, 3 - i * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// narrower and more pointed at both ends than the paddleboard - a real
// surfboard shape rather than a flat-tailed cruiser
function drawSurfboard(cx, cy, facing, color) {
  ctx.save();
  ctx.translate(cx, cy);
  const angle = facing === 'left' ? Math.PI : facing === 'right' ? 0 : facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-46, 0, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // board outline - pointed nose AND tail, narrower than the paddleboard
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(52, 0);
  ctx.quadraticCurveTo(28, -9, -30, -9);
  ctx.quadraticCurveTo(-52, -5, -52, 0);
  ctx.quadraticCurveTo(-52, 5, -30, 9);
  ctx.quadraticCurveTo(28, 9, 52, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shadeColor(color, -20);
  ctx.beginPath();
  ctx.moveTo(42, 0);
  ctx.quadraticCurveTo(22, -5, -24, -5);
  ctx.quadraticCurveTo(-42, -3, -42, 0);
  ctx.quadraticCurveTo(-42, 3, -24, 5);
  ctx.quadraticCurveTo(22, 5, 42, 0);
  ctx.closePath();
  ctx.fill();

  // center stringer stripe
  ctx.strokeStyle = shadeColor(color, 40);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(46, 0);
  ctx.lineTo(-46, 0);
  ctx.stroke();

  ctx.restore();
}

// a dashed dirt trail winding through the woods - purely cosmetic
function drawHikingTrail(camX, camY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(138,115,85,0.8)';
  ctx.lineWidth = 5;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  HIKING_TRAIL.forEach((p, i) => {
    const x = p.x - camX, y = p.y - camY;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

// short sandy access paths leading from the shore down into the lake
function drawLakePaths(camX, camY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200,180,140,0.8)';
  ctx.lineWidth = 8;
  LAKE_PATHS.forEach(path => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const x = p.x - camX, y = p.y - camY;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.restore();
}

// the dirt road west of downtown - 2nd St just keeps going
function drawWestRoad(camX, camY) {
  const top = WEST_ROAD_Y - camY;
  if (top > canvas.height || top + ROAD_W < 0) return;
  const left = WEST_ROAD_X0 - camX, right = 0 - camX;
  if (right < 0 || left > canvas.width) return;

  ctx.fillStyle = '#8a7355';
  ctx.fillRect(left, top, right - left, ROAD_W);

  dirtTexture(camX, camY, left, top, right - left, ROAD_W);

  for (let rx = WEST_ROAD_X0; rx < 0; rx += 90) {
    const sx = rx - camX;
    if (sx < -30 || sx > canvas.width + 30) continue;
    const n = hashNoise(rx, WEST_ROAD_Y);
    ctx.fillStyle = `rgba(60,45,28,${0.15 + n * 0.15})`;
    ctx.fillRect(sx, top + 10 + n * (ROAD_W - 60), 18, 40);
  }
}

// a few tinted, furrow-textured field patches out in the farmland
function drawFarmFields(camX, camY) {
  FARM_FIELDS.forEach(f => {
    const x = f.x - camX, y = f.y - camY;
    if (x + f.w < 0 || x > canvas.width || y + f.h < 0 || y > canvas.height) return;
    ctx.fillStyle = f.color;
    ctx.fillRect(x, y, f.w, f.h);
    // crop rows / furrows (visuals.js)
    if (FIELD_PATTERNS[f.color]) fillAnchored(FIELD_PATTERNS[f.color], x, y, x, y, f.w, f.h);
    // soft darker border so the field edge reads against the grass
    ctx.strokeStyle = 'rgba(40,30,10,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, f.w - 3, f.h - 3);
  });
}

// short dirt spurs connecting farm buildings to the road
function drawFarmPaths(camX, camY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(138,115,85,0.8)';
  ctx.lineWidth = 8;
  FARM_PATHS.forEach(path => {
    ctx.beginPath();
    path.forEach((p, i) => {
      const x = p.x - camX, y = p.y - camY;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.restore();
}

// sandy shore between the farmland/town ground and the open ocean,
// with a wooden boardwalk running along it
function drawShoreAndBoardwalk(camX, camY) {
  const sx = SHORE.x - camX, sy = SHORE.y - camY;
  if (sx + SHORE.w >= 0 && sx <= canvas.width && sy + SHORE.h >= 0 && sy <= canvas.height) {
    ctx.fillStyle = '#d8c896';
    ctx.fillRect(sx, sy, SHORE.w, SHORE.h);
    sandTexture(camX, camY, sx, sy, SHORE.w, SHORE.h);
  }

  const bx = BOARDWALK.x - camX, by = BOARDWALK.y - camY;
  if (bx + BOARDWALK.w < 0 || bx > canvas.width || by + BOARDWALK.h < 0 || by > canvas.height) return;
  ctx.fillStyle = '#6a4a2e';
  ctx.fillRect(bx, by, BOARDWALK.w, BOARDWALK.h);
  ctx.strokeStyle = 'rgba(30,20,10,0.35)';
  ctx.lineWidth = 1.5;
  for (let py = 8; py < BOARDWALK.h; py += 12) {
    ctx.beginPath();
    ctx.moveTo(bx, by + py);
    ctx.lineTo(bx + BOARDWALK.w, by + py);
    ctx.stroke();
  }
}

// a small elevated lifeguard tower - stilts, a platform, and a
// classic red-and-white peaked roof
function drawLifeguardStand(wx, wy, camX, camY) {
  const x = wx - camX, y = wy - camY;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 2, 14, 6, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#c8b090';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 10, y); ctx.lineTo(x - 6, y - 26);
  ctx.moveTo(x + 10, y); ctx.lineTo(x + 6, y - 26);
  ctx.stroke();

  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(x - 14, y - 38, 28, 12);

  ctx.fillStyle = '#c25f5f';
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 38);
  ctx.lineTo(x + 16, y - 38);
  ctx.lineTo(x, y - 54);
  ctx.closePath();
  ctx.fill();
}

// a quest pickup/action spot - a small gently-bobbing pouch with a
// glowing outline so it reads as interactable, plus a floating label.
// Deliberately generic (color/label only) so any future quest item can
// reuse this one draw call instead of a bespoke sprite
function drawQuestSpot(spot, camX, camY) {
  const x = spot.x - camX;
  const bob = Math.sin(performance.now() / 400) * 3;
  const y = spot.y - camY + bob;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, spot.y - camY + 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(255,255,150,0.8)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = spot.color;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 9, 18, 18, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(spot.label, x, y - 16);
}

// a single flat, filled scallop band - a row of repeating rounded humps
// (classic cartoon-wave-border style) rather than a thin wavy line
// each hump has a long, gently curved back slope (seaward) and a short,
// sharp, pointy face on the shore side - leaning forward in the same
// direction the whole pattern drifts, like a wave curling toward the beach
// every row of waves has its own independent "every N humps is a tall
// one" pattern (N = 3, 4, or 5, picked from the row's own seed) - rows
// aren't synced with each other, each just keeps rolling on its own
function oceanRowWaveInfo(wy, t) {
  const humpW = 160; // longer waves - more spread out, nicer to surf in on
  const rowSeed = hashNoise(wy, 0);
  const speed = 45 + rowSeed * 25;
  // deliberately NOT wrapped with a modulo - the hump index below needs
  // to count up smoothly forever, or a fixed spot near shore could end
  // up permanently skipped by the "every Nth is tall" pattern once the
  // wrapped phase started re-landing on the same handful of indices
  const phase = t * speed;
  const tallEvery = 3 + Math.floor(rowSeed * 3);
  return { rowSeed, speed, phase, humpW, tallEvery };
}

// true if the hump currently sitting at world x wx (for this row's wave
// info) is one of the tall ones in its own every-N-humps pattern
function isBigWaveHump(wx, info) {
  const idx = Math.floor((wx - info.phase) / info.humpW);
  return ((idx % info.tallEvery) + info.tallEvery) % info.tallEvery === 0;
}

function waveHumpOffset(wx, phase, humpW, humpH, tallEvery) {
  const period = humpW;
  const f = (((wx - phase) % period) + period) % period / period;
  const peakF = WAVE_PEAK_F;
  const idx = Math.floor((wx - phase) / period);
  const isTall = tallEvery && ((idx % tallEvery) + tallEvery) % tallEvery === 0;
  const amp = isTall ? humpH * WAVE_TALL_MULT : humpH;
  if (f < peakF) {
    return amp * Math.pow(f / peakF, 1.6);
  }
  return amp * Math.pow((1 - f) / (1 - peakF), 0.5);
}

function drawScallopBand(camX, camY, y, phase, humpW, humpH, bandH, color, tallEvery, accent) {
  const left = OCEAN_X0 - humpW * 2;
  const right = OCEAN_X1 + humpW * 2;
  ctx.beginPath();
  for (let wx = left; wx <= right; wx += 6) {
    const topY = y - waveHumpOffset(wx, phase, humpW, humpH, tallEvery);
    const px = wx - camX, py = topY - camY;
    if (wx === left) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  // a bright white line traced right along the crest, before the path is
  // extended into the flat-bottomed fill shape - a foam highlight, only
  // drawn for the front (lighter) layer so it doesn't double up
  if (accent) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineTo(right - camX, y + bandH - camY);
  ctx.lineTo(left - camX, y + bandH - camY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// the ocean, out past the beach - deep blue-green water with wave crests
// that continuously drift east, rolling in toward the shore
function drawOcean(camX, camY) {
  const x = OCEAN_X0 - camX, y = OCEAN_Y0 - camY;
  const w = OCEAN_X1 - OCEAN_X0, h = OCEAN_Y1 - OCEAN_Y0;
  if (x + w < 0 || x > canvas.width || y + h < 0 || y > canvas.height) return;

  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#0f3a52');
  grad.addColorStop(0.6, '#1a5a78');
  grad.addColorStop(1, '#2a7a96');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const t = performance.now() / 1000;
  const breakerX0 = OCEAN_X1 - BREAKER_WIDTH;

  // calm open water out past the breakers - the same subtle drifting
  // shimmer the lake uses (small, few, and sized to the water rather than
  // fixed ovals), not big waves; the waves only start near shore
  const openW = breakerX0 - OCEAN_X0, openH = OCEAN_Y1 - OCEAN_Y0;
  const ocx = OCEAN_X0 + openW / 2, ocy = OCEAN_Y0 + openH / 2;
  for (let i = 0; i < 5; i++) {
    const phase = t * 0.22 + i * 2.4;
    const sx = ocx + Math.sin(phase) * openW * 0.4;
    const sy = ocy + Math.cos(phase * 0.7) * openH * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${(0.07 + 0.05 * Math.sin(phase * 1.3)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sx - camX, sy - camY, openW * 0.12, openH * 0.04, phase * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // waves and crashing surf, confined to the breaker zone right at shore
  ctx.save();
  ctx.beginPath();
  ctx.rect(breakerX0 - camX, y, OCEAN_X1 - breakerX0, h);
  ctx.clip();

  // flat, scalloped wave bands - the classic two-tone "cartoon wave"
  // border look, not thin swell lines: a row of connected humps filled
  // solid, with a lighter crest layer riding just in front of a darker
  // back layer, both continuously drifting east toward the shore.
  // Every so often (independently per row, not synced across rows) one
  // hump in the sequence is a tall one - that's the one you can surf in on
  const rowGap = 130;
  const humpH = 22;

  // the ocean now runs the full length of the world, so most rows are
  // off-screen at any given moment - skip drawing those entirely rather
  // than paying for dozens of invisible wave bands every frame
  for (let wy = OCEAN_Y0 - rowGap; wy < OCEAN_Y1 + rowGap; wy += rowGap) {
    const rowScreenY = wy - camY;
    if (rowScreenY < -100 || rowScreenY > canvas.height + 100) continue;
    const info = oceanRowWaveInfo(wy, t);
    drawScallopBand(camX, camY, wy + 16, info.phase, info.humpW, humpH * 0.85, 30, `rgba(20,80,110,${(0.55 + info.rowSeed * 0.15).toFixed(3)})`, info.tallEvery);
    drawScallopBand(camX, camY, wy, info.phase, info.humpW, humpH, 22, `rgba(120,200,225,${(0.5 + info.rowSeed * 0.15).toFixed(3)})`, info.tallEvery, true);
  }

  ctx.restore();
  ctx.restore();
}

// the sheer mountain wall marking the world's northern edge - a static,
// jagged gray-and-snow silhouette rather than anything climbable
function drawMountainWall(camX, camY) {
  const top = WORLD_TOP - camY;
  const h = MOUNTAIN_Y - WORLD_TOP;
  if (top > canvas.height || top + h < 0) return;

  ctx.fillStyle = '#5a5a56';
  ctx.fillRect(WORLD_LEFT - camX, top, WORLD_W - WORLD_LEFT, h);

  // peaks rise from the near edge (bottom of this band, adjacent to the
  // forest) up and away toward the world's true edge
  const bottom = top + h;
  const peakGap = 260;
  for (let px = WORLD_LEFT - 100; px < WORLD_W + 100; px += peakGap) {
    const wx = px - camX;
    const peakH = 90 + hashNoise(px, MOUNTAIN_Y) * 70;
    ctx.fillStyle = '#4a4a48';
    ctx.beginPath();
    ctx.moveTo(wx - peakGap * 0.6, bottom - 60);
    ctx.lineTo(wx, bottom - peakH - 60);
    ctx.lineTo(wx + peakGap * 0.6, bottom - 60);
    ctx.closePath();
    ctx.fill();

    // snow caps
    ctx.fillStyle = 'rgba(235,240,245,0.9)';
    ctx.beginPath();
    ctx.moveTo(wx - peakGap * 0.18, bottom - peakH * 0.62 - 60);
    ctx.lineTo(wx, bottom - peakH - 60);
    ctx.lineTo(wx + peakGap * 0.18, bottom - peakH * 0.62 - 60);
    ctx.closePath();
    ctx.fill();
  }
}

// same idea as drawMountainWall, rotated 90° - the sheer wall marking the
// world's eastern edge, peaks rising out from the near edge (adjacent to
// downtown/the south side) toward the true edge
function drawMountainWallEast(camX, camY) {
  const left = (WORLD_W - EAST_MOUNTAIN_DEPTH) - camX;
  const w = EAST_MOUNTAIN_DEPTH;
  if (left > canvas.width || left + w < 0) return;

  const top = MOUNTAIN_Y - camY, h = WORLD_H - MOUNTAIN_Y;
  ctx.fillStyle = '#5a5a56';
  ctx.fillRect(left, top, w, h);

  const peakGap = 260;
  for (let py = MOUNTAIN_Y - 100; py < WORLD_H + 100; py += peakGap) {
    const wy = py - camY;
    const peakW = 90 + hashNoise(WORLD_W, py) * 70;
    ctx.fillStyle = '#4a4a48';
    ctx.beginPath();
    ctx.moveTo(left + 60, wy - peakGap * 0.6);
    ctx.lineTo(left + peakW + 60, wy);
    ctx.lineTo(left + 60, wy + peakGap * 0.6);
    ctx.closePath();
    ctx.fill();

    // snow caps
    ctx.fillStyle = 'rgba(235,240,245,0.9)';
    ctx.beginPath();
    ctx.moveTo(left + peakW * 0.62 + 60, wy - peakGap * 0.18);
    ctx.lineTo(left + peakW + 60, wy);
    ctx.lineTo(left + peakW * 0.62 + 60, wy + peakGap * 0.18);
    ctx.closePath();
    ctx.fill();
  }
}

function drawParkGround(camX, camY) {
  const px = PARK.x - camX, py = PARK.y - camY;

  fillWorldPattern(GROUND_PATTERNS.park, camX, camY, px, py, PARK.w, PARK.h);

  const b = PARK_PATH_BAND;
  ctx.fillStyle = '#c8b585';

  ctx.fillRect(px, py + PARK.h/2 - b/2, PARK.w, b);
  ctx.fillRect(px + PARK.w/2 - b/2, py, b, PARK.h);

  const ring = {
    x: PARK_POND.x - 50, y: PARK_POND.y - 50,
    w: PARK_POND.w + 100, h: PARK_POND.h + 100
  };
  ctx.fillRect(px + ring.x, py + ring.y, ring.w, b);
  ctx.fillRect(px + ring.x, py + ring.y + ring.h - b, ring.w, b);
  ctx.fillRect(px + ring.x, py + ring.y, b, ring.h);
  ctx.fillRect(px + ring.x + ring.w - b, py + ring.y, b, ring.h);

  const pondCx = px + PARK_POND.x + PARK_POND.w/2, pondCy = py + PARK_POND.y + PARK_POND.h/2;
  const pondRx = PARK_POND.w/2, pondRy = PARK_POND.h/2;
  const pondGrad = ctx.createRadialGradient(pondCx - pondRx*0.3, pondCy - pondRy*0.35, 4, pondCx, pondCy, Math.max(pondRx, pondRy));
  pondGrad.addColorStop(0, '#5b93c2');
  pondGrad.addColorStop(0.55, '#3a6fa0');
  pondGrad.addColorStop(1, '#2c5580');
  ctx.fillStyle = pondGrad;
  ctx.beginPath();
  ctx.ellipse(pondCx, pondCy, pondRx, pondRy, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#2a5580';
  ctx.lineWidth = 3;
  ctx.stroke();

  // slow drifting shimmer streaks - a couple of soft light bands that ease
  // back and forth across the surface so the water doesn't sit dead flat
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(pondCx, pondCy, pondRx, pondRy, 0, 0, Math.PI*2);
  ctx.clip();
  const t = performance.now() / 1000;
  for (let i = 0; i < 3; i++) {
    const phase = t * 0.25 + i * 2.1;
    const sx = pondCx + Math.sin(phase) * pondRx * 0.6;
    const sy = pondCy + Math.cos(phase * 0.7) * pondRy * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.05 * Math.sin(phase * 1.3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, pondRx * 0.35, pondRy * 0.12, phase * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  PARK_BUSHES.forEach(bu => {
    ctx.fillStyle = '#2f5a2a';
    ctx.beginPath();
    ctx.arc(px + bu.x, py + bu.y, 12, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#3d6e37';
    ctx.beginPath();
    ctx.arc(px + bu.x - 3, py + bu.y - 3, 8, 0, Math.PI*2);
    ctx.fill();
  });
}

function drawTree(px, py, camX, camY, scale) {
  // pre-rendered layered canopy, tint picked from position (visuals.js)
  drawTreeSprite(LEAFY_TREE_SPRITES, px, py, camX, camY, scale);
}

function drawPineTree(px, py, camX, camY, scale) {
  drawTreeSprite(PINE_TREE_SPRITES, px, py, camX, camY, scale);
}

const CITY_TREES = [
  {"x":3146,"y":1657},{"x":3049,"y":658},{"x":234,"y":1532},{"x":2900,"y":1494},{"x":288,"y":143},
  {"x":1246,"y":2214},{"x":1635,"y":73},{"x":1579,"y":635},{"x":1785,"y":81},{"x":2737,"y":1175},
  {"x":3106,"y":1927},{"x":2896,"y":2200},{"x":3005,"y":1503},{"x":2225,"y":1195},{"x":2319,"y":86},
  {"x":2365,"y":1160},{"x":2730,"y":2176},{"x":2993,"y":1205},{"x":1329,"y":608},{"x":2780,"y":2251},
  {"x":750,"y":1646},{"x":191,"y":1359},{"x":322,"y":687},{"x":3122,"y":1782},{"x":1572,"y":142},
  {"x":2202,"y":2210},{"x":1157,"y":2197},{"x":3092,"y":2212},
  {"x":1868,"y":611},{"x":879,"y":2811},{"x":3496,"y":170},{"x":257,"y":2338},{"x":1668,"y":2972},
  {"x":4504,"y":1758},{"x":1347,"y":2899},{"x":3502,"y":1433},{"x":2316,"y":676},{"x":2980,"y":1448},
  {"x":3803,"y":2236},{"x":685,"y":2301},{"x":3002,"y":2404},{"x":1615,"y":2925},{"x":867,"y":1596},
  {"x":3028,"y":706},{"x":3072,"y":1495},{"x":1756,"y":2785},{"x":2227,"y":2914},{"x":624,"y":2535},
  {"x":1441,"y":2227},{"x":3826,"y":1594}
].map((t, i) => ({ ...t, pine: i % 3 === 0, scale: i % 4 === 1 ? 1.5 : 1 }));
const cityTreeObstacles = CITY_TREES.map(t => {
  const r = 6 * t.scale;
  return { x: t.x - r, y: t.y - r, w: r * 2, h: r * 2 };
});

// subtle asphalt wear patches, computed once up front rather than every
// frame - a fixed list of dark blotches scattered along each street, same
// idea as CITY_TREES, so the road doesn't read as one flat color block
const ROAD_WEAR_SPOTS = [];
NUMBERED_STREETS.forEach(s => {
  for (let i = 0; i < 50; i++) {
    ROAD_WEAR_SPOTS.push({ x: Math.random() * WORLD_W, y: s.y + Math.random() * ROAD_W, r: 6 + Math.random() * 12 });
  }
});
NAMED_STREETS.forEach(s => {
  for (let i = 0; i < 50; i++) {
    ROAD_WEAR_SPOTS.push({ x: s.x + Math.random() * ROAD_W, y: Math.random() * DOWNTOWN_H, r: 6 + Math.random() * 12 });
  }
});

// the south side's pavement is a lot more neglected - extra, bigger,
// darker potholes/cracks layered on top of the normal pass, on 5th/6th
// St and on the stretch of every named street south of the river
['5th St', '6th St'].forEach(name => {
  const s = NUMBERED_STREETS.find(st => st.name === name);
  for (let i = 0; i < 70; i++) {
    ROAD_WEAR_SPOTS.push({ x: Math.random() * WORLD_W, y: s.y + Math.random() * ROAD_W, r: 8 + Math.random() * 18, a: 0.16 + Math.random() * 0.12 });
  }
});
NAMED_STREETS.forEach(s => {
  for (let i = 0; i < 45; i++) {
    ROAD_WEAR_SPOTS.push({ x: s.x + Math.random() * ROAD_W, y: RIVER_Y + RIVER_H + Math.random() * (DOWNTOWN_H - RIVER_Y - RIVER_H), r: 8 + Math.random() * 18, a: 0.16 + Math.random() * 0.12 });
  }
});
