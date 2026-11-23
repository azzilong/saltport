// SALTPORT — HUD wiring + map drawing (step 6, rebuilt in-session).
// updateHud() writes every fixed-ID HUD element from live game state.
// drawCityMap() renders the ONE city data object (city.js) to any 2D canvas
// — the 250x250 minimap and the 1000x860 phone map are the same drawing,
// so the three views (3D, minimap, phone) can never drift.
import { CITY, cityExtents, districtAt, standingLabel } from './city.js';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

export function fmtClock(day, mins) {
  return `DAY ${day}  ${pad2(Math.floor(mins / 60) % 24)}:${pad2(Math.floor(mins) % 60)}`;
}

export function fmtTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

// Ammo text for the current weapon slot: FISTS shows -- / --, guns show
// magazine / reserve, e.g. 11 / 48 — it drops by one on every shot.
// A locked slot (SMG before a weapon drop unlocks it) also shows -- / --.
export function fmtAmmo(state) {
  const w = state.weapons && state.weapons[state.weapon];
  if (!w || w.magSize === 0) return '-- / --';
  if (state.weapon > 1 && state.owned && !state.owned[state.weapon]) return '-- / --';
  return `${w.mag} / ${w.reserve}`;
}

// Write all HUD DOM from the live state object. Cheap: called every frame,
// but only touches textContent/style when the value actually changed.
export function updateHud(state) {
  const set = (el, v) => { if (el && el._v !== v) { el._v = v; el.textContent = v; } };
  set($('hud-money'), '$' + state.money);
  set($('hud-clock'), fmtClock(state.day, state.clockMin));
  const stars = $('hud-wanted');
  if (stars) {
    const html = [0, 1, 2].map((i) =>
      `<span class="${i < state.wanted ? 'on' : 'off'}">&#9733;</span>`).join('');
    if (stars._v !== html) { stars._v = html; stars.innerHTML = html; }
  }
  // Wanted banner: appears the moment the police are alerted (wanted >= 2),
  // and names the air unit once it is deployed (wanted 3).
  const banner = $('hud-banner');
  if (banner) {
    const text = state.wanted >= 3
      ? 'WANTED \u2605\u2605\u2605 AIR UNIT DEPLOYED'
      : state.wanted >= 2
        ? 'WANTED \u2605 PATROL ALERTED'
        : '';
    banner.style.display = text ? 'block' : 'none';
    set(banner, text);
  }
  const d = state.district;
  set($('hud-district-name'), d ? d.name.toUpperCase() : 'SALTport'.toUpperCase());
  const bar = $('hud-standing');
  if (bar) bar.style.width = (d ? d.standing : 50) + '%';
  set($('hud-standing-label'),
    d ? `${standingLabel(d.standing)} · ${d.standing}` : 'AT SEA · —');
  const hp = $('hud-health');
  if (hp) hp.style.width = Math.max(0, state.health) + '%';
  const ar = $('hud-armour');
  if (ar) ar.style.width = Math.max(0, state.armour) + '%';
  set($('hud-ammo'), fmtAmmo(state));
  document.querySelectorAll('#hud-weapons .slot').forEach((s) => {
    const slot = Number(s.dataset.slot);
    s.classList.toggle('on', slot === state.weapon);
    // Locked weapon slots (SMG until a drop unlocks it) render dimmed.
    const locked = slot > 1 && state.owned && !state.owned[slot];
    s.classList.toggle('locked', locked);
    s.style.opacity = locked ? '0.35' : '';
  });
  const m = state.missions[state.missionIdx];
  if (m) {
    set($('mission-stage'), state.allDone ? 'ALL MISSIONS COMPLETE'
      : `MISSION ${state.missionIdx + 1} / ${state.missions.length}`);
    set($('mission-name'), state.allDone ? 'SALTport IS YOURS' : m.name.toUpperCase());
    set($('mission-objective'), state.allDone ? 'Kade Rowan owns the harbour now.'
      : m.objective);
    set($('mission-timer'), state.allDone ? '—' : fmtTimer(state.missionTimer));
    set($('mission-next'), state.allDone ? 'NEXT: enjoy the city'
      : 'NEXT: ' + m.next);
  }
  const log = $('dispatch-log');
  if (log) {
    const lines = [];
    for (const u of state.units) {
      lines.push(`<div><b>${u.name}</b> · ${u.role} · ${u.dist}m</div>`);
    }
    for (const entry of state.dispatch.slice(0, 4)) {
      lines.push(`<div>${entry}</div>`);
    }
    const html = lines.join('');
    if (log._v !== html) { log._v = html; log.innerHTML = html; }
  }
}

// --- one map drawing, two canvases ---------------------------------------
// World rect shown on every map: whole city + beach + sea to the south.
const MAP = { x0: -140, x1: 140, z0: -130, z1: 250 };

export function drawCityMap(ctx, w, h, opts) {
  const s = Math.min(w / (MAP.x1 - MAP.x0), h / (MAP.z1 - MAP.z0));
  const ox = (w - (MAP.x1 - MAP.x0) * s) / 2 - MAP.x0 * s;
  const oz = (h - (MAP.z1 - MAP.z0) * s) / 2 - MAP.z0 * s;
  const X = (x) => ox + x * s;
  const Z = (z) => oz + z * s;
  const ext = cityExtents();

  ctx.fillStyle = '#0e1a24';
  ctx.fillRect(0, 0, w, h);
  // sea (south) then sand beach, then asphalt city ground
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(X(ext.x0 - 60), Z(ext.z1 + 8 + CITY.beachDepth),
    (ext.w + 120) * s, CITY.seaDepth * s);
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(X(ext.x0 - 8), Z(ext.z1 + 8), (ext.w + 16) * s, CITY.beachDepth * s);
  ctx.fillStyle = '#3c4148';
  ctx.fillRect(X(ext.x0 - 8), Z(ext.z0 - 8), (ext.w + 16) * s, (ext.d + 16) * s);
  // district tints
  for (const d of CITY.districts) {
    const x0 = (d.x0 - CITY.cols / 2) * CITY.pitch - CITY.block / 2;
    const x1 = (d.x1 - CITY.cols / 2) * CITY.pitch + CITY.block / 2;
    const z0 = (d.z0 - CITY.rows / 2) * CITY.pitch - CITY.block / 2;
    const z1 = (d.z1 - CITY.rows / 2) * CITY.pitch + CITY.block / 2;
    ctx.fillStyle = d.tint;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s);
    ctx.globalAlpha = 1;
    if (opts.labels) {
      ctx.fillStyle = '#e8e4d8';
      ctx.font = `bold ${Math.max(11, s * 7)}px Verdana`;
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), X((x0 + x1) / 2), Z((z0 + z1) / 2));
    }
  }
  // streets: double yellow centre lines read as thin gold lines
  ctx.fillStyle = '#d8b400';
  for (let c = 0; c < CITY.cols - 1; c++) {
    const x = (c - (CITY.cols - 1) / 2) * CITY.pitch + CITY.block / 2 + CITY.street / 2;
    ctx.fillRect(X(x) - 1, Z(ext.z0), 2, ext.d * s);
  }
  for (let r = 0; r < CITY.rows - 1; r++) {
    const z = (r - (CITY.rows - 1) / 2) * CITY.pitch + CITY.block / 2 + CITY.street / 2;
    ctx.fillRect(X(ext.x0), Z(z) - 1, ext.w * s, 2);
  }
  // mission marker: pulsing gold diamond
  if (opts.marker) {
    const r = (3 + Math.sin(opts.t * 4) * 1.5) * Math.max(1, s * 0.5);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(X(opts.marker.x), Z(opts.marker.z) - r * 1.6);
    ctx.lineTo(X(opts.marker.x) + r, Z(opts.marker.z));
    ctx.lineTo(X(opts.marker.x), Z(opts.marker.z) + r * 1.6);
    ctx.lineTo(X(opts.marker.x) - r, Z(opts.marker.z));
    ctx.closePath();
    ctx.fill();
  }
  // police units: blue dots (car + foot), helicopter grey dot
  for (const p of opts.police || []) {
    ctx.fillStyle = '#5aa9e0';
    ctx.beginPath();
    ctx.arc(X(p.x), Z(p.z), Math.max(2.5, s * 1.6), 0, 7);
    ctx.fill();
  }
  if (opts.heli) {
    ctx.fillStyle = '#c9d4dc';
    ctx.beginPath();
    ctx.arc(X(opts.heli.x), Z(opts.heli.z), Math.max(3, s * 2), 0, 7);
    ctx.fill();
  }
  // hero: white dot, red ring
  if (opts.hero) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(X(opts.hero.x), Z(opts.hero.z), Math.max(3, s * 2), 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#b23a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(opts.hero.x), Z(opts.hero.z), Math.max(5, s * 3.2), 0, 7);
    ctx.stroke();
  }
}

// Minimap: same drawing, no labels, hero + marker + police.
export function drawMinimap(canvas, state, t) {
  const ctx = canvas.getContext('2d');
  drawCityMap(ctx, canvas.width, canvas.height, {
    t,
    hero: { x: state.heroPos.x, z: state.heroPos.z },
    marker: state.allDone ? null : state.missions[state.missionIdx].marker,
    police: state.units.filter((u) => u.kind !== 'air').map((u) => u.pos),
    heli: state.wanted >= 2 ? state.heliPos : null,
    labels: false,
  });
}

// Phone map: same drawing, bigger, with district labels.
export function drawPhoneMap(canvas, state, t) {
  const ctx = canvas.getContext('2d');
  drawCityMap(ctx, canvas.width, canvas.height, {
    t,
    hero: { x: state.heroPos.x, z: state.heroPos.z },
    marker: state.allDone ? null : state.missions[state.missionIdx].marker,
    police: state.units.filter((u) => u.kind !== 'air').map((u) => u.pos),
    heli: state.wanted >= 2 ? state.heliPos : null,
    labels: true,
  });
}
