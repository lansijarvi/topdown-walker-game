
// lightens (positive percent) or darkens (negative) a hex color, used to
// build simple top-lit gradients instead of flat single-color shapes
function shadeColor(hex, percent) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  const amt = Math.round(255 * percent / 100);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawDude(cx, cy, color, label, opts) {
  opts = opts || {};
  const facing = opts.facing || 'down';
  const gender = opts.gender || 'm';
  const hairColor = opts.hairColor || '#3a2a1a';
  // the riding pose's crouched proportions cover noticeably less area
  // than standing even at the same scale value, which reads as the
  // character shrinking the moment they mount up - scale it up to
  // compensate so mounting doesn't change the character's apparent size
  const scale = opts.kid ? 0.62 : opts.big ? 1.3 : opts.riding ? 1.3 : 1;
  const baseColor = color || '#3a6fd8';
  const bodyGrad = ctx.createLinearGradient(0, -35, 0, 0);
  bodyGrad.addColorStop(0, shadeColor(baseColor, 22));
  bodyGrad.addColorStop(1, shadeColor(baseColor, -18));

  ctx.save();
  ctx.translate(cx, cy);

  if (opts.knockedDown) {
    // sprawled flat on open pavement - any rotation reads fine there
    ctx.rotate(Math.PI / 2);
    ctx.translate(0, 6);
  } else if (opts.lying && opts.lieAngle) {
    // matches whichever way the bed itself is oriented - a portrait bed
    // (taller than wide) needs no rotation at all to fit its long axis,
    // but a landscape one (headboard against a side wall) needs the
    // character turned onto their side, or they'd stick out past its edges
    ctx.rotate(opts.lieAngle);
    ctx.translate(0, 6);
  }

  ctx.scale(scale, scale);

  const sideRiding = opts.riding && (facing === 'left' || facing === 'right');
  const frontRiding = opts.riding && (facing === 'up' || facing === 'down');

  // subtle life: a light bob while walking, or a slow idle sway while
  // standing still - skipped for riders and anyone currently knocked down.
  // Idle phase is offset by screen position (stable while stationary) so a
  // crowd of standing NPCs doesn't all sway in lockstep.
  let legSwing = 0;
  if (!opts.riding && !opts.knockedDown && !opts.lying && !opts.sitting) {
    const t = performance.now() / 1000;
    let bodyBob;
    if (opts.moving) {
      const walkPhase = t * 9;
      legSwing = Math.sin(walkPhase) * 3;
      bodyBob = Math.abs(Math.sin(walkPhase)) * 1.4;
    } else {
      bodyBob = Math.sin(t * 1.6 + (cx + cy) * 0.05) * 0.8;
    }
    ctx.translate(0, -bodyBob);
  }

  if (sideRiding) {
    // horizontal racing tuck, mirrored so "forward" always reads right
    const dir = facing === 'left' ? -1 : 1;
    ctx.scale(dir, 1);
    ctx.translate(-2, -4);
  } else if (frontRiding) {
    ctx.translate(0, -2);
    // the crouch pose is drawn facing "up" by default - mirror it 180 for
    // "down" so the rider's sitting position matches the bike, the same
    // convention drawMotorcycle/drawCar use for their own rotation
    if (facing === 'down') ctx.rotate(Math.PI);
  }

  if (!opts.riding && !opts.swimming) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (opts.swimming) {
    // legs are underwater - nothing drawn below the waterline overlay
    // added lower down, once the rest of the body is in place
  } else if (opts.sitting) {
    // knees bent, legs tucked toward whichever way they're facing instead
    // of hanging straight down like a standing pose - same tucked-forward
    // trick frontRiding uses, just shorter and nudged in the facing direction
    const legDX = facing === 'right' ? 4 : facing === 'left' ? -4 : 0;
    const legDY = facing === 'down' ? 3 : facing === 'up' ? -3 : 0;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-7 + legDX, -10 + legDY, 5, 9);
    ctx.fillRect(2 + legDX, -10 + legDY, 5, 9);
  } else if (!opts.riding) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-7, -12 + legSwing, 5, 13);
    ctx.fillRect(2, -12 - legSwing, 5, 13);
  } else if (frontRiding) {
    // knees tucked forward and low onto the footpegs
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-12, -13, 6, 8);
    ctx.fillRect(6, -13, 6, 8);
  } else if (sideRiding) {
    // trailing leg, stretched back low and close to the frame
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(-14, -3);
    ctx.lineTo(-2, -7);
    ctx.lineTo(-1, -2);
    ctx.lineTo(-13, 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = bodyGrad;
  if (frontRiding) {
    // short forward-reaching arms, ending right at the handlebar grip
    ctx.fillRect(-11, -21, 5, 9);
    ctx.fillRect(6, -21, 5, 9);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(-12, -14, 7, 3);
    ctx.fillRect(5, -14, 7, 3);
  } else if (sideRiding) {
    // arm stretched way forward to the low handlebar, classic racing tuck
    ctx.beginPath();
    ctx.moveTo(2, -16);
    ctx.lineTo(17, -11);
    ctx.lineTo(16, -7);
    ctx.lineTo(3, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(14, -10, 6, 4);
  } else {
    ctx.fillRect(-13, -29, 4, 15);
    ctx.fillRect(9, -29, 4, 15);
  }

  ctx.fillStyle = bodyGrad;
  if (frontRiding) {
    // short, compact torso hunched over the tank
    ctx.beginPath();
    ctx.moveTo(-8, -22);
    ctx.lineTo(8, -22);
    ctx.lineTo(7, -10);
    ctx.lineTo(-7, -10);
    ctx.closePath();
    ctx.fill();
  } else if (sideRiding) {
    // torso laid nearly horizontal, low at the back and reaching up
    // slightly toward the front - the classic tucked racing silhouette
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(-11, -15);
    ctx.lineTo(6, -18);
    ctx.lineTo(4, -6);
    ctx.closePath();
    ctx.fill();
  } else if (opts.bikini) {
    // bare midriff with a small top and bottom instead of a full torso
    ctx.fillStyle = opts.skinTone || '#f0c090';
    ctx.beginPath();
    ctx.moveTo(-9, -31);
    ctx.lineTo(9, -31);
    ctx.lineTo(7, -21);
    ctx.lineTo(8, -10);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-7, -21);
    ctx.closePath();
    ctx.fill();

    const bikiniColor = opts.bikiniColor || '#c25f8f';
    ctx.fillStyle = bikiniColor;
    ctx.fillRect(-8, -31, 6, 6);
    ctx.fillRect(2, -31, 6, 6);
    ctx.fillRect(-7, -14, 14, 5);
  } else if (gender === 'f') {
    ctx.beginPath();
    ctx.moveTo(-9, -31);
    ctx.lineTo(9, -31);
    ctx.lineTo(7, -21);
    ctx.lineTo(8, -10);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-7, -21);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-4, -25, 3, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -25, 3, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-9, -31, 18, 21);
  }

  if (opts.skirt && !opts.riding && !opts.bikini) {
    ctx.fillStyle = opts.skirtColor || '#c25f8f';
    ctx.beginPath();
    ctx.moveTo(-9, -19);
    ctx.lineTo(9, -19);
    ctx.lineTo(14, -4);
    ctx.lineTo(-14, -4);
    ctx.closePath();
    ctx.fill();
  }

  // head position: centered and compact when crouched front/back, pushed
  // forward and down low when tucked in the side-view racing crouch
  const headX = sideRiding ? 10 : 0;
  const headY = sideRiding ? -18 : frontRiding ? -22 : -39;
  const headR = opts.riding ? 8 : 10;

  const skinBase = opts.skinTone || '#f0c090';
  const headGrad = ctx.createRadialGradient(headX - 3, headY - 3, 1, headX, headY, headR);
  headGrad.addColorStop(0, shadeColor(skinBase, 18));
  headGrad.addColorStop(1, shadeColor(skinBase, -12));
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  const hairstyle = opts.hairstyle || 'square';
  if (hairstyle !== 'bald') {
    ctx.fillStyle = hairColor;
    if (frontRiding || opts.lying) {
      // whenever the face is deliberately hidden and we're looking at
      // the back/top of the head instead (hunched over the handlebars,
      // or lying in bed) - that's solid hair for every style except a
      // mohawk, which still reads as a narrow strip with bare scalp on
      // both sides even from directly above
      if (hairstyle === 'mohawk') {
        ctx.fillRect(headX - 2, headY - headR - 3, 4, headR * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(headX, headY, headR - 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (hairstyle === 'square') {
      // boxy flat-top instead of a rounded cap
      ctx.fillRect(headX - headR, headY - headR - 2, headR * 2, headR * 0.9);
    } else if (hairstyle === 'buzz') {
      // same rounded cap shape as the default style (hugging the head's
      // own curve, not a separate smaller dome floating above it), just
      // faded so it reads as a thin shave instead of full-thickness hair
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(headX, headY - 2, headR + 0.5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (hairstyle === 'mohawk') {
      // narrow spiked strip down the center, bare scalp on both sides
      ctx.fillRect(headX - 2, headY - headR - 3, 4, headR * 1.6);
    } else {
      ctx.beginPath();
      ctx.arc(headX, headY - 2, headR + 0.5, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    if (!opts.riding) {
      if (hairstyle === 'bowl') {
        if (facing === 'up') {
          // back turned - hair drapes across the back of the head
          // instead of the usual face-framing side tufts, which would
          // otherwise look identical to the front view minus the eyes
          ctx.fillRect(headX - headR - 1, headY - 2, headR * 2 + 2, 10);
        } else {
          // short side coverage, down past the ears
          ctx.fillRect(headX - headR - 1, headY - 2, 4, 10);
          ctx.fillRect(headX + headR - 3, headY - 2, 4, 10);
        }
      } else if (hairstyle === 'long') {
        if (facing === 'up') {
          ctx.fillRect(headX - headR - 1, headY - 2, headR * 2 + 2, 19);
        } else {
          // longer hair framing the face down to the shoulders
          ctx.fillRect(headX - headR - 1, headY - 2, 5, 19);
          ctx.fillRect(headX + headR - 4, headY - 2, 5, 19);
        }
      }
    }
  }

  // front-riding always shows the back of the head/helmet, same as facing
  // up while standing - hunched forward over the bars reads the same way
  // whether you're heading up or down the screen, not suddenly face-on.
  // lying is excluded outright too - whichever way a bed is oriented, you
  // never see a face while lying in it
  if (facing !== 'up' && !frontRiding && !opts.lying) {
    let ex = headX;
    if (frontRiding) {
      // no left/right distinction while facing the camera on the bike
    } else if (!opts.riding) {
      if (facing === 'left') ex = -3.5;
      else if (facing === 'right') ex = 3.5;
    } else if (sideRiding) {
      ex = headX + 3; // mirroring already handles the flip
    }
    const ey = sideRiding ? headY : (frontRiding ? -25 : -38);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex - 3, ey, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 3, ey, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(ex - 3 + (ex - headX) * 0.15, ey, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 3 + (ex - headX) * 0.15, ey, 1, 0, Math.PI * 2); ctx.fill();
  }

  if (opts.gunEquipped && !opts.riding) {
    ctx.fillStyle = '#1c1c1c';
    if (facing === 'right') {
      ctx.fillRect(11, -27, 15, 4);
      ctx.fillRect(11, -23, 4, 7);
    } else if (facing === 'left') {
      ctx.fillRect(-26, -27, 15, 4);
      ctx.fillRect(-15, -23, 4, 7);
    } else if (facing === 'down') {
      ctx.fillRect(-2, -22, 4, 16);
      ctx.fillRect(-4, -8, 8, 5);
    } else if (facing === 'up') {
      ctx.fillRect(6, -46, 4, 16);
      ctx.fillRect(4, -46, 8, 5);
    }

    if (opts.muzzleFlash) {
      ctx.fillStyle = '#ffe066';
      let fx = 0, fy = 0;
      if (facing === 'right') { fx = 26; fy = -25; }
      else if (facing === 'left') { fx = -26; fy = -25; }
      else if (facing === 'down') { fx = 0; fy = -3; }
      else if (facing === 'up') { fx = 8; fy = -46; }
      ctx.beginPath();
      ctx.arc(fx, fy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (opts.dirty) {
    // grime smudges - a handful of dark, semi-transparent marks over the
    // body and legs, deterministic per-character (seeded off the draw
    // position) so they stay put instead of flickering frame to frame
    const seed = (cx * 7 + cy * 13) % 1;
    ctx.fillStyle = 'rgba(30,25,18,0.3)';
    [[-6, -8], [4, -20], [-3, -30], [6, -14], [-8, -25]].forEach(([ox, oy], i) => {
      const jitter = ((seed + i * 0.37) % 1) * 3 - 1.5;
      ctx.beginPath();
      ctx.ellipse(ox + jitter, oy + jitter * 0.5, 2.5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (opts.swimming) {
    // solid waterline right at hip height, cutting the character off where
    // the (unrendered) legs would be - reads as submerged rather than
    // standing on the surface - plus a couple of rippling highlight rings
    const t = performance.now() / 500;
    ctx.fillStyle = 'rgba(55,110,145,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, -6, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -6, 11 + Math.sin(t) * 2, 4 + Math.sin(t), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(6, -4, 5 + Math.sin(t + 1.4) * 1.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (label) {
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-tw/2 - 4, -66, tw + 8, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 0, -56);
  }

  ctx.restore();

  if (opts.knockedDown) {
    ctx.save();
    ctx.translate(cx, cy - 24);
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('!', 0, 0);
    ctx.restore();
  }

  if (opts.lying) {
    // little drifting "z"s make it read as asleep/resting rather than
    // just standing still at the bed - offset rotates along with
    // lieAngle so it stays over the head no matter which way the bed
    // is oriented (60px "up" from the anchor, rotated the same amount
    // the body itself was)
    const lieAngle = opts.lieAngle || 0;
    ctx.save();
    ctx.translate(cx + 60 * Math.sin(lieAngle), cy - 60 * Math.cos(lieAngle));
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const t = performance.now() / 600;
    ctx.fillText('z', 6 + Math.sin(t) * 2, -Math.abs(Math.sin(t)) * 6);
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Z', 14 + Math.sin(t + 1) * 2, -6 - Math.abs(Math.sin(t + 1)) * 8);
    ctx.restore();
  }
}

// simple top-down motorcycle drawn under the rider's feet, rotated to
// whichever direction the player is currently facing. Wheels sized up and
// the frame stretched into more of a cruiser stance so the rider sits low
// and forward between them instead of perched high on a compact frame.
// a soft cone of light fanning out from a headlight in the direction
// (dx,dy), fading to nothing - used to make the motorcycle's headlight
// read as actually switched on rather than just a plain yellow dot
function drawHeadlightBeam(x, y, dx, dy, len) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  const spread = 0.36;
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, 'rgba(255,240,180,1)');
  grad.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, -len * Math.tan(spread));
  ctx.lineTo(len, len * Math.tan(spread));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMotorcycle(cx, cy, facing, color, lit, noShadow) {
  const frameColor = color || '#8f2e2e';
  ctx.save();
  ctx.translate(cx, cy - 6);
  ctx.scale(1.2, 1.2);

  if (facing === 'left' || facing === 'right') {
    const dir = facing === 'right' ? 1 : -1;
    ctx.scale(dir, 1);

    if (!noShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 13, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // rear wheel - bigger, with a visible tire tread ring
    ctx.fillStyle = '#0f0f0f';
    ctx.beginPath(); ctx.arc(-17, 9, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(-17, 9, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.arc(-17, 9, 3.5, 0, Math.PI * 2); ctx.fill();

    // front wheel - bigger too, slightly forward and matching size
    ctx.fillStyle = '#0f0f0f';
    ctx.beginPath(); ctx.arc(18, 9, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(18, 9, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.arc(18, 9, 3.5, 0, Math.PI * 2); ctx.fill();

    // low, stretched cruiser frame between the wheels, top-lit to match
    // every other vehicle/character instead of a flat fill
    const frameGrad = ctx.createLinearGradient(0, -6, 0, 6);
    frameGrad.addColorStop(0, shadeColor(frameColor, 22));
    frameGrad.addColorStop(1, shadeColor(frameColor, -16));
    ctx.fillStyle = frameGrad;
    ctx.beginPath();
    ctx.moveTo(-20, 6);
    ctx.lineTo(-9, -6);
    ctx.lineTo(12, -6);
    ctx.lineTo(21, 6);
    ctx.closePath();
    ctx.fill();

    // seat, wide and low for a cruiser sitting posture
    ctx.fillStyle = '#161616';
    ctx.fillRect(-13, -8, 18, 5);

    // front fork raked forward toward the handlebar
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, -6);
    ctx.lineTo(19, 6);
    ctx.stroke();

    // pulled-back cruiser handlebar
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(9, -15, 3, 8);
    ctx.fillRect(9, -16, 8, 3);

    // headlight - glowing with a beam when actually being ridden, just a
    // plain dark lens when parked/not in use
    if (lit) {
      drawHeadlightBeam(23, -3, 1, 0, 44);
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,140,0.9)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(23, -3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#7a6a4a';
      ctx.beginPath(); ctx.arc(23, -3, 3, 0, Math.PI * 2); ctx.fill();
    }

    // exhaust pipe running low along the far side
    ctx.fillStyle = '#888';
    ctx.fillRect(-14, 8, 26, 3);

  } else {
    if (facing === 'down') ctx.rotate(Math.PI);

    if (!noShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 3, 14, 22, 0, 0, Math.PI * 2); ctx.fill();
    }

    // front and rear wheels, bigger and stacked front-to-back
    ctx.fillStyle = '#0f0f0f';
    ctx.beginPath(); ctx.ellipse(0, -18, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 18, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.ellipse(0, -18, 4, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 18, 4, 5.5, 0, 0, Math.PI * 2); ctx.fill();

    // body/tank, wider and longer for the cruiser stance, same top-lit
    // gradient as the side view
    const tankGrad = ctx.createLinearGradient(0, -15, 0, 15);
    tankGrad.addColorStop(0, shadeColor(frameColor, 22));
    tankGrad.addColorStop(1, shadeColor(frameColor, -16));
    ctx.fillStyle = tankGrad;
    ctx.fillRect(-6, -15, 12, 30);

    // seat
    ctx.fillStyle = '#161616';
    ctx.fillRect(-7, 3, 14, 11);

    // headlight - glowing with a beam when actually being ridden, just a
    // plain dark lens when parked/not in use
    if (lit) {
      drawHeadlightBeam(0, -19, 0, -1, 36);
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,140,0.9)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(0, -19, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#7a6a4a';
      ctx.beginPath(); ctx.arc(0, -19, 3, 0, Math.PI * 2); ctx.fill();
    }

    // pulled-back handlebar, wider than the old straight bar
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-11, -15, 22, 3);
    ctx.fillRect(-11, -15, 3, 7);
    ctx.fillRect(8, -15, 3, 7);
  }

  ctx.restore();
}

// simple top-down car, boxier and wider than the motorcycle, four wheels
// visible in the side profile and a windshield band in every orientation
function drawCar(cx, cy, facing, color, police, nightFactor) {
  const bodyColor = color || '#8f2e2e';
  const lit = (nightFactor || 0) > 0.3;
  const fenderColor = shadeColor(bodyColor, -22);
  ctx.save();
  ctx.translate(cx, cy - 8);
  ctx.scale(2.0, 2.0);

  // metallic-ish hubcap gradient, reused for every wheel on the car
  function hubcapGradient(wx, wy, r) {
    const g = ctx.createRadialGradient(wx - r * 0.3, wy - r * 0.3, r * 0.1, wx, wy, r);
    g.addColorStop(0, '#e8e8e8');
    g.addColorStop(1, '#9a9a9a');
    return g;
  }

  if (facing === 'left' || facing === 'right') {
    const dir = facing === 'right' ? 1 : -1;
    ctx.scale(dir, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // fender bulges tuck the wheels into the body instead of them just
    // being bolted under a flat box - shaded a touch darker so they read
    // as recessed wells rather than flat body color
    ctx.fillStyle = fenderColor;
    ctx.beginPath(); ctx.ellipse(-19, 9, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(17, 9, 11, 7, 0, 0, Math.PI * 2); ctx.fill();

    // low rounded chassis, top-lit like every character sprite so the car
    // doesn't look like a flat color swatch next to everything else
    const chassisGrad = ctx.createLinearGradient(0, -6, 0, 12);
    chassisGrad.addColorStop(0, shadeColor(bodyColor, 20));
    chassisGrad.addColorStop(1, shadeColor(bodyColor, -16));
    ctx.fillStyle = chassisGrad;
    ctx.beginPath();
    ctx.roundRect(-30, -6, 60, 18, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // rounded cabin bump on top, set back slightly from the front so the
    // hood/windshield reads as sloped rather than a flat box
    const cabinGrad = ctx.createLinearGradient(0, -20, 0, -5);
    cabinGrad.addColorStop(0, shadeColor(bodyColor, 26));
    cabinGrad.addColorStop(1, shadeColor(bodyColor, -8));
    ctx.fillStyle = cabinGrad;
    ctx.beginPath();
    ctx.roundRect(-15, -20, 30, 15, [9, 7, 2, 2]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();

    // windshield glass, two panes split by a center pillar, with a soft
    // gradient instead of one flat blue
    const glassGrad = ctx.createLinearGradient(0, -17, 0, -7);
    glassGrad.addColorStop(0, '#c8e8f5');
    glassGrad.addColorStop(1, '#7fb0d0');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.roundRect(-11, -17, 24, 10, 4);
    ctx.fill();
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, -17);
    ctx.lineTo(3, -7);
    ctx.stroke();

    // door handle
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.lineTo(2, 0);
    ctx.stroke();

    // round wheels with a hubcap ring, sitting mostly below the body
    [-19, 17].forEach(wx => {
      ctx.fillStyle = '#0f0f0f';
      ctx.beginPath(); ctx.arc(wx, 11, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hubcapGradient(wx, 11, 5.5);
      ctx.beginPath(); ctx.arc(wx, 11, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f0f0f';
      ctx.beginPath(); ctx.arc(wx, 11, 2, 0, Math.PI * 2); ctx.fill();
    });

    // headlight / taillight - glowing with a beam once it's dark enough,
    // just plain lenses during the day
    if (lit) {
      drawHeadlightBeam(28, 4, 1, 0, 40);
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,140,0.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(28, 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'rgba(255,60,60,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(-28, 4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(28, 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c23a3a';
      ctx.beginPath(); ctx.arc(-28, 4, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    if (police) {
      // black-and-white door panel plus a red/blue light bar on the roof
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-14, -4, 28, 12);
      ctx.fillStyle = '#e03a3a';
      ctx.fillRect(-3, -24, 5, 3);
      ctx.fillStyle = '#3a5fe0';
      ctx.fillRect(2, -24, 5, 3);
    }

  } else {
    if (facing === 'down') ctx.rotate(Math.PI);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 16, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // wheels tucked at the corners, flush with the body edge rather than
    // sticking out past the silhouette the way they would from the side
    [[-11, -16], [11, -16], [-11, 14], [11, 14]].forEach(([wx, wy]) => {
      ctx.fillStyle = '#0f0f0f';
      ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hubcapGradient(wx, wy, 3);
      ctx.beginPath(); ctx.arc(wx, wy, 3, 0, Math.PI * 2); ctx.fill();
    });

    // main body - a plain rounded box, top-lit to match the side view and
    // every character sprite instead of one flat fill
    const bodyGrad = ctx.createLinearGradient(0, -24, 0, 20);
    bodyGrad.addColorStop(0, shadeColor(bodyColor, 20));
    bodyGrad.addColorStop(1, shadeColor(bodyColor, -16));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-16, -24, 32, 44, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // windshield band
    const glassGrad2 = ctx.createLinearGradient(0, -20, 0, -11);
    glassGrad2.addColorStop(0, '#c8e8f5');
    glassGrad2.addColorStop(1, '#7fb0d0');
    ctx.fillStyle = glassGrad2;
    ctx.fillRect(-12, -20, 24, 9);

    // roof panel, connected right to the back of the windshield, so the
    // car reads as having an actual flat roof instead of just a colored
    // box with a window near the front
    ctx.fillStyle = shadeColor(bodyColor, 14);
    ctx.fillRect(-13, -11, 26, 13);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-13, -11, 26, 13);

    // headlights - glowing with a beam once it's dark enough, just plain
    // lenses during the day
    if (lit) {
      drawHeadlightBeam(-9, -23, 0, -1, 34);
      drawHeadlightBeam(9, -23, 0, -1, 34);
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,140,0.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(-9, -23, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -23, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(-9, -23, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -23, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    if (police) {
      // black hood panel plus a red/blue light bar across the roof
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-14, 4, 28, 14);
      ctx.fillStyle = '#e03a3a';
      ctx.fillRect(-8, -11, 8, 3);
      ctx.fillStyle = '#3a5fe0';
      ctx.fillRect(0, -11, 8, 3);
    }
  }

  ctx.restore();
}

// nightlife spots get a colored, flickering neon sign instead of a plain
// nametag once it's dark enough - each flickers on its own schedule (seeded
// by building position) so they don't all stutter in lockstep
const NIGHTLIFE_SIGN_COLORS = {
  'Tavern': '#ff8a3a',
  'Bar': '#3ad6ff',
  'Strip Club': '#ff2ea6',
  'Casino': '#c86bff'
};

// true if the player is standing where this building's tall roof+wall
// sprite would otherwise be drawn on top of them (roughly: in front of its
// door, within its width) - used to fade the building so walking up to an
// entrance doesn't hide your own character behind it
function isPlayerBehindBuilding(b) {
  const ppx = player.x + player.w / 2;
  const ppy = player.y + player.h;
  const withinX = ppx > b.x + 4 && ppx < b.x + b.w - 4;
  const withinFront = ppy >= b.y + b.h - 10 && ppy <= b.y + b.h + b.wallDepth + 24;
  return withinX && withinFront;
}
