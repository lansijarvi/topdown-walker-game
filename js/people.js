// =====================================================================
// People renderer: proportioned characters with faces, hair styles and
// outfits. Replaces drawDude for standing / walking / swimming / knocked
// down / riding-in-iso poses; lying in bed, sitting, and classic-view
// riding still use the original drawDude art (kept as drawDudeClassic).
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

const PANTS_COLORS = ['#34445e', '#2a2a2e', '#4a5a78', '#6a5a44', '#3a3a44'];
const SHOE_COLORS = ['#2a221c', '#1c1c1c', '#5a4030', '#e8e4dc'];
const HEEL_COLORS = ['#1a1a1a', '#b0203a', '#e8d8c8', '#6a1a3a'];
const LIP_COLORS = ['#b8404e', '#c8506a', '#9a3040', '#d06a7a'];

function personOutfit(color, opts) {
  const h = personHash(color, opts.hairColor, opts.skinTone, opts.hairstyle);
  const h2 = personHash(opts.skinTone, color, 7);
  if (opts.gender === 'f') {
    const style = opts.skirt ? (h < 0.5 ? 'dress' : 'cropSkirt') : (h < 0.33 ? 'cropShorts' : h < 0.66 ? 'tankJeans' : 'dress');
    return {
      style,
      top: color,
      bottom: opts.skirt ? (opts.skirtColor || shadeColor(color, -25)) : style === 'tankJeans' ? PANTS_COLORS[Math.floor(h2 * 3)] : '#2a2a34',
      shoes: HEEL_COLORS[Math.floor(h2 * HEEL_COLORS.length)],
      lips: LIP_COLORS[Math.floor(h * LIP_COLORS.length)]
    };
  }
  return {
    style: h < 0.3 ? 'jacket' : 'tee',
    top: color,
    jacket: shadeColor(color, -35),
    bottom: PANTS_COLORS[Math.floor(h2 * PANTS_COLORS.length)],
    shoes: SHOE_COLORS[Math.floor(h * SHOE_COLORS.length)]
  };
}

// tapered limb from (x1,y1) width w1 to (x2,y2) width w2
function limb(x1, y1, w1, x2, y2, w2) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  ctx.arc(x2, y2, w2 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  ctx.closePath();
  ctx.fill();
}

function drawPerson(cx, cy, color, label, opts) {
  const now = performance.now();
  const female = opts.gender === 'f';
  const skin = opts.skinTone || '#f0c090';
  const skinShade = shadeColor(skin, -14);
  const hairColor = opts.hairColor || '#3a2a1a';
  const style = opts.hairstyle || (female ? 'long' : 'square');
  const outfit = personOutfit(color || '#3a6fd8', opts);
  const view = personView(opts.facing || 'down');
  const t = view.turn, front = view.front;
  const scale = opts.kid ? 0.66 : opts.big ? 1.22 : opts.riding ? 1.15 : 1;
  const riding = !!opts.riding;

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.knockedDown) { ctx.rotate(Math.PI / 2); ctx.translate(0, 8); }
  ctx.scale(scale, scale);

  // ground shadow
  if (!opts.swimming && !riding) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  // walk cycle / idle sway
  let swing = 0, bob = 0;
  if (!opts.knockedDown && !riding) {
    if (opts.moving) { const ph = now / 1000 * 9; swing = Math.sin(ph); bob = Math.abs(Math.sin(ph)) * 1.3; }
    else bob = Math.sin(now / 1000 * 1.6 + (cx + cy) * 0.05) * 0.5;
  }
  if (opts.swimming) {
    ctx.save();
    ctx.translate(0, 22);
    ctx.beginPath(); ctx.rect(-30, -90, 60, 87); ctx.clip();
  }
  ctx.translate(0, -bob);

  // body landmarks
  const hipY = riding ? -15 : -23, waistY = hipY - 6, chestY = hipY - 13, shoulderY = hipY - 16;
  const shW = female ? 7 : 9, waistW = female ? 4.4 : 7, hipW = female ? 9 : 6.6, bustW = 8;
  const headY = shoulderY - 10;
  const bx = t * 0.6; // body shifts a hair toward the turn

  const legDraw = () => {
    const legW = female ? 5.4 : 5;
    const bareLegs = opts.bikini || (female && outfit.style !== 'tankJeans');
    const legColor = bareLegs ? skin : outfit.bottom;
    [-1, 1].forEach(side => {
      const hx = bx + side * (female ? 3.6 : 3.4);
      let kx, ky, fx, fy;
      if (riding) {
        const fwd = front ? 1 : -1;
        kx = hx + side * 2 + t * 5; ky = hipY + 3 + fwd * 1;
        fx = hx + side * 2 + t * 4; fy = -5;
      } else {
        const s = swing * side;
        kx = hx + t * s * 1.5; ky = (hipY + 0) / 2 - Math.max(0, s) * 1.5;
        fx = hx + t * s * 3; fy = -Math.max(0, s) * 2.5;
      }
      ctx.fillStyle = legColor;
      limb(hx, hipY, legW, kx, ky, legW * 0.85);
      limb(kx, ky, legW * (female ? 0.72 : 0.85), fx, fy - 2, female ? 2.4 : 3.4);
      // shoes
      ctx.fillStyle = outfit.shoes;
      if (female) {
        ctx.beginPath(); ctx.ellipse(fx + t * 1, fy - 1, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(fx - 0.6 - t * 1.4, fy - 2, 1.2, 2.5);
      } else {
        ctx.beginPath(); ctx.ellipse(fx + t * 1.2, fy - 1.2, 3.4, 2, 0, 0, Math.PI * 2); ctx.fill();
      }
    });
  };

  const torsoPath = () => {
    ctx.beginPath();
    if (female) {
      ctx.moveTo(bx - shW, shoulderY);
      ctx.quadraticCurveTo(bx - bustW - 0.5, chestY, bx - waistW, waistY);
      ctx.quadraticCurveTo(bx - hipW - 1, hipY - 2, bx - hipW, hipY + 1);
      ctx.lineTo(bx + hipW, hipY + 1);
      ctx.quadraticCurveTo(bx + hipW + 1, hipY - 2, bx + waistW, waistY);
      ctx.quadraticCurveTo(bx + bustW + 0.5, chestY, bx + shW, shoulderY);
    } else {
      ctx.moveTo(bx - shW, shoulderY + 1);
      ctx.lineTo(bx - waistW, waistY);
      ctx.lineTo(bx - hipW, hipY + 1);
      ctx.lineTo(bx + hipW, hipY + 1);
      ctx.lineTo(bx + waistW, waistY);
      ctx.lineTo(bx + shW, shoulderY + 1);
    }
    ctx.quadraticCurveTo(bx, shoulderY - 2.5, bx - shW, female ? shoulderY : shoulderY + 1);
    ctx.closePath();
  };

  const torsoDraw = () => {
    // base: skin (shows at neckline / midriff / bare shoulders)
    ctx.fillStyle = skin;
    torsoPath(); ctx.fill();
    ctx.save();
    torsoPath(); ctx.clip();
    const g = ctx.createLinearGradient(bx - 10, shoulderY, bx + 10, hipY);
    if (opts.bikini) {
      ctx.fillStyle = opts.bikiniColor || '#c25f8f';
      if (female) {
        if (front) { ctx.beginPath(); ctx.ellipse(bx - 3, chestY + 0.5, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.ellipse(bx + 3, chestY + 0.5, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(bx - 9, chestY - 1, 18, 2.4);
      }
      ctx.beginPath(); ctx.moveTo(bx - hipW - 1, hipY - 3); ctx.lineTo(bx + hipW + 1, hipY - 3); ctx.lineTo(bx + 2, hipY + 2); ctx.lineTo(bx - 2, hipY + 2); ctx.fill();
    } else if (female) {
      g.addColorStop(0, shadeColor(outfit.top, 18)); g.addColorStop(1, shadeColor(outfit.top, -16));
      ctx.fillStyle = g;
      const neckDip = front ? 3.5 : 0.5;
      if (outfit.style === 'dress') {
        ctx.beginPath();
        ctx.moveTo(bx - shW + 1.5, shoulderY); ctx.lineTo(bx - 1.5, shoulderY + neckDip); ctx.lineTo(bx + 1.5, shoulderY + neckDip); ctx.lineTo(bx + shW - 1.5, shoulderY);
        ctx.lineTo(bx + 12, hipY + 5); ctx.lineTo(bx - 12, hipY + 5); ctx.closePath(); ctx.fill();
      } else {
        const hem = outfit.style === 'tankJeans' ? waistY + 2 : waistY - 1.5; // crop tops show a little midriff
        ctx.beginPath();
        ctx.moveTo(bx - shW + 1.5, shoulderY); ctx.lineTo(bx - 1.5, shoulderY + neckDip); ctx.lineTo(bx + 1.5, shoulderY + neckDip); ctx.lineTo(bx + shW - 1.5, shoulderY);
        ctx.lineTo(bx + 12, hem); ctx.lineTo(bx - 12, hem); ctx.closePath(); ctx.fill();
        ctx.fillStyle = outfit.bottom;
        ctx.fillRect(bx - 12, waistY + 1, 24, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx - 12, waistY + 1, 24, 1);
      }
      // soft bust shading so the figure reads as curved, not a flat block
      if (front) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath(); ctx.ellipse(bx - 2.8 + t, chestY - 0.5, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.ellipse(bx + 2.8 + t, chestY - 0.5, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.beginPath(); ctx.ellipse(bx + t, chestY + 2.2, 5.5, 1.2, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(bx - 12, waistY - 1, 24, 1); // waist crease
    } else {
      g.addColorStop(0, shadeColor(outfit.top, 18)); g.addColorStop(1, shadeColor(outfit.top, -16));
      ctx.fillStyle = g; ctx.fillRect(bx - 12, shoulderY - 4, 24, hipY - shoulderY + 3);
      if (outfit.style === 'jacket') {
        ctx.fillStyle = outfit.jacket;
        ctx.fillRect(bx - 12, shoulderY - 4, front ? 8.5 : 24, hipY - shoulderY + 3);
        if (front) ctx.fillRect(bx + 3.5, shoulderY - 4, 9, hipY - shoulderY + 3);
      }
      if (front) { ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(bx - 2.5, shoulderY - 1); ctx.lineTo(bx + 2.5, shoulderY - 1); ctx.lineTo(bx, shoulderY + 2.5); ctx.fill(); }
      ctx.fillStyle = outfit.bottom; ctx.fillRect(bx - 12, hipY - 3, 24, 6);
      ctx.fillStyle = '#2a2018'; ctx.fillRect(bx - 12, hipY - 3.5, 24, 1.6); // belt
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    torsoPath(); ctx.stroke();
    // skirt / shorts flare below the hips
    if (female && !opts.bikini && outfit.style !== 'tankJeans') {
      ctx.fillStyle = outfit.style === 'dress' ? shadeColor(outfit.top, -6) : outfit.bottom;
      const hemY = hipY + (outfit.style === 'cropShorts' ? 4 : 8);
      ctx.beginPath();
      ctx.moveTo(bx - hipW, hipY); ctx.lineTo(bx + hipW, hipY);
      ctx.lineTo(bx + hipW + 1.6, hemY); ctx.lineTo(bx - hipW - 1.6, hemY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(bx - hipW - 1.6, hemY - 1, (hipW + 1.6) * 2, 1);
    }
  };

  const armDraw = (side, inFront) => {
    const sx = bx + side * (shW + 0.8), sy = shoulderY + 1.5;
    let hx, hy;
    if (riding) { hx = bx + side * 6 + t * 6; hy = hipY - 4; }
    else { const s = -swing * side; hx = sx + side * 1.5 + t * s * 2.5; hy = hipY + 1 - Math.abs(s) * 0.5 + (front ? 0 : 0); }
    const ex = (sx + hx) / 2 + side * 1.2, ey = (sy + hy) / 2;
    const sleeve = female ? null : (outfit.style === 'jacket' ? outfit.jacket : outfit.top);
    ctx.fillStyle = skin;
    limb(sx, sy, female ? 3.4 : 4.4, ex, ey, female ? 2.8 : 3.6);
    limb(ex, ey, female ? 2.8 : 3.6, hx, hy, female ? 2.4 : 3);
    if (sleeve) {
      ctx.fillStyle = sleeve;
      if (outfit.style === 'jacket') { limb(sx, sy, 5, ex, ey, 4.2); limb(ex, ey, 4.2, hx, hy - 1, 3.6); }
      else limb(sx, sy, 5, sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55, 4.4);
    }
    ctx.fillStyle = skinShade;
    ctx.beginPath(); ctx.arc(hx, hy, female ? 1.6 : 2, 0, Math.PI * 2); ctx.fill();
    if (opts.gunEquipped && side === (t >= 0 ? 1 : -1) && inFront) {
      ctx.fillStyle = '#1e1e22';
      ctx.fillRect(hx - 1 + (t || 1) * 1, hy - 2, (t || 1) * 7, 3);
      ctx.fillRect(hx - 1, hy - 2, 2, 4);
      if (opts.muzzleFlash) {
        ctx.fillStyle = '#ffe680';
        ctx.beginPath(); ctx.arc(hx + (t || 1) * 9, hy - 0.5, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  const hairBack = () => {
    ctx.fillStyle = hairColor;
    if (female && style === 'long') {
      ctx.beginPath();
      ctx.moveTo(bx + t - 8, headY - 4);
      ctx.quadraticCurveTo(bx + t - 10.5, headY + 8, bx + t - 7.5, shoulderY + (front ? 9 : 13));
      ctx.lineTo(bx + t + 7.5, shoulderY + (front ? 9 : 13));
      ctx.quadraticCurveTo(bx + t + 10.5, headY + 8, bx + t + 8, headY - 4);
      ctx.closePath(); ctx.fill();
    } else if (female && style === 'bowl') {
      // high ponytail
      ctx.beginPath(); ctx.ellipse(bx + t - (front ? 0 : 0), headY - 6, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + t - 2.5, headY - 6); ctx.quadraticCurveTo(bx + t - 5, headY + 6, bx + t, shoulderY + 4); ctx.quadraticCurveTo(bx + t + 4, headY + 4, bx + t + 2.5, headY - 6); ctx.fill();
    } else if (style === 'long') {
      ctx.beginPath(); ctx.ellipse(bx + t, headY + 2, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  const headDraw = () => {
    const hx = bx + t * 0.9;
    // neck
    ctx.fillStyle = skinShade;
    ctx.fillRect(hx - 2.2, headY + 5, 4.4, shoulderY - headY - 4);
    // ears
    if (!(female && style === 'long')) {
      ctx.fillStyle = skinShade;
      if (t <= 0 || !front) { ctx.beginPath(); ctx.ellipse(hx - 6.4, headY + 0.5, 1.4, 2, 0, 0, Math.PI * 2); ctx.fill(); }
      if (t >= 0 || !front) { ctx.beginPath(); ctx.ellipse(hx + 6.4, headY + 0.5, 1.4, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // head shape: rounder cranium, narrower jaw
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(hx, headY - 1, 6.4, 6.6, 0, Math.PI, 0);
    ctx.quadraticCurveTo(hx + 6.2, headY + 4.5, hx + (female ? 2 : 3), headY + 7);
    ctx.lineTo(hx - (female ? 2 : 3), headY + 7);
    ctx.quadraticCurveTo(hx - 6.2, headY + 4.5, hx - 6.4, headY - 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7; ctx.stroke();

    if (front) {
      const fx = hx + t * 1.7;
      // eyes
      [-1, 1].forEach(s => {
        if (t !== 0 && s === -t) { /* far eye slightly narrower */ }
        const ex = fx + s * 2.5 * (t !== 0 && s === -t ? 0.75 : 1);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex, headY + 0.6, 1.8, female ? 1.4 : 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1e18';
        ctx.beginPath(); ctx.arc(ex + t * 0.4, headY + 0.7, 1.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(ex + t * 0.4 - 0.2, headY + 0.1, 0.6, 0.6);
        ctx.strokeStyle = female ? '#1a1010' : shadeColor(hairColor, -10);
        ctx.lineWidth = female ? 0.9 : 0.8;
        ctx.beginPath(); ctx.moveTo(ex - 1.6, female ? headY - 0.1 : headY - 1.8); ctx.lineTo(ex + 1.6, female ? headY - 0.3 : headY - 1.6); ctx.stroke(); // lashes / brows
        if (female) { ctx.strokeStyle = shadeColor(hairColor, -10); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(ex - 1.4, headY - 2); ctx.quadraticCurveTo(ex, headY - 2.8, ex + 1.5, headY - 2.1); ctx.stroke(); }
      });
      // nose + mouth
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(fx + t * 0.6, headY + 3, 0.9, 0.6, 0, 0, Math.PI * 2); ctx.fill();
      if (female) {
        ctx.fillStyle = outfit.lips;
        ctx.beginPath(); ctx.ellipse(fx + t * 0.4, headY + 5, 1.5, 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(230,110,110,0.18)';
        ctx.beginPath(); ctx.arc(fx - 3.4, headY + 3, 1.3, 0, Math.PI * 2); ctx.arc(fx + 3.4, headY + 3, 1.3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(80,40,30,0.6)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(fx - 1.4 + t * 0.4, headY + 4.8); ctx.lineTo(fx + 1.4 + t * 0.4, headY + 4.8); ctx.stroke();
      }
    }
  };

  const hairFront = () => {
    const hx = bx + t * 0.9;
    ctx.fillStyle = hairColor;
    const cap = (depth) => { ctx.beginPath(); ctx.ellipse(hx, headY - 1.5, 6.9, 6.9, 0, Math.PI, 0); ctx.lineTo(hx + 6.9, headY - 1.5 + depth); ctx.lineTo(hx - 6.9, headY - 1.5 + depth); ctx.closePath(); ctx.fill(); };
    if (style === 'bald') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(hx - 2, headY - 5, 2.4, 1.3, -0.4, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (!front) {
      // back of the head is all hair
      ctx.beginPath(); ctx.ellipse(hx, headY, 6.9, 7.2, 0, 0, Math.PI * 2); ctx.fill();
      if (female && style === 'long') { ctx.fillRect(hx - 7.5, headY, 15, shoulderY - headY + 12); }
      if (style === 'square' && female) { ctx.fillRect(hx - 7, headY, 14, 7.5); }
    } else if (female) {
      if (style === 'long') {
        cap(1);
        // side-swept fringe + strands framing the face
        ctx.beginPath(); ctx.moveTo(hx - 7, headY - 1); ctx.quadraticCurveTo(hx + t * 3, headY - 7, hx + 6.5, headY - 2); ctx.quadraticCurveTo(hx + 1, headY - 3, hx - 7, headY + 2); ctx.fill();
        ctx.fillRect(hx - 7.4, headY - 2, 2.2, 12); ctx.fillRect(hx + 5.2, headY - 2, 2.2, 12);
      } else if (style === 'square') {
        cap(1.5);
        ctx.fillRect(hx - 7.4, headY - 2, 2.6, 9); ctx.fillRect(hx + 4.8, headY - 2, 2.6, 9);
        ctx.beginPath(); ctx.moveTo(hx - 6.5, headY - 1); ctx.lineTo(hx + 6.5, headY - 1); ctx.lineTo(hx + 6.5, headY - 3); ctx.lineTo(hx - 6.5, headY - 3); ctx.fill();
      } else {
        cap(0.5);
      }
    } else {
      if (style === 'bowl') { cap(2.5); ctx.fillRect(hx - 6.9, headY - 2, 13.8, 2.5); }
      else if (style === 'long') { cap(1); ctx.fillRect(hx - 7.4, headY - 2, 2.4, 9); ctx.fillRect(hx + 5, headY - 2, 2.4, 9); }
      else { cap(-0.5); ctx.fillRect(hx - 6.9, headY - 3, 1.8, 3); ctx.fillRect(hx + 5.1, headY - 3, 1.8, 3); }
    }
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(hx - 2 + t, headY - 6, 3, 1.2, -0.3, 0, Math.PI * 2); ctx.fill();
  };

  // paint order: back hair, far arm, legs, torso, near arm, head, front hair
  const far = t === 0 ? null : -t;
  if (front) hairBack();
  if (far !== null) armDraw(far, false);
  if (!opts.swimming) legDraw();
  torsoDraw();
  if (far === null) { armDraw(-1, true); armDraw(1, true); } else armDraw(t, true);
  if (!front) hairBack();
  headDraw();
  hairFront();

  if (opts.dirty) {
    ctx.fillStyle = 'rgba(90,70,40,0.35)';
    ctx.beginPath(); ctx.arc(bx - 3, chestY + 2, 2.2, 0, Math.PI * 2); ctx.arc(bx + 4, waistY + 3, 1.8, 0, Math.PI * 2); ctx.arc(bx + 2, headY + 3, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  if (opts.swimming) {
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
    const r = 11 + Math.sin(now / 300) * 1.5;
    ctx.beginPath(); ctx.ellipse(0, -2, r, r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
  }

  if (label) {
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-tw / 2 - 4, headY - 24, tw + 8, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 0, headY - 14);
  }
  ctx.restore();
}
