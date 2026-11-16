// =====================================================================
// People renderer: naturally proportioned (~6 heads tall) outlined
// figures with a crossing walk cycle, faces, hair styles and detailed
// outfits. Replaces drawDude for standing / walking / swimming / knocked
// down / riding-in-iso poses; lying in bed, sitting, and classic-view
// riding still use the original drawDude art (kept as drawDudeClassic).
// Feet are at y = 0, the figure stands ~48px tall.
// =====================================================================

const drawDudeClassic = drawDude;
drawDude = function (cx, cy, color, label, opts) {
  opts = opts || {};
  if (opts.lying || opts.sitting || (opts.riding && !opts.isoRide)) return drawDudeClassic(cx, cy, color, label, opts);
  drawPerson(cx, cy, color, label, opts);
};

function personHash(...parts) {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// which way the body is turned on screen: front/back + 3/4 turn (-1 left, 1 right)
function personView(facing) {
  const isoOut = typeof ISO_VIEW !== 'undefined' && ISO_VIEW && scene === 'outside';
  if (isoOut) {
    return { down: { front: true, turn: -1 }, right: { front: true, turn: 1 }, up: { front: false, turn: 1 }, left: { front: false, turn: -1 } }[facing] || { front: true, turn: -1 };
  }
  return { down: { front: true, turn: 0 }, up: { front: false, turn: 0 }, left: { front: true, turn: -1 }, right: { front: true, turn: 1 } }[facing] || { front: true, turn: 0 };
}

const PANTS_COLORS = ['#34445e', '#2a2a2e', '#4a5a78', '#8a7a5a', '#3a3a44', '#5a6a8a'];
const JEANS_COLORS = ['#3a5078', '#2a3a5a', '#5a72a0', '#1e2430'];
const SHOE_COLORS = ['#2a221c', '#1c1c1c', '#5a4030', '#e8e4dc', '#f2f2f0'];
const HEEL_COLORS = ['#1a1a1a', '#b0203a', '#d8c4b0', '#6a1a3a'];
const LIP_COLORS = ['#b8404e', '#c8506a', '#9a3040', '#d06a7a'];

function personOutfit(color, opts) {
  const h = personHash(color, opts.hairColor, opts.skinTone, opts.hairstyle);
  const h2 = personHash(opts.skinTone, color, 7);
  if (opts.gender === 'f') {
    const style = opts.skirt ? (h < 0.5 ? 'dress' : 'cropSkirt')
      : (h < 0.25 ? 'cropShorts' : h < 0.5 ? 'tankJeans' : h < 0.75 ? 'sweaterJeans' : 'dress');
    const jeans = style === 'tankJeans' || style === 'sweaterJeans';
    return {
      style,
      top: color,
      bottom: opts.skirt ? (opts.skirtColor || shadeColor(color, -25)) : jeans ? JEANS_COLORS[Math.floor(h2 * JEANS_COLORS.length)] : style === 'cropShorts' ? '#4a6a98' : shadeColor(color, -6),
      shoes: HEEL_COLORS[Math.floor(h2 * HEEL_COLORS.length)],
      lips: LIP_COLORS[Math.floor(h * LIP_COLORS.length)],
      sleeve: style === 'sweaterJeans' ? 'long' : (style === 'cropSkirt' || style === 'cropShorts') ? 'short' : null
    };
  }
  const style = h < 0.38 ? 'tee' : h < 0.6 ? 'shirt' : h < 0.8 ? 'jacket' : 'hoodie';
  return {
    style,
    top: color,
    jacket: shadeColor(color, -38),
    inner: h2 < 0.5 ? '#ece8e0' : '#2a2a30',
    bottom: h2 < 0.55 ? JEANS_COLORS[Math.floor(h * 7) % JEANS_COLORS.length] : PANTS_COLORS[Math.floor(h2 * PANTS_COLORS.length)],
    shoes: SHOE_COLORS[Math.floor(h * SHOE_COLORS.length)],
    sleeve: style === 'tee' ? 'short' : style === 'shirt' ? 'rolled' : 'long',
    beard: personHash(color, opts.skinTone, 'b') < 0.25
  };
}

const PERSON_LINE = 'rgba(30,18,12,0.55)';
function fillLine(fill, line) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = line || PERSON_LINE; ctx.stroke();
}
function lerpPt(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }

// tapered limb along a polyline with a width per point; rounded far end
function taperPath(pts, ws, flatEnd) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, hw = ws[i] / 2;
    L.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
    R.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  if (flatEnd) ctx.lineTo(R[n - 1][0], R[n - 1][1]);
  else {
    const e = pts[n - 1], ang = Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]);
    ctx.arc(e[0], e[1], ws[n - 1] / 2, ang, ang + Math.PI, true);
  }
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}

// kept for any old callers: plain tapered segment
function limb(x1, y1, w1, x2, y2, w2) { taperPath([[x1, y1], [x2, y2]], [w1, w2]); ctx.fill(); }

// body measurements, feet at y = 0
const PERSON_BODY = {
  m: { top: -48, headCY: -43.2, rx: 3.5, ry: 4.2, neckW: 3.4, shoulderY: -36.6, chestY: -31.6, waistY: -26.2, hipY: -22, crotchY: -19,
       ankleY: -2.2, shW: 8, chestW: 7.2, waistW: 6, hipW: 6.4, legX: 3.2, thighW: 5.8, kneeW: 4.2, calfW: 4.5, ankleW: 2.5,
       armW: 3.3, foreW: 2.7, upperArm: 8.2, armLen: 16 },
  f: { top: -46.5, headCY: -42, rx: 3.3, ry: 4.0, neckW: 2.6, shoulderY: -35.6, chestY: -31, waistY: -26.4, hipY: -21.6, crotchY: -18.6,
       ankleY: -2.8, shW: 6.3, chestW: 6.5, waistW: 4.2, hipW: 7.5, legX: 3.4, thighW: 5.6, kneeW: 3.3, calfW: 3.8, ankleW: 1.8,
       armW: 2.6, foreW: 2.1, upperArm: 7.6, armLen: 15 }
};

function drawPerson(cx, cy, color, label, opts) {
  const now = performance.now();
  const female = opts.gender === 'f';
  const B = PERSON_BODY[female ? 'f' : 'm'];
  const skin = opts.skinTone || '#f0c090';
  const skinShade = shadeColor(skin, -16);
  const hairColor = opts.hairColor || '#3a2a1a';
  const hairDark = shadeColor(hairColor, -24), hairLight = shadeColor(hairColor, 26);
  const style = opts.hairstyle || (female ? 'long' : 'square');
  const outfit = personOutfit(color || '#3a6fd8', opts);
  const view = personView(opts.facing || 'down');
  const t = view.turn, front = view.front;
  const riding = !!opts.riding;
  const scale = opts.kid ? 0.62 : opts.big ? 1.18 : riding ? 1.05 : 1;

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.knockedDown) { ctx.rotate(Math.PI / 2); ctx.translate(0, 8); }
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 0.6;

  // ground shadow
  if (!opts.swimming && !riding) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // walk cycle: s > 0 = right leg forward. Upper body rises as the legs pass.
  let s = 0, bob = 0;
  const walking = opts.moving && !opts.knockedDown && !riding && !opts.swimming;
  if (walking) { s = Math.sin(now / 1000 * 8.5); bob = (1 - Math.abs(s)) * 1.1; }
  else if (!riding) bob = Math.sin(now / 1000 * 1.6 + (cx + cy) * 0.05) * 0.3;
  if (opts.swimming) {
    ctx.save();
    ctx.translate(0, 30);
    ctx.beginPath(); ctx.rect(-30, -90, 60, 87); ctx.clip();
  }

  // upper body landmarks (shifted down onto the seat when riding)
  const U = (riding ? -14 - B.hipY : 0) - bob;
  const hipY = B.hipY + U, crotchY = B.crotchY + U, waistY = B.waistY + U, chestY = B.chestY + U, shoulderY = B.shoulderY + U;
  const headCY = B.headCY + U, topY = B.top + U;
  const bx = t * 0.5;
  const { shW, chestW, waistW, hipW, rx, ry } = B;

  const bareLegs = opts.bikini || (female && (outfit.style === 'dress' || outfit.style === 'cropSkirt' || outfit.style === 'cropShorts'));
  const shorts = opts.bikini ? !female : outfit.style === 'cropShorts';

  // ---- legs --------------------------------------------------------
  const legs = [-1, 1].map(side => {
    const st = s * side; // + = this leg is stepping forward
    const hx = bx + side * B.legX;
    let kx, ky, ax, ay;
    if (riding) {
      kx = hx + side * 2.2 + t * 5; ky = hipY - 1 + (front ? 1.5 : -1.5);
      ax = hx + side * 2 + t * 3.5; ay = -4;
    } else {
      const depth = (front ? 1 : -1) * st * 1.8;
      ax = side * B.legX * 0.92 + t * st * 3.2 - (female ? side * Math.max(0, st) * 1.7 : 0);
      ay = B.ankleY + depth;
      kx = (hx + ax) / 2 + t * Math.max(0, st) * 1.3 - (female ? side * 0.5 : 0);
      ky = hipY + (ay - hipY) * 0.52;
    }
    return { side, st, hx, hy: hipY, kx, ky, ax, ay, depth: riding ? side * t : (front ? st : -st) };
  }).sort((a, b) => a.depth - b.depth);

  const drawShoe = L => {
    const trailing = !riding && L.st < -0.3;
    const sx = L.ax + t * 0.9, sy = L.ay + (trailing ? 1.2 : 1.6);
    ctx.lineWidth = 0.6;
    if (female) {
      ctx.beginPath(); ctx.ellipse(sx + t * 0.3, sy, t ? 1.9 : 1.4, trailing ? 1.0 : 1.2, 0, 0, Math.PI * 2);
      fillLine(outfit.shoes);
      if (!trailing) {
        ctx.strokeStyle = outfit.shoes; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(L.ax - (t || 1) * 0.9, sy - 0.2); ctx.lineTo(L.ax - (t || 1) * 1.1, sy + 2); ctx.stroke(); // stiletto
      }
      ctx.strokeStyle = shadeColor(outfit.shoes, -30); ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(L.ax - 1, L.ay - 0.2); ctx.lineTo(L.ax + 1, L.ay - 0.2); ctx.stroke(); // ankle strap
    } else {
      const w = t ? 2.9 : 2.1;
      ctx.beginPath(); ctx.ellipse(sx + t * 0.6, sy, w, trailing ? 1.1 : 1.45, 0, 0, Math.PI * 2);
      fillLine(outfit.shoes);
      ctx.strokeStyle = outfit.shoes === '#e8e4dc' || outfit.shoes === '#f2f2f0' ? '#b8b4ac' : '#d8d4cc';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(sx + t * 0.6 - w + 0.5, sy + 0.9); ctx.lineTo(sx + t * 0.6 + w - 0.5, sy + 0.9); ctx.stroke(); // sole
    }
  };

  const drawLeg = L => {
    const hip = [L.hx, L.hy], knee = [L.kx, L.ky], ankle = [L.ax, L.ay];
    const pts = [hip, lerpPt(hip, knee, 0.5), knee, lerpPt(knee, ankle, 0.32), ankle];
    const ws = [B.thighW, B.thighW * 0.86, B.kneeW, B.calfW, B.ankleW];
    ctx.lineWidth = 0.6;
    taperPath(pts, ws);
    fillLine(bareLegs ? skin : outfit.bottom);
    if (bareLegs) {
      // soft shine down the front of the leg
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(...lerpPt(hip, knee, 0.25)); ctx.lineTo(knee[0] - 0.4 * L.side, knee[1]); ctx.lineTo(...lerpPt(knee, ankle, 0.6)); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 0.5; // kneecap
      ctx.beginPath(); ctx.arc(knee[0], knee[1] + 0.4, 0.9, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      // trouser crease + knee wrinkles
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(...lerpPt(hip, knee, 0.2)); ctx.lineTo(...knee); ctx.lineTo(...lerpPt(knee, ankle, 0.9)); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(knee[0] - 1.4, knee[1] - 0.8); ctx.quadraticCurveTo(knee[0], knee[1] - 0.2, knee[0] + 1.3, knee[1] - 1.1);
      ctx.moveTo(knee[0] - 1.2, knee[1] + 0.8); ctx.quadraticCurveTo(knee[0], knee[1] + 1.3, knee[0] + 1.2, knee[1] + 0.6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.6; // hem cuff
      ctx.beginPath(); ctx.moveTo(L.ax - B.ankleW / 2 - 0.2, L.ay - 1.2); ctx.lineTo(L.ax + B.ankleW / 2 + 0.2, L.ay - 1.2); ctx.stroke();
    }
    if (shorts) {
      const end = lerpPt(hip, knee, opts.bikini ? 0.35 : 0.3);
      ctx.lineWidth = 0.6;
      taperPath([[hip[0], hip[1] - 1], end], [B.thighW + 1.2, B.thighW + 0.6], true);
      fillLine(opts.bikini ? (opts.bikiniColor || '#3a6ab0') : outfit.bottom);
      if (!opts.bikini) { // frayed denim hem
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(end[0] - 3, end[1] - 0.3); ctx.lineTo(end[0] + 3, end[1] - 0.3); ctx.stroke();
      }
    }
    drawShoe(L);
  };

  // ---- torso -------------------------------------------------------
  const torsoPath = () => {
    ctx.beginPath();
    if (female) {
      ctx.moveTo(bx - 1.6, shoulderY - 1.6);
      ctx.quadraticCurveTo(bx - shW + 1.4, shoulderY - 1.1, bx - shW, shoulderY + 1.1);
      ctx.quadraticCurveTo(bx - shW - 0.5, shoulderY + 3.6, bx - chestW, chestY);
      ctx.quadraticCurveTo(bx - chestW + 0.3, chestY + 3, bx - waistW, waistY);
      ctx.quadraticCurveTo(bx - hipW - 0.4, waistY + 2.6, bx - hipW, hipY);
      ctx.quadraticCurveTo(bx - hipW, hipY + 1.6, bx - hipW + 1.2, hipY + 2);
      ctx.lineTo(bx + hipW - 1.2, hipY + 2);
      ctx.quadraticCurveTo(bx + hipW, hipY + 1.6, bx + hipW, hipY);
      ctx.quadraticCurveTo(bx + hipW + 0.4, waistY + 2.6, bx + waistW, waistY);
      ctx.quadraticCurveTo(bx + chestW - 0.3, chestY + 3, bx + chestW, chestY);
      ctx.quadraticCurveTo(bx + shW + 0.5, shoulderY + 3.6, bx + shW, shoulderY + 1.1);
      ctx.quadraticCurveTo(bx + shW - 1.4, shoulderY - 1.1, bx + 1.6, shoulderY - 1.6);
    } else {
      ctx.moveTo(bx - 2.2, shoulderY - 1.8);
      ctx.quadraticCurveTo(bx - shW + 1.6, shoulderY - 1.2, bx - shW, shoulderY + 1.4);
      ctx.quadraticCurveTo(bx - shW - 0.7, shoulderY + 4, bx - chestW, chestY + 1);
      ctx.quadraticCurveTo(bx - waistW - 0.4, waistY - 1, bx - waistW, waistY);
      ctx.lineTo(bx - hipW, hipY + 1.6);
      ctx.lineTo(bx + hipW, hipY + 1.6);
      ctx.lineTo(bx + waistW, waistY);
      ctx.quadraticCurveTo(bx + waistW + 0.4, waistY - 1, bx + chestW, chestY + 1);
      ctx.quadraticCurveTo(bx + shW + 0.7, shoulderY + 4, bx + shW, shoulderY + 1.4);
      ctx.quadraticCurveTo(bx + shW - 1.6, shoulderY - 1.2, bx + 2.2, shoulderY - 1.8);
    }
    ctx.closePath();
  };

  const topGrad = (c) => {
    const g = ctx.createLinearGradient(bx - 9, shoulderY, bx + 9, hipY);
    g.addColorStop(0, shadeColor(c, 16)); g.addColorStop(1, shadeColor(c, -18));
    return g;
  };
  const line = (pts, stroke, w) => {
    ctx.strokeStyle = stroke; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  const fold = 'rgba(0,0,0,0.16)', seam = 'rgba(0,0,0,0.3)';
  const neckX = bx + t * 0.5;

  const torsoDraw = () => {
    ctx.fillStyle = skin;
    torsoPath(); ctx.fill();
    ctx.save();
    torsoPath(); ctx.clip();
    const st = outfit.style;
    if (opts.bikini) {
      ctx.fillStyle = opts.bikiniColor || '#c25f8f';
      if (female) {
        if (front) {
          ctx.beginPath(); ctx.ellipse(bx - 2.4 + t * 0.4, chestY + 0.3, 2.6, 2.1, 0.2, 0, Math.PI * 2); ctx.ellipse(bx + 2.4 + t * 0.4, chestY + 0.3, 2.6, 2.1, -0.2, 0, Math.PI * 2); ctx.fill();
          line([[bx - 2.4, chestY - 1.6], [bx - shW + 2, shoulderY - 0.5]], ctx.fillStyle, 0.5);
          line([[bx + 2.4, chestY - 1.6], [bx + shW - 2, shoulderY - 0.5]], ctx.fillStyle, 0.5);
        } else ctx.fillRect(bx - 9, chestY - 0.8, 18, 1.8);
        ctx.beginPath(); ctx.moveTo(bx - hipW - 1, hipY - 2.6); ctx.lineTo(bx + hipW + 1, hipY - 2.6); ctx.lineTo(bx + 2, hipY + 2.5); ctx.lineTo(bx - 2, hipY + 2.5); ctx.fill();
      } else {
        ctx.fillRect(bx - 12, hipY - 3, 24, 6);
      }
      if (front) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(bx + t * 0.5, waistY + 1.5, 0.5, 0, Math.PI * 2); ctx.fill(); } // navel
    } else if (female) {
      // bottoms first (waistband up near the waist)
      const beltY = st === 'tankJeans' || st === 'sweaterJeans' ? waistY + 1.6 : waistY + 1.2;
      if (st !== 'dress') { ctx.fillStyle = outfit.bottom; ctx.fillRect(bx - 12, beltY, 24, 14); }
      // top
      const crop = st === 'cropSkirt' || st === 'cropShorts';
      const hem = st === 'dress' ? hipY + 4 : crop ? waistY - 1.4 : st === 'tankJeans' ? beltY : hipY - 0.6;
      const strap = st === 'dress' || st === 'tankJeans';
      ctx.fillStyle = topGrad(outfit.top);
      ctx.beginPath();
      if (strap) {
        // thin straps leave the shoulders bare; scoop / V neckline in front
        ctx.moveTo(bx - shW - 2, shoulderY + 3.4); ctx.lineTo(bx - 3.6, shoulderY - 1.4); ctx.lineTo(bx - 2.6, shoulderY - 1.4);
        if (front) ctx.quadraticCurveTo(bx - 2.2 + t * 0.4, chestY - 1.2, bx + t * 0.4, chestY - 1.2), ctx.quadraticCurveTo(bx + 2.2 + t * 0.4, chestY - 1.2, bx + 2.6, shoulderY - 1.4);
        else ctx.quadraticCurveTo(bx, shoulderY + 3.5, bx + 2.6, shoulderY - 1.4);
        ctx.lineTo(bx + 3.6, shoulderY - 1.4); ctx.lineTo(bx + shW + 2, shoulderY + 3.4);
      } else {
        ctx.moveTo(bx - 12, shoulderY - 4); ctx.lineTo(bx - 2.1, shoulderY - 4);
        ctx.lineTo(bx - 2.1, shoulderY - 1.6);
        if (front) ctx.quadraticCurveTo(bx + t * 0.4, shoulderY + 2.8, bx + 2.1, shoulderY - 1.6);
        else ctx.quadraticCurveTo(bx, shoulderY - 0.6, bx + 2.1, shoulderY - 1.6);
        ctx.lineTo(bx + 2.1, shoulderY - 4); ctx.lineTo(bx + 12, shoulderY - 4);
      }
      ctx.lineTo(bx + 12, hem); ctx.lineTo(bx - 12, hem); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = seam; ctx.lineWidth = 0.45; ctx.stroke();
      if (front) {
        // bust: soft highlight + underside shadow and a few drape folds
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.ellipse(bx - 2.3 + t * 0.6, chestY - 0.4, 2, 1.3, 0, 0, Math.PI * 2); ctx.ellipse(bx + 2.3 + t * 0.6, chestY - 0.4, 2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
        line([[bx - 4.2 + t * 0.4, chestY + 1.4], [bx - 0.3 + t * 0.4, chestY + 2.1], [bx + 4.2 + t * 0.4, chestY + 1.4]], 'rgba(0,0,0,0.18)', 0.6);
        line([[bx - waistW + 0.6, waistY - 1.5], [bx - 1, chestY + 3.5]], fold, 0.45);
      } else {
        // spine + shoulder blades
        line([[bx, shoulderY + 1.5], [bx, waistY + 0.5]], fold, 0.45);
        line([[bx - 3.5, chestY - 1.8], [bx - 1.6, chestY + 0.6]], fold, 0.45);
        line([[bx + 3.5, chestY - 1.8], [bx + 1.6, chestY + 0.6]], fold, 0.45);
      }
      if (crop && front) { ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.arc(bx + t * 0.4, waistY + 0.2, 0.45, 0, Math.PI * 2); ctx.fill(); }
      if (st === 'dress') { line([[bx - 6, waistY + 0.6], [bx + 6, waistY + 0.6]], 'rgba(0,0,0,0.25)', 0.6); }
      else if (st !== 'cropSkirt') {
        line([[bx - 9, beltY + 0.4], [bx + 9, beltY + 0.4]], 'rgba(0,0,0,0.3)', 0.7); // waistband
        if (front) {
          line([[bx + t * 0.4, beltY + 0.8], [bx + t * 0.4, crotchY]], 'rgba(0,0,0,0.25)', 0.45); // fly
          ctx.fillStyle = '#c8b070'; ctx.fillRect(bx + t * 0.4 - 0.4, beltY + 0.1, 0.8, 0.8); // button
        }
      }
    } else {
      // men: trousers + belt
      const beltY = hipY - 3.2;
      ctx.fillStyle = outfit.bottom; ctx.fillRect(bx - 12, beltY, 24, 10);
      ctx.fillStyle = '#2a2018'; ctx.fillRect(bx - 12, beltY, 24, 1.3);
      if (front) {
        ctx.fillStyle = '#b8a070'; ctx.fillRect(bx + t * 0.5 - 0.9, beltY - 0.1, 1.8, 1.5); // buckle
        line([[bx + t * 0.5, beltY + 1.4], [bx + t * 0.5, crotchY + 0.5]], 'rgba(0,0,0,0.28)', 0.45);
        line([[bx - hipW + 0.6, beltY + 1.4], [bx - hipW + 2.4, hipY + 0.6]], 'rgba(0,0,0,0.22)', 0.45); // front pockets
        line([[bx + hipW - 0.6, beltY + 1.4], [bx + hipW - 2.4, hipY + 0.6]], 'rgba(0,0,0,0.22)', 0.45);
      }
      const hem = st === 'shirt' ? beltY : st === 'jacket' ? hipY + 0.6 : hipY - 0.6;
      const base = st === 'jacket' ? outfit.inner : outfit.top;
      ctx.fillStyle = topGrad(base);
      ctx.fillRect(bx - 12, shoulderY - 4, 24, hem - shoulderY + 4);
      line([[bx - 12, hem], [bx + 12, hem]], seam, 0.5);
      if (st === 'jacket') {
        // open jacket: two panels with lapels, inner tee showing down the middle
        ctx.fillStyle = topGrad(outfit.jacket);
        if (front) {
          ctx.beginPath();
          ctx.moveTo(bx - 12, shoulderY - 4); ctx.lineTo(bx - 2.4, shoulderY - 2); ctx.lineTo(bx - 1.6 + t * 0.4, waistY + 1); ctx.lineTo(bx - 2 + t * 0.4, hem); ctx.lineTo(bx - 12, hem); ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(bx + 12, shoulderY - 4); ctx.lineTo(bx + 2.4, shoulderY - 2); ctx.lineTo(bx + 1.6 + t * 0.4, waistY + 1); ctx.lineTo(bx + 2 + t * 0.4, hem); ctx.lineTo(bx + 12, hem); ctx.closePath(); ctx.fill();
          // lapels
          ctx.fillStyle = shadeColor(outfit.jacket, -14);
          ctx.beginPath(); ctx.moveTo(bx - 2.4, shoulderY - 1.8); ctx.lineTo(bx - 4.4, shoulderY + 0.8); ctx.lineTo(bx - 2.4, chestY + 2.5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(bx + 2.4, shoulderY - 1.8); ctx.lineTo(bx + 4.4, shoulderY + 0.8); ctx.lineTo(bx + 2.4, chestY + 2.5); ctx.closePath(); ctx.fill();
          line([[bx - 1.6 + t * 0.4, waistY + 1], [bx - 2 + t * 0.4, hem]], seam, 0.5);
          line([[bx + 1.6 + t * 0.4, waistY + 1], [bx + 2 + t * 0.4, hem]], seam, 0.5);
          line([[bx - 5.6, waistY + 1.5], [bx - 3.4, waistY + 1.5]], seam, 0.45); // pocket flaps
          line([[bx + 3.4, waistY + 1.5], [bx + 5.6, waistY + 1.5]], seam, 0.45);
        } else {
          ctx.fillRect(bx - 12, shoulderY - 4, 24, hem - shoulderY + 4);
          line([[bx, shoulderY - 1], [bx, hem]], seam, 0.45);
          ctx.fillStyle = shadeColor(outfit.jacket, -14); ctx.fillRect(bx - 3, shoulderY - 2, 6, 1.6); // collar
        }
      } else if (st === 'shirt') {
        if (front) {
          // collar points, placket + buttons
          ctx.fillStyle = shadeColor(outfit.top, 22);
          ctx.beginPath(); ctx.moveTo(bx - 2.4, shoulderY - 1.9); ctx.lineTo(bx - 3.4, shoulderY + 0.9); ctx.lineTo(bx + t * 0.5, shoulderY + 1.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = seam; ctx.lineWidth = 0.4; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + 2.4, shoulderY - 1.9); ctx.lineTo(bx + 3.4, shoulderY + 0.9); ctx.lineTo(bx + t * 0.5, shoulderY + 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
          line([[bx + t * 0.5, shoulderY + 1.2], [bx + t * 0.5, beltY]], seam, 0.45);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          for (let by = shoulderY + 3; by < beltY - 0.5; by += 2.7) ctx.fillRect(bx + t * 0.5 + 0.35, by, 0.6, 0.6);
          line([[bx - 5.4, chestY - 1.4], [bx - 2.2, chestY - 1.4], [bx - 2.2, chestY + 1.2], [bx - 5.4, chestY + 1.2]], 'rgba(0,0,0,0.2)', 0.4); // chest pocket
        } else {
          line([[bx - shW + 0.6, shoulderY + 2.2], [bx + shW - 0.6, shoulderY + 2.2]], seam, 0.45); // yoke
          line([[bx, shoulderY + 2.2], [bx, shoulderY + 4]], fold, 0.45);
          ctx.fillStyle = shadeColor(outfit.top, 22); ctx.fillRect(bx - 2.8, shoulderY - 2.2, 5.6, 1.5);
        }
      } else if (st === 'hoodie') {
        ctx.fillStyle = shadeColor(outfit.top, -16);
        if (front) {
          // hood ring around the neck, kangaroo pocket, drawstrings
          ctx.beginPath(); ctx.ellipse(neckX, shoulderY - 1, 4.4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(neckX, shoulderY - 1.6, 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
          line([[neckX - 1.2, shoulderY + 1], [neckX - 1.4, chestY + 1.6]], '#e8e4dc', 0.5);
          line([[neckX + 1.2, shoulderY + 1], [neckX + 1.4, chestY + 1.6]], '#e8e4dc', 0.5);
          ctx.beginPath(); ctx.moveTo(bx - 3.6, waistY - 0.5); ctx.lineTo(bx + 3.6, waistY - 0.5); ctx.lineTo(bx + 5, hipY - 1.4); ctx.lineTo(bx - 5, hipY - 1.4); ctx.closePath();
          ctx.strokeStyle = seam; ctx.lineWidth = 0.45; ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(bx - 4.2, shoulderY - 1.5); ctx.quadraticCurveTo(bx - 4.6, chestY + 0.5, bx, chestY + 1.6); ctx.quadraticCurveTo(bx + 4.6, chestY + 0.5, bx + 4.2, shoulderY - 1.5); ctx.closePath();
          ctx.fill(); ctx.strokeStyle = seam; ctx.lineWidth = 0.45; ctx.stroke();
        }
        ctx.fillStyle = shadeColor(outfit.top, -10); ctx.fillRect(bx - 12, hem - 1.4, 24, 1.4); // ribbed hem
      } else {
        // tee: crew neck + drape folds
        if (front) {
          ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(neckX, shoulderY - 1.8, 2.3, 2.2, 0, 0, Math.PI); ctx.fill();
          ctx.strokeStyle = shadeColor(outfit.top, -25); ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.ellipse(neckX, shoulderY - 1.8, 2.3, 2.2, 0, 0, Math.PI); ctx.stroke();
        } else line([[bx - 2.2, shoulderY - 1.4], [bx + 2.2, shoulderY - 1.4]], shadeColor(outfit.top, -25), 0.7);
      }
      if (st !== 'jacket') {
        line([[bx - chestW + 1.2, chestY + 1.5], [bx - 2, waistY + 0.6]], fold, 0.45);
        line([[bx + chestW - 1.2, chestY + 1.5], [bx + 2.5, waistY - 0.4]], fold, 0.45);
      }
      if (front && st === 'tee') line([[bx - 3.8, chestY + 0.6], [bx - 0.6, chestY + 1.2]], fold, 0.4);
    }
    ctx.restore();
    ctx.strokeStyle = PERSON_LINE; ctx.lineWidth = 0.6;
    torsoPath(); ctx.stroke();

    // back pockets on jeans / trousers
    if (!front && !opts.bikini && !(female && outfit.style !== 'tankJeans' && outfit.style !== 'sweaterJeans')) {
      [-1, 1].forEach(sd => {
        const px = bx + sd * 2.9, py = hipY - (female ? 1.6 : 1.8);
        ctx.beginPath(); ctx.moveTo(px - 1.8, py); ctx.lineTo(px + 1.8, py); ctx.lineTo(px + 1.6, py + 2.6); ctx.lineTo(px, py + 3.4); ctx.lineTo(px - 1.6, py + 2.6); ctx.closePath();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.45; ctx.stroke();
      });
      if (female) line([[bx, hipY - 2], [bx, crotchY + 0.6]], 'rgba(0,0,0,0.25)', 0.5);
    }

    // skirts flare out over the thighs and sway with the stride
    if (female && !opts.bikini && (outfit.style === 'dress' || outfit.style === 'cropSkirt')) {
      const top = outfit.style === 'dress' ? waistY + 0.6 : waistY + 1.2;
      const hemY = outfit.style === 'dress' ? hipY + 10.5 : crotchY + 4.6;
      const sway = s * 0.9 + t * 0.6;
      ctx.beginPath();
      ctx.moveTo(bx - waistW - 0.2, top);
      ctx.quadraticCurveTo(bx - hipW - 0.6, hipY - 1.5, bx - hipW - 1.6 + sway, hemY);
      ctx.quadraticCurveTo(bx + sway, hemY + 1.3, bx + hipW + 1.6 + sway, hemY);
      ctx.quadraticCurveTo(bx + hipW + 0.6, hipY - 1.5, bx + waistW + 0.2, top);
      ctx.closePath();
      ctx.lineWidth = 0.6;
      fillLine(outfit.style === 'dress' ? shadeColor(outfit.top, -6) : outfit.bottom);
      [-2.6, 0.4, 3.2].forEach(fx => line([[bx + fx * 0.6, hipY - 0.5], [bx + fx + sway * 0.8, hemY + 0.3]], 'rgba(0,0,0,0.17)', 0.5));
      if (outfit.style === 'cropSkirt') line([[bx - waistW - 0.4, top + 0.6], [bx + waistW + 0.4, top + 0.6]], 'rgba(0,0,0,0.3)', 0.6);
    }
  };

  // ---- arms --------------------------------------------------------
  const gunSide = t >= 0 ? 1 : -1;
  const armDraw = (side) => {
    const sx = bx + side * (shW - 0.9), sy = shoulderY + 1.6;
    let ex, ey, wx, wy;
    if (riding) {
      wx = bx + side * 4.2 + t * 7.5; wy = hipY - 6.5;
      ex = sx + side * 2 + t * 2.5; ey = sy + 6;
    } else if (opts.gunEquipped && side === gunSide) {
      wx = sx + (t || side) * 4.5; wy = sy + B.armLen - 5;
      ex = sx + side * 1.5 + t * 0.5; ey = sy + B.upperArm - 1;
    } else {
      const as = -s * side;
      wx = sx + side * (female ? 1.1 : 1.6) + t * as * 3;
      wy = sy + B.armLen + (front ? 1 : -1) * as * 1.1 - Math.abs(as) * 0.9;
      ex = sx + side * (female ? 1.2 : 1.6) + t * as * 1.2;
      ey = sy + B.upperArm + (front ? 1 : -1) * as * 0.4;
    }
    const sh = [sx, sy], el = [ex, ey], wr = [wx, wy];
    const armColor = (outfit.sleeve === 'long' && !opts.bikini) ? (outfit.style === 'jacket' ? outfit.jacket : outfit.top) : skin;
    ctx.lineWidth = 0.6;
    taperPath([sh, el, wr], [B.armW, B.armW * 0.84, B.foreW * 0.82]);
    fillLine(armColor);
    if (!opts.bikini && outfit.sleeve === 'short') {
      taperPath([[sx, sy - 0.6], lerpPt(sh, el, 0.55)], [B.armW + 1.6, B.armW + 1.1], true); fillLine(outfit.top);
    } else if (!opts.bikini && outfit.sleeve === 'rolled') {
      taperPath([[sx, sy - 0.6], lerpPt(sh, el, 0.95)], [B.armW + 1.2, B.armW + 0.8], true); fillLine(outfit.top);
      taperPath([lerpPt(sh, el, 0.78), lerpPt(sh, el, 1.02)], [B.armW + 1.3, B.armW + 1.1], true); fillLine(shadeColor(outfit.top, -10)); // rolled cuff
    } else if (armColor !== skin) {
      line([lerpPt(el, wr, 0.82).map((v, i) => v + (i ? 0 : -1.4)), lerpPt(el, wr, 0.82).map((v, i) => v + (i ? 0 : 1.4))], 'rgba(0,0,0,0.3)', 0.5); // cuff
      line([lerpPt(sh, el, 0.8), [ex + side * 0.3, ey + 0.6], lerpPt(el, wr, 0.2)], 'rgba(0,0,0,0.18)', 0.45); // elbow crease
    }
    // hand
    const hx = wx + t * 0.2, hy = wy + 1.3;
    ctx.beginPath(); ctx.ellipse(hx, hy, female ? 0.95 : 1.2, female ? 1.5 : 1.7, 0, 0, Math.PI * 2);
    fillLine(skin);
    if (opts.gunEquipped && side === gunSide && !riding) {
      const d = t || side;
      ctx.fillStyle = '#1e1e22';
      ctx.fillRect(hx - (d < 0 ? 6.5 : 0.5), hy - 1.6, 7, 2.2);
      ctx.fillRect(hx - 0.8, hy - 1.2, 1.8, 3.2);
      if (opts.muzzleFlash) {
        ctx.fillStyle = '#ffe680';
        ctx.beginPath(); ctx.arc(hx + d * 8.5, hy - 0.5, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  // ---- head + hair ---------------------------------------------------
  const hx = bx + t * 0.7, hy = headCY;

  const hairBack = () => {
    // hair that hangs behind the shoulders (front view)
    ctx.lineWidth = 0.6;
    if (female && style === 'long') {
      ctx.beginPath();
      ctx.moveTo(hx - rx - 0.6, hy - 1);
      ctx.quadraticCurveTo(hx - rx - 2.2, hy + 5, hx - rx - 1.4, shoulderY + 6.5);
      ctx.lineTo(hx + rx + 1.4, shoulderY + 6.5);
      ctx.quadraticCurveTo(hx + rx + 2.2, hy + 5, hx + rx + 0.6, hy - 1);
      ctx.closePath(); fillLine(hairDark);
    } else if (female && style === 'bowl') {
      const px = hx - (t || 1) * (rx - 0.2);
      ctx.beginPath(); ctx.moveTo(px - 1, hy - 1); ctx.quadraticCurveTo(px - (t || 1) * 1.6, hy + 5, px - (t || 1) * 0.8 + s * 0.5, shoulderY + 4); ctx.quadraticCurveTo(px + 0.6, hy + 4, px + 1, hy - 1); ctx.closePath();
      fillLine(hairDark);
    } else if (!female && style === 'long') {
      ctx.beginPath(); ctx.ellipse(hx, hy + 1.5, rx + 1.2, ry + 1.4, 0, 0, Math.PI * 2); fillLine(hairDark);
    }
  };

  const headDraw = () => {
    ctx.lineWidth = 0.6;
    // neck
    ctx.beginPath();
    ctx.moveTo(hx - B.neckW / 2, hy + ry - 1.4); ctx.lineTo(hx + B.neckW / 2, hy + ry - 1.4);
    ctx.lineTo(neckX + B.neckW / 2 + 0.3, shoulderY - 0.8); ctx.lineTo(neckX - B.neckW / 2 - 0.3, shoulderY - 0.8);
    ctx.closePath(); fillLine(skinShade);
    // ears
    if (!(female && (style === 'long' || style === 'square'))) {
      [-1, 1].forEach(sd => {
        if (front && t && sd === -t) return;
        ctx.beginPath(); ctx.ellipse(hx + sd * rx, hy + 0.3, 0.8, 1.2, 0, 0, Math.PI * 2); fillLine(skinShade);
      });
    }
    // skull + jaw
    ctx.beginPath();
    ctx.ellipse(hx, hy - 0.3, rx, ry * 0.92, 0, Math.PI, 0);
    ctx.quadraticCurveTo(hx + rx, hy + ry * 0.62, hx + rx * (female ? 0.38 : 0.5) + t * 0.4, hy + ry);
    ctx.quadraticCurveTo(hx + t * 0.5, hy + ry + (female ? 0.5 : 0.3), hx - rx * (female ? 0.38 : 0.5) + t * 0.4, hy + ry);
    ctx.quadraticCurveTo(hx - rx, hy + ry * 0.62, hx - rx, hy - 0.3);
    ctx.closePath(); fillLine(skin);
    if (!front) return;
    const fx = hx + t * 1.1;
    if (!female && outfit.beard) {
      ctx.fillStyle = 'rgba(40,28,20,0.32)';
      ctx.beginPath(); ctx.moveTo(fx - rx + 0.7, hy + 1); ctx.quadraticCurveTo(fx - rx + 1, hy + ry, fx, hy + ry + 0.2); ctx.quadraticCurveTo(fx + rx - 1, hy + ry, fx + rx - 0.7, hy + 1);
      ctx.lineTo(fx + 1.6, hy + 2.6); ctx.lineTo(fx - 1.6, hy + 2.6); ctx.closePath(); ctx.fill();
    }
    // eyes, brows
    [-1, 1].forEach(sd => {
      const far = t !== 0 && sd === -t;
      const ex = fx + sd * 1.45 * (far ? 0.72 : 1), ey = hy + 0.3, ew = far ? 0.65 : 0.85;
      ctx.fillStyle = '#f6f2ee';
      ctx.beginPath(); ctx.ellipse(ex, ey, ew, 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1e18';
      ctx.beginPath(); ctx.arc(ex + t * 0.25, ey + 0.05, 0.48, 0, Math.PI * 2); ctx.fill();
      if (female) {
        line([[ex - ew - 0.1, ey - 0.25], [ex, ey - 0.65], [ex + ew + 0.35, ey - 0.45]], '#120a08', 0.55); // lashes
        line([[ex - 0.8, ey - 1.5], [ex, ey - 1.85], [ex + 0.9, ey - 1.55]], hairDark, 0.4);
      } else {
        line([[ex - 0.6 + sd * 0.25, ey - 1.2], [ex + 0.7 + sd * 0.25, ey - 1.35 + sd * 0.1]], hairDark, 0.6);
      }
    });
    // nose
    line([[fx + t * 0.5, hy + 0.7], [fx + t * 0.9, hy + 1.9], [fx + t * 0.1, hy + 2.1]], 'rgba(0,0,0,0.25)', 0.4);
    // mouth
    if (female) {
      ctx.fillStyle = outfit.lips;
      ctx.beginPath(); ctx.ellipse(fx + t * 0.3, hy + 3.05, 0.95, 0.45, 0, 0, Math.PI * 2); ctx.fill();
      line([[fx + t * 0.3 - 0.9, hy + 3.0], [fx + t * 0.3 + 0.9, hy + 3.0]], shadeColor(outfit.lips, -35), 0.3);
      ctx.fillStyle = 'rgba(230,110,110,0.2)';
      ctx.beginPath(); ctx.arc(fx - 2, hy + 1.9, 0.8, 0, Math.PI * 2); ctx.arc(fx + 2, hy + 1.9, 0.8, 0, Math.PI * 2); ctx.fill();
    } else {
      line([[fx + t * 0.3 - 0.9, hy + 3], [fx + t * 0.3 + 0.9, hy + 2.9]], 'rgba(80,40,30,0.6)', 0.5);
    }
  };

  const strands = (pts, color, w) => { pts.forEach(p => line(p, color, w)); };

  const hairFront = () => {
    ctx.lineWidth = 0.6;
    if (style === 'bald') {
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(hx - 1, hy - 3, 1.5, 0.8, -0.4, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const R = rx + 0.55, RY = ry + 0.5;
    // crown cap with a hairline across the forehead (front) or full back of head
    const capFront = (hairlineY, sideY) => {
      ctx.beginPath();
      ctx.moveTo(hx - R, sideY);
      ctx.lineTo(hx - R, hy - 0.4);
      ctx.ellipse(hx, hy - 0.4, R, RY, 0, Math.PI, 0);
      ctx.lineTo(hx + R, sideY);
      ctx.lineTo(hx + rx - 0.4, sideY);
      ctx.quadraticCurveTo(hx + rx * 0.8, hairlineY - 0.6, hx + t * 0.8, hairlineY);
      ctx.quadraticCurveTo(hx - rx * 0.8, hairlineY - 0.6, hx - rx + 0.4, sideY);
      ctx.closePath(); fillLine(hairColor);
    };
    const capBack = (bottomY) => {
      ctx.beginPath();
      ctx.ellipse(hx, hy - 0.4, R, RY, 0, Math.PI, 0);
      ctx.lineTo(hx + R - 0.2, bottomY); ctx.quadraticCurveTo(hx, bottomY + 0.8, hx - R + 0.2, bottomY);
      ctx.closePath(); fillLine(hairColor);
    };
    if (!front) {
      if (female && style === 'long') {
        // long hair down the back to the shoulder blades, wavy ends
        const bot = chestY + 3;
        ctx.beginPath();
        ctx.moveTo(hx - R, hy - 0.4);
        ctx.ellipse(hx, hy - 0.4, R, RY, 0, Math.PI, 0);
        ctx.quadraticCurveTo(hx + R + 1.2, hy + ry, hx + R + 2.2, shoulderY + 1.5);
        ctx.quadraticCurveTo(hx + R + 2.8, bot - 3, hx + R + 1.6, bot - 0.8);
        ctx.quadraticCurveTo(hx + 3, bot + 1.4, hx + 1.2, bot);
        ctx.quadraticCurveTo(hx - 1.2, bot + 1.8, hx - 3, bot + 0.4);
        ctx.quadraticCurveTo(hx - R - 1.2, bot + 0.6, hx - R - 1.6, bot - 0.8);
        ctx.quadraticCurveTo(hx - R - 2.8, bot - 3, hx - R - 2.2, shoulderY + 1.5);
        ctx.quadraticCurveTo(hx - R - 1.2, hy + ry, hx - R, hy - 0.4);
        ctx.closePath(); fillLine(hairColor);
        strands([[[hx - 1.5, hy - 2], [hx - 2.8, shoulderY], [hx - 3.2, bot - 0.6]], [[hx + 0.8, hy - 2.5], [hx + 1.2, shoulderY + 1], [hx + 0.8, bot]], [[hx + 3, hy], [hx + 4.4, shoulderY + 2], [hx + 4.4, bot - 1.2]], [[hx - 3.6, hy + 1], [hx - 5, shoulderY + 2.5], [hx - 5.2, bot - 1.5]]], hairDark, 0.45);
        strands([[[hx - 0.4, hy - 3.6], [hx - 0.8, shoulderY - 2]]], hairLight, 0.6);
      } else if (female && style === 'square') {
        capBack(hy + ry + 1);
        strands([[[hx - 1.4, hy - 2], [hx - 1.8, hy + ry]], [[hx + 1.4, hy - 2], [hx + 1.8, hy + ry]]], hairDark, 0.4);
      } else if (female && style === 'bowl') {
        capBack(hy + ry - 1);
        ctx.beginPath(); ctx.ellipse(hx, hy - 1.6, 1.1, 0.9, 0, 0, Math.PI * 2); fillLine(hairDark); // hair tie
        ctx.beginPath(); ctx.moveTo(hx - 1.2, hy - 1); ctx.quadraticCurveTo(hx - 2.2, hy + 5, hx + s * 0.6, shoulderY + 6); ctx.quadraticCurveTo(hx + 2.2, hy + 5, hx + 1.2, hy - 1); ctx.closePath();
        fillLine(hairColor);
        strands([[[hx, hy], [hx + s * 0.4, shoulderY + 4]]], hairDark, 0.4);
      } else if (style === 'long') {
        capBack(shoulderY + 0.5);
        strands([[[hx - 1.6, hy - 2], [hx - 2, shoulderY]], [[hx + 1.6, hy - 2], [hx + 2, shoulderY]]], hairDark, 0.4);
      } else {
        capBack(hy + ry * (style === 'bowl' ? 0.75 : 0.55));
        strands([[[hx - 2, hy - 3], [hx - 2.6, hy + 1]], [[hx + 1.5, hy - 3.5], [hx + 2.2, hy + 1]]], hairDark, 0.4);
      }
    } else if (female) {
      if (style === 'long') {
        capFront(hy - 2.2, hy - 0.6);
        // side part with a swept fringe, long locks framing the face (one falls over the shoulder)
        ctx.beginPath(); ctx.moveTo(hx - t * 1.5, hy - 4.4); ctx.quadraticCurveTo(hx - t * 3.6, hy - 2.6, hx - t * (rx + 0.4), hy + 0.5); ctx.lineTo(hx - t * (rx - 0.6), hy - 1.6); ctx.closePath(); fillLine(hairColor);
        [-1, 1].forEach(sd => {
          const near = sd === (t || 1);
          const bot = near ? chestY + 1 : shoulderY + 2;
          ctx.beginPath();
          ctx.moveTo(hx + sd * (rx - 0.6), hy - 1.5);
          ctx.quadraticCurveTo(hx + sd * (rx + 1.6), hy + 3, hx + sd * (rx + (near ? 0.2 : 1)), bot);
          ctx.lineTo(hx + sd * (rx - (near ? 2 : 0.8)), bot - 1.2);
          ctx.quadraticCurveTo(hx + sd * (rx - 0.2), hy + 3, hx + sd * (rx - 0.9), hy - 0.5);
          ctx.closePath(); fillLine(hairColor);
          strands([[[hx + sd * (rx + 0.2), hy], [hx + sd * (rx + 0.4), bot - 1.2]]], hairDark, 0.4);
        });
      } else if (style === 'square') {
        // chin-length bob with blunt bangs
        capFront(hy - 1.6, hy - 0.6);
        [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(hx + sd * (rx - 0.6), hy - 1.6); ctx.quadraticCurveTo(hx + sd * (rx + 1.2), hy + 2, hx + sd * (rx + 0.6), hy + ry + 0.6); ctx.lineTo(hx + sd * (rx - 0.9), hy + ry); ctx.quadraticCurveTo(hx + sd * (rx - 0.3), hy + 1, hx + sd * (rx - 0.9), hy - 1); ctx.closePath(); fillLine(hairColor); });
        strands([[[hx - 2, hy - 3.6], [hx - 2.2, hy - 1.8]], [[hx, hy - 3.8], [hx, hy - 1.8]], [[hx + 2, hy - 3.6], [hx + 2.2, hy - 1.8]]], hairDark, 0.35);
      } else {
        // pulled back into a ponytail
        capFront(hy - 2.6, hy - 0.8);
        strands([[[hx + t * 0.8, hy - 2.6], [hx - 1.6, hy - 4.4]], [[hx + t * 0.8, hy - 2.6], [hx + 1.8, hy - 4.2]]], hairDark, 0.4);
      }
    } else {
      if (style === 'bowl') {
        // textured, messy top with a ragged fringe
        capFront(hy - 2.2, hy - 0.4);
        ctx.beginPath();
        ctx.moveTo(hx - rx - 0.2, hy - 2.4);
        for (let i = 0; i <= 6; i++) ctx.lineTo(hx - rx + i * (rx * 2 / 6) + t * 0.5, hy - (i % 2 ? 1.4 : 2.8));
        ctx.lineTo(hx + rx + 0.2, hy - 3.6); ctx.lineTo(hx - rx - 0.2, hy - 3.6); ctx.closePath();
        ctx.fillStyle = hairColor; ctx.fill();
        strands([[[hx - 1.6, hy - 4.6], [hx - 0.4, hy - 2.6]], [[hx + 1, hy - 4.8], [hx + 2, hy - 2.8]]], hairDark, 0.4);
      } else if (style === 'long') {
        capFront(hy - 2.4, hy + ry + 0.6);
        line([[hx, hy - 4.6], [hx + t * 0.4, hy - 2.4]], hairDark, 0.45); // middle part
      } else {
        // short crop with a side part
        capFront(hy - 2.6, hy - 0.2);
        line([[hx - 1.6 - t, hy - 4.4], [hx - 0.9 - t, hy - 2.9]], hairDark, 0.45);
        strands([[[hx + 0.4, hy - 4.5], [hx + 2.6, hy - 3.3]]], hairLight, 0.45);
      }
    }
    // sheen
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.ellipse(hx - 1 + t * 0.6, hy - 3.4, 1.8, 0.7, -0.3, 0, Math.PI * 2); ctx.fill();
  };

  // ---- paint order -------------------------------------------------
  // front: back hair, far arm, legs (back to front), torso, near arm, head, hair
  // back:  near-side arm hidden behind? no - in back view the arms sit beside
  //        the torso, so draw far arm, legs, torso, near arm, head, hair over the back
  const far = t === 0 ? null : -t;
  if (front) hairBack();
  if (far !== null) armDraw(far);
  if (!opts.swimming) legs.forEach(drawLeg);
  torsoDraw();
  if (far === null) { armDraw(-1); armDraw(1); } else armDraw(t);
  headDraw();
  hairFront();

  if (opts.dirty) {
    ctx.fillStyle = 'rgba(90,70,40,0.35)';
    ctx.beginPath(); ctx.arc(bx - 2.5, chestY + 2, 1.8, 0, Math.PI * 2); ctx.arc(bx + 3, waistY + 2, 1.5, 0, Math.PI * 2); ctx.arc(hx + 1.5, hy + 2, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  if (opts.swimming) {
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
    const r = 10 + Math.sin(now / 300) * 1.5;
    ctx.beginPath(); ctx.ellipse(0, -2, r, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
  }

  if (label) {
    const ly = opts.swimming ? topY + 30 : topY;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-tw / 2 - 4, ly - 17, tw + 8, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 0, ly - 6.5);
  }
  ctx.restore();
}
