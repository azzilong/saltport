// SALTPORT — step 1: renderer + ground + one city block.
// Later steps add: full city, characters, vehicles, camera, HUD, missions.
import * as THREE from 'three';
import { CITY, blockCenter, blockDistrict, blockSign, buildingSpots, cityExtents, districtAt, palmSpots } from './city.js';
import { buildHero, buildEnemy, buildPolice, animateWalk } from './characterBuilder.js';
import { buildSedan, buildPoliceCar, buildHelicopter, animateWheels } from './vehicleBuilder.js';
import { updateHud, drawMinimap } from './hud.js';
import { updateMissions, updatePolice } from './missions.js';
import { togglePhone, drawPhone, toggleSaves, setSaveMode, clickSlot, closeOverlays, isPhoneOpen, isSavesOpen } from './phone.js';

window.addEventListener('error', (e) => { document.title = 'ERR: ' + e.message; });

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6); // day sky
scene.fog = new THREE.Fog(0x87b5d6, 260, 650);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);

// Day lighting (step 8 adds the night state).
const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x5a5a48, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(60, 120, 40);
scene.add(sun);

const matCache = new Map();
const MAT = (c) => {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c }));
  return matCache.get(c);
};
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const box = (w, h, d, c, x, y, z) => {
  const m = new THREE.Mesh(unitBox, MAT(c));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  scene.add(m);
  return m;
};
const cyl = (rt, rb, h, c, x, y, z, seg = 8) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), MAT(c));
  m.position.set(x, y, z);
  scene.add(m);
  return m;
};
const cone = (r, h, c, x, y, z, seg = 8) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), MAT(c));
  m.position.set(x, y, z);
  scene.add(m);
  return m;
};

// --- ground: outer base, asphalt city, sand beach, sea (south, +z) ---
const ext = cityExtents();
const base = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), MAT(0x5c6b4f));
base.rotation.x = -Math.PI / 2;
base.position.y = -0.12;
scene.add(base);

const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(ext.w + 16, ext.d + 16), MAT(0x3c4148));
asphalt.rotation.x = -Math.PI / 2;
asphalt.position.y = 0;
scene.add(asphalt);

const sand = new THREE.Mesh(new THREE.PlaneGeometry(ext.w + 16, CITY.beachDepth), MAT(0xd9c08a));
sand.rotation.x = -Math.PI / 2;
sand.position.set(0, 0.02, ext.z1 + 8 + CITY.beachDepth / 2);
scene.add(sand);

const sea = new THREE.Mesh(new THREE.PlaneGeometry(ext.w + 120, CITY.seaDepth), MAT(0x2e6f8e));
sea.rotation.x = -Math.PI / 2;
sea.position.set(0, 0.0, ext.z1 + 16 + CITY.beachDepth + CITY.seaDepth / 2);
scene.add(sea);

// --- the whole city: every block, roads, lights, palms, signs ---
// lampHeads is module-level so the day/night cycle can light them.
const lampHeads = [];
function buildCity() {
  const p = CITY.pitch;
  for (let row = 0; row < CITY.rows; row++) {
    for (let col = 0; col < CITY.cols; col++) {
      const c = blockCenter(col, row);
      box(CITY.block, 0.3, CITY.block, 0x9aa0a3, c.x, 0.15, c.z); // sidewalk pad
      for (const s of buildingSpots(col, row)) {
        box(s.w, s.h, s.d, s.color, s.x, 0.3 + s.h / 2, s.z); // body
        box(s.w + 0.4, 0.25, s.d + 0.4, 0x2e3138, s.x, 0.3 + s.h + 0.12, s.z); // roof
      }
      const sign = blockSign(col, row);
      if (sign) {
        const d = blockDistrict(col, row);
        box(3.2, 1, 0.15, d.tint, sign.x, 3.4, sign.z); // district sign board
      }
    }
  }
  // double yellow lines on every street centreline
  for (let c = 0; c < CITY.cols - 1; c++) {
    const x = (c - (CITY.cols - 1) / 2) * p + CITY.block / 2 + CITY.street / 2;
    box(0.3, 0.06, ext.d, 0xd8b400, x - 0.55, 0.06, 0);
    box(0.3, 0.06, ext.d, 0xd8b400, x + 0.55, 0.06, 0);
  }
  for (let r = 0; r < CITY.rows - 1; r++) {
    const z = (r - (CITY.rows - 1) / 2) * p + CITY.block / 2 + CITY.street / 2;
    box(ext.w, 0.06, 0.3, 0xd8b400, 0, 0.06, z - 0.55);
    box(ext.w, 0.06, 0.3, 0xd8b400, 0, 0.06, z + 0.55);
  }
  // street lights at intersections (pole + lamp head)
  for (let c = 0; c < CITY.cols - 1; c++) {
    for (let r = 0; r < CITY.rows - 1; r++) {
      const x = (c - (CITY.cols - 1) / 2) * p + CITY.block / 2 + CITY.street / 2;
      const z = (r - (CITY.rows - 1) / 2) * p + CITY.block / 2 + CITY.street / 2;
      cyl(0.09, 0.12, 4.2, 0x2e3138, x + 2.5, 2.1, z + 2.5);
      lampHeads.push(box(0.5, 0.18, 0.5, 0xffe9a8, x + 2.5, 4.3, z + 2.5));
    }
  }
  // palms along the main street and the beach front
  for (const pm of palmSpots()) {
    cyl(0.14, 0.2, 3.2, 0x7a5a34, pm.x, 1.6, pm.z);
    cone(1.3, 1.6, 0x3f7a3a, pm.x, 3.9, pm.z);
  }
}
buildCity();

// --- step 5: hero + NPCs + vehicles (wiring per the step-5 pattern) ---
// Spawn cluster stands on the Harborlight north-south street (x=-52,
// between blocks col 2 and col 3) so the opening district reads
// HARBORLIGHT and the over-shoulder camera has a clear street view.
// (A block centre is a walled courtyard — the camera would sit inside
// a building there.)
const hero = buildHero();
hero.position.set(-52, 0, -52);
hero.rotation.y = Math.PI; // faces north, toward the docks
scene.add(hero);

const enemy = buildEnemy();
enemy.position.set(-49, 0, -52);
scene.add(enemy);

const cop = buildPolice();
cop.position.set(-55, 0, -52);
scene.add(cop);

const car = buildSedan(0xc47a2b);
car.position.set(-52, 0, -47);
car.rotation.y = Math.PI / 2; // parked parallel to the street, along the curb
scene.add(car);

const policeCar = buildPoliceCar();
policeCar.position.set(-52, 0, -65);
policeCar.rotation.y = Math.PI; // parked facing north on the street
scene.add(policeCar);

const heli = buildHelicopter();
heli.position.set(15, 22, -35);
scene.add(heli);

// --- step 6: live game state (HUD + minimap read this object) ---
const MISSIONS = [
  { name: 'First Light', objective: 'Get to the docks.',
    next: 'reach the marker', marker: { x: -52, z: -108 },
    time: 12 * 60, reward: 250 },
  { name: 'Second Tide', objective: 'Pick up the parcel at Saltmarket.',
    next: 'collect the parcel', marker: { x: 91, z: -52 },
    time: 10 * 60, reward: 400 },
  { name: 'Last Call', objective: 'Deliver to the Breakwater safehouse.',
    next: 'reach the safehouse', marker: { x: 91, z: 78 },
    time: 8 * 60, reward: 600 },
];
const state = {
  money: 0, day: 1, clockMin: 8 * 60, health: 100, armour: 0, weapon: 1,
  wanted: 1, district: districtAt(hero.position.x, hero.position.z),
  heroPos: hero.position, heliPos: heli.position,
  missions: MISSIONS, missionIdx: 0, missionTimer: MISSIONS[0].time,
  allDone: false, dispatch: ['SPD DISPATCH: Kade Rowan spotted in Harborlight.'],
  units: [],
};
const log = (s) => { state.dispatch.unshift(s); if (state.dispatch.length > 8) state.dispatch.pop(); };

// WASD / arrow keys move the hero (north is -z, toward the docks).
// Number keys switch the weapon slot.
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === '1' || e.key === '2' || e.key === '3') state.weapon = Number(e.key);
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// --- step 7: mission marker beacon (gold pillar + spinning diamond) ---
const markerMesh = new THREE.Group();
const pillar = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 8, 0.6),
  new THREE.MeshLambertMaterial({ color: 0xffb347, transparent: true, opacity: 0.55 }));
pillar.position.y = 4;
const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), MAT(0xffb347));
diamond.position.y = 9;
markerMesh.add(pillar, diamond);
scene.add(markerMesh);

// --- step-5 camera: third-person over-the-shoulder (dist 5-7, height 3, FOV 60) ---
// Follows the hero: offset is behind the hero relative to where he faces,
// lerped every frame so the camera glides instead of snapping.
const camTarget = new THREE.Vector3(hero.position.x + 2.0, 3.2, hero.position.z + 6.8);
const camLook = new THREE.Vector3(hero.position.x, 1.3, hero.position.z - 6);
camera.position.copy(camTarget);
camera.lookAt(camLook);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Demo hooks (?wanted=3&mission=2&pos=-52,-100&cam=wide&time=21:30):
// deterministic states for screenshots. Not gameplay features.
const qp = new URLSearchParams(location.search);
if (qp.has('wanted')) state.wanted = Math.max(0, Math.min(3, Number(qp.get('wanted'))));
if (qp.has('mission')) {
  state.missionIdx = Math.min(Number(qp.get('mission')), MISSIONS.length - 1);
  state.missionTimer = MISSIONS[state.missionIdx].time;
}
if (qp.has('pos')) {
  const [px, pz] = qp.get('pos').split(',').map(Number);
  hero.position.set(px, 0, pz);
}
if (qp.has('money')) state.money = Number(qp.get('money'));
if (qp.has('health')) state.health = Number(qp.get('health'));
if (qp.has('armour')) state.armour = Number(qp.get('armour'));
if (qp.has('time')) {
  const [hh, mm] = qp.get('time').split(':').map(Number);
  state.clockMin = hh * 60 + mm;
}
state.camMode = qp.get('cam') || 'street';
// Demo: with wanted >= 2 the helicopter starts already shadowing the hero
// (its in-game lerp from the far spawn would not converge in a screenshot).
if (state.wanted >= 2) heli.position.set(hero.position.x + 10, 13, hero.position.z - 10);

// --- step 8: day/night cycle (2 lighting states, driven by the clock) ---
function applyDayNight() {
  const night = state.clockMin >= 20 * 60 || state.clockMin < 6 * 60;
  if (night === state.isNight) return;
  state.isNight = night;
  if (night) {
    scene.background.set(0x0e1a2e);
    scene.fog.color.set(0x0e1a2e);
    hemi.intensity = 0.35;
    sun.intensity = 0.25;
    sun.color.set(0x9ab8e8);
    for (const h of lampHeads) h.material = MAT(0xfff6c8);
  } else {
    scene.background.set(0x87b5d6);
    scene.fog.color.set(0x87b5d6);
    hemi.intensity = 0.9;
    sun.intensity = 1.6;
    sun.color.set(0xfff2d8);
    for (const h of lampHeads) h.material = MAT(0xffe9a8);
  }
}
state.isNight = false;

// --- step 8: title screen + start. Demo URLs (?...) skip the title. ---
state.started = qp.size > 0;
const titleEl = document.getElementById('title');
if (state.started) {
  titleEl.style.display = 'none';
} else {
  titleEl.style.display = 'flex';
  document.getElementById('title-start').addEventListener('click', () => {
    state.started = true;
    titleEl.style.display = 'none';
  });
}

// --- step 8: phone (TAB/P), saves (Q), ESC closes overlays ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); togglePhone(state); }
  else if (e.key.toLowerCase() === 'p') togglePhone(state);
  else if (e.key.toLowerCase() === 'q') toggleSaves();
  else if (e.key === 'Escape') closeOverlays();
});
document.getElementById('saves-mode-save').addEventListener('click', () => setSaveMode('save'));
document.getElementById('saves-mode-load').addEventListener('click', () => setSaveMode('load'));
document.querySelectorAll('.save-slot').forEach((el) => {
  el.addEventListener('click', () => { log(clickSlot(Number(el.dataset.save), state, hero)); });
});
if (qp.has('phone')) togglePhone(state);
if (qp.has('saves')) toggleSaves();

const clock = new THREE.Clock();
const minimap = document.getElementById('minimap');
const HERO_SPEED = 6;
let carSpeed = 0; // sedan parked; wheels turn when it drives
let frames = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // --- movement: WASD/arrows, hero turns to face the direction of travel ---
  // (paused behind the title screen until START)
  let mx = 0, mz = 0;
  if (state.started) {
    mx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    mz = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
  }
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    hero.position.x += mx * HERO_SPEED * dt;
    hero.position.z += mz * HERO_SPEED * dt;
    hero.position.x = Math.max(-ext.x1 - 8, Math.min(ext.x1 + 8, hero.position.x));
    hero.position.z = Math.max(ext.z0 - 8, Math.min(ext.z1 + 8 + CITY.beachDepth, hero.position.z));
    const targetRy = Math.atan2(mx, mz);
    let dRy = targetRy - hero.rotation.y;
    while (dRy > Math.PI) dRy -= 2 * Math.PI;
    while (dRy < -Math.PI) dRy += 2 * Math.PI;
    hero.rotation.y += dRy * Math.min(1, dt * 10);
  }
  animateWalk(hero, t, moving);
  animateWheels(car, carSpeed, dt);
  if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 20;
  // --- missions + police response (paused behind the title screen) ---
  if (state.started) {
    updateMissions(state, dt, log);
    updatePolice(state, dt, t, { hero, policeCar, cop, heli });
  }
  // --- mission marker beacon tracks the current objective ---
  if (state.allDone) {
    markerMesh.visible = false;
  } else {
    const mk = state.missions[state.missionIdx].marker;
    markerMesh.visible = true;
    markerMesh.position.set(mk.x, 0, mk.z);
    diamond.rotation.y += dt * 2;
    diamond.position.y = 9 + Math.sin(t * 2) * 0.5;
  }
  // --- live state: clock, district, police unit distances ---
  if (state.started) {
    state.clockMin += dt; // 1 game minute per real second
    if (state.clockMin >= 24 * 60) { state.clockMin -= 24 * 60; state.day += 1; }
  }
  applyDayNight();
  state.district = districtAt(hero.position.x, hero.position.z);
  const distTo = (p) => Math.round(Math.hypot(p.x - hero.position.x, p.z - hero.position.z));
  state.units = [
    { name: "SPD-7 'Harbor'", role: 'Pursuit', kind: 'car', pos: policeCar.position, dist: distTo(policeCar.position) },
    { name: "SPD-12 'Gull'", role: 'Foot patrol', kind: 'foot', pos: cop.position, dist: distTo(cop.position) },
  ];
  if (state.wanted >= 2) {
    state.units.push({ name: "SPD-AIR 'Kestrel'", role: 'Air support', kind: 'air', pos: heli.position, dist: distTo(heli.position) });
  }
  // --- camera: street follow, wide chase view, or high overview ---
  if (state.camMode === 'overview') {
    // Low-angle from the sea looking north: sea + beach in the foreground,
    // the whole city grid behind them.
    camera.position.set(0, 70, 300);
    camera.lookAt(0, 0, 40);
  } else {
    const ry = hero.rotation.y;
    const fx = Math.sin(ry), fz = Math.cos(ry);
    const dist = state.camMode === 'wide' ? 13 : 6.8;
    const height = state.camMode === 'wide' ? 5.5 : 3.2;
    const lookH = state.camMode === 'wide' ? 6 : 1.3;
    camTarget.set(
      hero.position.x - fx * dist - fz * 2.0,
      height,
      hero.position.z - fz * dist + fx * 2.0);
    camLook.set(hero.position.x + fx * 6, lookH, hero.position.z + fz * 6);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 5));
    camera.lookAt(camLook);
  }
  // --- HUD + minimap + phone map from live state ---
  updateHud(state);
  drawMinimap(minimap, state, t);
  drawPhone(state, t);
  renderer.render(scene, camera);
  if (++frames === 2) window.__saltportReady = true;
}
loop();
