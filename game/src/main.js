// SALTPORT — renderer + city + characters + vehicles + shooting + chase.
// Rebuilt in-session for the Saltport rebuild (gta6-01).
import * as THREE from 'three';
import { CITY, blockCenter, blockDistrict, blockSign, buildingSpots, cityExtents, districtAt, hash2, palmSpots } from './city.js';
import { buildHero, buildEnemy, buildPolice, buildCharacter, animateWalk, animateAim } from './characterBuilder.js';
import { buildSedan, buildPoliceCar, buildHelicopter, animateWheels } from './vehicleBuilder.js';
import { updateHud, drawMinimap } from './hud.js';
import { updateMissions, updatePolice, spawnEnemyDrops, spawnFixedPickups, spawnDrop, updatePickups } from './missions.js';
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

// --- building detail: windows, roof props, awnings, neon (Karimbu-style) ---
// Windows + roof props + awnings are InstancedMeshes (one draw call each)
// so ~5,000 windows stay cheap. Window glass swaps colour at night.
const winLitMat = new THREE.MeshLambertMaterial({ color: 0x4a6a7a });
const winDarkMat = new THREE.MeshLambertMaterial({ color: 0x2a3542 });
const neonMats = new Map();
const NEON_MAT = (c) => {
  if (!neonMats.has(c)) neonMats.set(c, new THREE.MeshBasicMaterial({ color: c }));
  return neonMats.get(c);
};
const neonBox = (w, h, d, c, x, y, z) => {
  const m = new THREE.Mesh(unitBox, NEON_MAT(c));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  scene.add(m);
  return m;
};
const winLit = [], winDark = [], propAC = [], propTank = [], propAnt = [];
const awnCoral = [], awnTeal = [], shopGlass = [];
const _dummy = new THREE.Object3D();
function makeInstanced(list, geo, mat) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((m, i) => {
    _dummy.position.set(m.x, m.y, m.z);
    _dummy.rotation.set(0, m.ry || 0, 0);
    _dummy.scale.set(m.sx, m.sy, m.sz);
    _dummy.updateMatrix();
    im.setMatrixAt(i, _dummy.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
  return im;
}
function collectBuildingDetail(s, c, col, row) {
  const dx = s.x - c.x, dz = s.z - c.z;
  const i = (dx > 0 ? 1 : 0) + (dz > 0 ? 2 : 0);
  const shopFace = row === 4 && dz > 0 ? 'S' : row === 5 && dz < 0 ? 'N' : null;
  // Windows: 2 per floor on each OUTER face (the face toward a street).
  // The shopfront face gets shop glass on the ground floor instead.
  const faces = [];
  if (dz < 0) faces.push({ face: 'N', z: s.z - s.d / 2 - 0.05, horizontal: true });
  if (dz > 0) faces.push({ face: 'S', z: s.z + s.d / 2 + 0.05, horizontal: true });
  if (dx < 0) faces.push({ face: 'W', x: s.x - s.w / 2 - 0.05, horizontal: false });
  if (dx > 0) faces.push({ face: 'E', x: s.x + s.w / 2 + 0.05, horizontal: false });
  for (const f of faces) {
    for (let fl = 0; fl < s.floors; fl++) {
      if (f.face === shopFace && fl === 0) continue; // shop glass instead
      const y = 0.3 + fl * 3 + 1.7;
      for (const o of [-s.w / 4, s.w / 4]) {
        const lit = hash2(col * 13 + i * 3, row * 7 + fl * 2 + (f.face === 'N' ? 0 : 1)) < 0.55;
        const m = f.horizontal
          ? { x: s.x + o, y, z: f.z, sx: 0.9, sy: 1.2, sz: 0.08 }
          : { x: f.x, y, z: s.z + o, ry: Math.PI / 2, sx: 0.9, sy: 1.2, sz: 0.08 };
        (lit ? winLit : winDark).push(m);
      }
    }
  }
  // Roof prop: AC box, water tank, or antenna, by hash.
  const r = hash2(col * 7 + i, row * 5 + 2);
  const px = s.x + (hash2(col + i, row) - 0.5) * s.w * 0.4;
  const pz = s.z + (hash2(col, row + i) - 0.5) * s.d * 0.4;
  const roofY = 0.3 + s.h;
  if (r < 0.4) propAC.push({ x: px, y: roofY + 0.4, z: pz, sx: 1.4, sy: 0.8, sz: 1.1 });
  else if (r < 0.7) propTank.push({ x: px, y: roofY + 0.9, z: pz, sx: 1, sy: 1, sz: 1 });
  else propAnt.push({ x: px, y: roofY + 1.75, z: pz, sx: 1, sy: 1, sz: 1 });
  // Shopfront on the main-street face: awning + lit shop glass.
  if (shopFace) {
    const fz = shopFace === 'S' ? s.z + s.d / 2 : s.z - s.d / 2;
    const dir = shopFace === 'S' ? 1 : -1;
    const awn = hash2(col * 3 + i, row * 11) < 0.5 ? awnCoral : awnTeal;
    awn.push({ x: s.x, y: 2.7, z: fz + dir * 0.75, sx: s.w, sy: 0.22, sz: 1.5 });
    shopGlass.push({ x: s.x, y: 1.35, z: fz + dir * 0.06, sx: s.w * 0.75, sy: 2.0, sz: 0.12 });
    // A few main-street shops get a neon sign above the awning.
    if (hash2(col * 5 + i, row * 13) < 0.3) {
      neonBox(2.4, 0.9, 0.15, hash2(col + i, row + 2) < 0.5 ? 0xff5da2 : 0x2fd8c4,
        s.x, 4.4, fz + dir * 0.12);
    }
  }
}
function buildDetailMeshes() {
  makeInstanced(winLit, unitBox, winLitMat);
  makeInstanced(winDark, unitBox, winDarkMat);
  makeInstanced(propAC, unitBox, new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
  makeInstanced(propTank, new THREE.CylinderGeometry(0.9, 0.9, 1.8, 10),
    new THREE.MeshLambertMaterial({ color: 0x7a8a94 }));
  makeInstanced(propAnt, new THREE.CylinderGeometry(0.06, 0.09, 3.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x2e3138 }));
  makeInstanced(awnCoral, unitBox, new THREE.MeshLambertMaterial({ color: 0xe07b22 }));
  makeInstanced(awnTeal, unitBox, new THREE.MeshLambertMaterial({ color: 0x2fb8a6 }));
  makeInstanced(shopGlass, unitBox, winLitMat);
}

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
        collectBuildingDetail(s, c, col, row); // windows, roof prop, shopfront
      }
      const sign = blockSign(col, row);
      if (sign) {
        const d = blockDistrict(col, row);
        box(3.2, 1, 0.15, d.tint, sign.x, 3.4, sign.z); // district sign board
        // Neon tube frame around the board (district neon colour, unlit =
        // always bright, reads as a glowing sign day and night).
        neonBox(3.6, 1.25, 0.2, d.neon, sign.x, 3.4, sign.z);
        neonBox(3.0, 0.45, 0.24, 0xffffff, sign.x, 3.4, sign.z);
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
  buildDetailMeshes(); // windows, roof props, awnings, shop glass
}
buildCity();

// --- street life: furniture, parked cars, traffic, pedestrians ----------
// Benches sit on the sidewalk pads (pad top y=0.3) at the street edge;
// the back goes on the outer (pad) side.
function bench(x, z, ry) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(unitBox, MAT(0x7a5a34));
  seat.scale.set(0.6, 0.12, 1.8);
  seat.position.y = 0.5;
  const back = new THREE.Mesh(unitBox, MAT(0x7a5a34));
  back.scale.set(0.1, 0.7, 1.8);
  back.position.set(-0.3, 0.85, 0);
  const leg1 = new THREE.Mesh(unitBox, MAT(0x2e3138));
  leg1.scale.set(0.5, 0.5, 0.12);
  leg1.position.set(0, 0.25, -0.7);
  const leg2 = leg1.clone();
  leg2.position.z = 0.7;
  g.add(seat, back, leg1, leg2);
  g.position.set(x, 0.3, z);
  g.rotation.y = ry;
  scene.add(g);
}
bench(-56.8, -45, 0);
bench(-47.2, -60, Math.PI);
bench(-56.8, -80, 0);
bench(-47.2, -95, Math.PI);
bench(-20, 8.5, -Math.PI / 2);
bench(30, 17.5, Math.PI / 2);
// Red hydrants + trash bins on the sidewalk edges.
for (const [hx, hz] of [[-56.8, -50], [-47.2, -90]]) {
  cyl(0.18, 0.22, 0.7, 0xb23a2e, hx, 0.65, hz);
  cyl(0.12, 0.12, 0.15, 0xb23a2e, hx, 1.08, hz);
}
for (const [bx, bz] of [[-56.8, -58], [-47.2, -75], [-20, 8.5], [20, 17.5]]) {
  cyl(0.35, 0.3, 0.9, 0x2e4a34, bx, 0.75, bz);
}
// Bus stop shelter on the main street, south side, near the spawn street.
cyl(0.08, 0.08, 2.4, 0x2e3138, -44, 1.2, 16.5);
cyl(0.08, 0.08, 2.4, 0x2e3138, -40, 1.2, 16.5);
box(4.6, 0.15, 1.6, 0x5b7d8c, -42, 2.5, 16.5); // shelter roof
neonBox(1.2, 0.7, 0.12, 0xffd23c, -42, 2.0, 16.0); // BUS sign
bench(-42, 16.3, Math.PI / 2); // shelter bench

// Parked cars fill both sides of the streets: the spawn street (cover
// frame) and the main street (overview frame). Cars face +z at rot 0,
// so north = PI, east = PI/2, west = -PI/2.
function park(color, x, z, ry) {
  const p = buildSedan(color);
  p.position.set(x, 0, z);
  p.rotation.y = ry;
  scene.add(p);
  return p;
}
park(0x5b7d8c, -55.1, -70, Math.PI);   // spawn street, west curb, north
park(0x3f6fb5, -48.9, -85, 0);        // spawn street, east curb, south
park(0xd9a05b, -80, 9.9, Math.PI / 2);  // main street, north curb, east
park(0xb23a2e, -20, 9.9, Math.PI / 2);
park(0x5b7d8c, 30, 16.1, -Math.PI / 2); // main street, south curb, west
park(0x3f6fb5, 90, 16.1, -Math.PI / 2);

// Slow traffic on the main street (z=12 eastbound, z=14 westbound);
// cars bounce at the city ends so nothing teleports across the frame.
const traffic = [];
function addTraffic(color, x, z, dir) {
  const m = buildSedan(color);
  m.position.set(x, 0, z);
  m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(m);
  traffic.push({ mesh: m, dir, speed: 4 });
}
addTraffic(0x3f6fb5, -60, 12, 1);
addTraffic(0xd9a05b, 70, 12, 1);
addTraffic(0x2fb8a6, 10, 14, -1);

// Pedestrians on the sidewalks (pad top y=0.3), varied top colours,
// walking their stretch back and forth.
const PED_TOPS = [0x2fb8a6, 0xd65a8f, 0xe8b13c, 0x7d8c6f, 0x5b7d8c, 0xc96f4a, 0x8c5b6e, 0x3f6fb5];
const pedestrians = [];
function addPedestrian(topColor, axis, fixed, min, max, start) {
  const m = buildCharacter({ topColor });
  m.position.set(axis === 'x' ? start : fixed, 0.3, axis === 'x' ? fixed : start);
  scene.add(m);
  pedestrians.push({ mesh: m, axis, fixed, min, max, pos: start, dir: 1, speed: 1.2 + Math.random() * 0.8 });
}
addPedestrian(PED_TOPS[0], 'z', -56.8, -100, -40, -60);
addPedestrian(PED_TOPS[1], 'z', -56.8, -100, -40, -90);
addPedestrian(PED_TOPS[2], 'z', -47.2, -100, -40, -50);
addPedestrian(PED_TOPS[3], 'z', -47.2, -100, -40, -80);
addPedestrian(PED_TOPS[4], 'x', 8.5, -100, 100, -40);
addPedestrian(PED_TOPS[5], 'x', 8.5, -100, 100, 60);
addPedestrian(PED_TOPS[6], 'x', 17.5, -100, 100, 0);
addPedestrian(PED_TOPS[7], 'x', 17.5, -100, 100, 80);

// --- hero + NPCs + vehicles ---
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

// --- live game state (HUD + minimap read this object) ---
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
// Weapon slots: 1 FISTS (no ammo), 2 PISTOL 12/48, 3 SMG 30/90.
const WEAPONS = {
  1: { name: 'FISTS', magSize: 0, mag: 0, reserve: 0 },
  2: { name: 'PISTOL', magSize: 12, mag: 12, reserve: 48 },
  3: { name: 'SMG', magSize: 30, mag: 30, reserve: 90 },
};
const state = {
  money: 0, day: 1, clockMin: 8 * 60, health: 100, armour: 0, weapon: 1,
  weapons: WEAPONS,
  owned: { 2: true, 3: false }, // PISTOL owned from the start, SMG locked
  pickups: [], // item drops (cash / weapon), data in missions.js
  wanted: 1, district: districtAt(hero.position.x, hero.position.z),
  heroPos: hero.position, heliPos: heli.position,
  missions: MISSIONS, missionIdx: 0, missionTimer: MISSIONS[0].time,
  allDone: false, dispatch: ['SPD DISPATCH: Kade Rowan spotted in Harborlight.'],
  units: [], enemyDown: false, shotsFired: 0,
};
const log = (s) => { state.dispatch.unshift(s); if (state.dispatch.length > 8) state.dispatch.pop(); };
// Two fixed weapon pickups in the world: the docks (Harborlight) + Old Cannery.
spawnFixedPickups(state);

// --- SHOOTING: mouse aim + left-click fire, tracer + muzzle flash, R reload ---
// Tracer: a bright yellow line from the muzzle to the aim point, visible
// briefly after every shot (persistent in ?shoot demo screenshots).
const tracerGeo = new THREE.BufferGeometry();
tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe14a }));
tracer.visible = false;
tracer.frustumCulled = false;
scene.add(tracer);
const flash = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xffe14a }));
flash.visible = false;
scene.add(flash);
let tracerUntil = 0;
let aimPoint = new THREE.Vector3(-49, 1.2, -52); // default: the Rusthook
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const mouseNdc = new THREE.Vector2();

function aimFromScreen(clientX, clientY) {
  mouseNdc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouseNdc, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) aimPoint.copy(hit);
  aimPoint.y = 1.2;
  // Hero turns to face the aim point while holding a gun.
  if (state.weapon > 1) {
    hero.rotation.y = Math.atan2(aimPoint.x - hero.position.x, aimPoint.z - hero.position.z);
  }
}
canvas.addEventListener('pointermove', (e) => aimFromScreen(e.clientX, e.clientY));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2) { aimFromScreen(e.clientX, e.clientY); return; } // right-click aims
  if (e.button === 0) fireShot();
});

function reloadWeapon() {
  const w = state.weapons[state.weapon];
  if (!w || w.magSize === 0 || w.mag === w.magSize || w.reserve === 0) return;
  const need = w.magSize - w.mag;
  const take = Math.min(need, w.reserve);
  w.mag += take;
  w.reserve -= take;
  log(`${w.name} reloaded — ${w.mag}/${w.reserve}.`);
}

function fireShot() {
  if (!state.started) return;
  const w = state.weapons[state.weapon];
  if (!w || w.magSize === 0) return; // fists: no shot
  if (!state.owned[state.weapon]) return; // locked slot cannot fire
  if (w.mag <= 0) { log(`${w.name} empty — press R to reload.`); return; }
  w.mag -= 1;
  state.shotsFired += 1;
  // Muzzle at the hero's shoulder, tracer to the aim point.
  const fx = Math.sin(hero.rotation.y), fz = Math.cos(hero.rotation.y);
  const muzzle = new THREE.Vector3(
    hero.position.x + fx * 0.6, 1.35, hero.position.z + fz * 0.6);
  const pos = tracerGeo.attributes.position;
  pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
  pos.setXYZ(1, aimPoint.x, aimPoint.y, aimPoint.z);
  pos.needsUpdate = true;
  tracer.visible = true;
  tracerUntil = performance.now() + (state.demoTracer ? 60000 : 90);
  flash.position.copy(muzzle);
  flash.visible = true;
  setTimeout(() => { flash.visible = false; }, 60);
  animateAim(hero, true);
  setTimeout(() => animateAim(hero, false), 180);
  // Hit: the Rusthook falls when the aim line passes near him.
  if (!state.enemyDown) {
    const toEnemy = new THREE.Vector3().subVectors(enemy.position, hero.position);
    toEnemy.y = 0;
    const dist = toEnemy.length();
    const aimDir = new THREE.Vector3().subVectors(aimPoint, hero.position);
    aimDir.y = 0;
    const ang = dist > 0.5 && aimDir.length() > 0.5
      ? Math.acos(Math.max(-1, Math.min(1, toEnemy.normalize().dot(aimDir.normalize()))))
      : 9;
    if (dist < 20 && ang < 0.4) {
      state.enemyDown = true;
      enemy.rotation.x = -Math.PI / 2; // falls flat on his back
      enemy.position.y = 0.25;
      log('Rusthook down — Kade dropped him.');
      spawnEnemyDrops(state, enemy.position.x, enemy.position.z);
    }
  }
  // Firing draws the police instantly, like the top game: wanted jumps.
  if (state.wanted < 2) {
    state.wanted = 2;
    log('WANTED — shots fired! SPD patrol alerted, air support scrambled.');
  }
}

// --- ITEM DROPS: cash + weapon pickups ------------------------------------
// Pickup visuals: a small floating box bobbing above a soft glow ring on
// the ground. Cash is a green bundle, weapons are a dark gun shape.
// Meshes are synced from state.pickups (data lives in missions.js).
// Sidewalk pads sit 0.3 above the street: pickups landing on a block
// (inside a block rect) ride at pad height so the glow ring is not
// swallowed by the pad edge. Streets, beach and sea are ground level.
function groundHeight(x, z) {
  const p = CITY.pitch;
  const col = Math.floor(x / p + CITY.cols / 2);
  const row = Math.floor(z / p + CITY.rows / 2);
  if (col < 0 || col >= CITY.cols || row < 0 || row >= CITY.rows) return 0;
  const cx = (col - (CITY.cols - 1) / 2) * p;
  const cz = (row - (CITY.rows - 1) / 2) * p;
  return (Math.abs(x - cx) < CITY.block / 2 && Math.abs(z - cz) < CITY.block / 2) ? 0.3 : 0;
}
const pickupMeshes = new Map();
function buildPickupMesh(p) {
  const g = new THREE.Group();
  let item;
  if (p.kind === 'cash') {
    item = new THREE.Group();
    const bundle = new THREE.Mesh(unitBox, MAT(0x35c463)); // bright green, reads on asphalt
    bundle.scale.set(0.7, 0.25, 0.5);
    const band = new THREE.Mesh(unitBox, MAT(0xd9c08a));
    band.scale.set(0.72, 0.08, 0.52);
    item.add(bundle, band);
  } else {
    item = new THREE.Group();
    const body = new THREE.Mesh(unitBox, MAT(0x2e333b)); // dark steel, not asphalt-black
    body.scale.set(0.6, 0.12, 0.18);
    const barrel = new THREE.Mesh(unitBox, MAT(0x2e333b));
    barrel.scale.set(0.35, 0.08, 0.08);
    barrel.position.set(0, 0.02, 0.28);
    const grip = new THREE.Mesh(unitBox, MAT(0x3a2a1a));
    grip.scale.set(0.1, 0.25, 0.12);
    grip.position.set(0, -0.12, -0.15);
    item.add(body, barrel, grip);
  }
  item.position.y = 0.4;
  g.add(item);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.95, 20),
    new THREE.MeshBasicMaterial({
      color: p.kind === 'cash' ? 0x4ade80 : 0xffb347,
      transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  g.userData.item = item;
  g.position.set(p.x, groundHeight(p.x, p.z), p.z);
  scene.add(g);
  return g;
}
function syncPickups(t) {
  for (const p of state.pickups) {
    if (!pickupMeshes.has(p)) pickupMeshes.set(p, buildPickupMesh(p));
  }
  for (const [p, g] of pickupMeshes) {
    if (!state.pickups.includes(p)) {
      scene.remove(g);
      pickupMeshes.delete(p);
    }
  }
  for (const [p, g] of pickupMeshes) {
    g.userData.item.position.y = 0.4 + Math.sin(t * 2 + p.phase) * 0.12;
    g.userData.item.rotation.y += 0.01;
  }
}

// WASD / arrow keys move the hero (north is -z, toward the docks).
// Number keys switch the weapon slot. R reloads.
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === '1' || e.key === '2' || e.key === '3') {
    const slot = Number(e.key);
    if (slot === 1 || state.owned[slot]) state.weapon = slot;
    else log(`${state.weapons[slot].name} locked — find a weapon drop.`);
  }
  if (e.key.toLowerCase() === 'r') reloadWeapon();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// --- mission marker beacon (gold pillar + spinning diamond) ---
const markerMesh = new THREE.Group();
const pillar = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 8, 0.6),
  new THREE.MeshLambertMaterial({ color: 0xffb347, transparent: true, opacity: 0.55 }));
pillar.position.y = 4;
const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), MAT(0xffb347));
diamond.position.y = 9;
markerMesh.add(pillar, diamond);
scene.add(markerMesh);

// --- camera: third-person over-the-shoulder (dist 5-7, height 3, FOV 60) ---
const camTarget = new THREE.Vector3(hero.position.x + 2.0, 3.2, hero.position.z + 6.8);
const camLook = new THREE.Vector3(hero.position.x, 1.3, hero.position.z - 6);
camera.position.copy(camTarget);
camera.lookAt(camLook);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Demo hooks (?wanted=3&mission=2&pos=-52,-100&cam=wide&time=21:30&shoot=1):
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
if (qp.has('weapon')) state.weapon = Number(qp.get('weapon'));
// Demo drops: ?drops places a cash pickup within walk-over range (it is
// collected on the first frames: +$40 in the log, $ counter up) and a
// weapon pickup just out of reach, visible in frame. ?drops=all puts
// both in range, proving the SMG unlock path (slot 3 owned, 30/90).
if (qp.has('drops')) {
  const all = qp.get('drops') === 'all';
  spawnDrop(state, 'cash', hero.position.x + 1, hero.position.z - 1, { amount: 40 });
  // Weapon pickup sits clear of the hero's AND the enemy's silhouettes
  // (right side, further ahead) so it reads in the over-shoulder view.
  // (North is -z: ahead means z MINUS the offset. x stays on the street:
  // the sidewalk pads sit 0.3 higher and would swallow the glow ring.)
  spawnDrop(state, 'weapon', hero.position.x + (all ? -1 : 3.5), hero.position.z - (all ? 1 : 6), { weapon: 3 });
}
state.camMode = qp.get('cam') || 'street';
// Demo: with wanted >= 2 the helicopter starts already shadowing the hero
// (its in-game lerp from the far spawn would not converge in a screenshot).
if (state.wanted >= 2) heli.position.set(hero.position.x, 10, hero.position.z - 20);
// Demo chase: the pursuit car starts close, visibly closing in.
if (state.wanted >= 3) policeCar.position.set(hero.position.x + 2, 0, hero.position.z - 14);
// Demo shooting: hero aims at the Rusthook with the pistol and fires once
// (tracer stays visible, ammo reads 11/48, the enemy falls).
if (qp.has('shoot')) {
  state.demoTracer = true;
  state.weapon = 2;
  enemy.position.set(hero.position.x + 4, 0, hero.position.z - 6);
  aimPoint.set(enemy.position.x, 1.2, enemy.position.z);
  hero.rotation.y = Math.atan2(aimPoint.x - hero.position.x, aimPoint.z - hero.position.z);
}

// --- day/night cycle (2 lighting states, driven by the clock) ---
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
    winLitMat.color.set(0xffd97a); // lit windows glow warm at night
    winDarkMat.color.set(0x141c26);
  } else {
    scene.background.set(0x87b5d6);
    scene.fog.color.set(0x87b5d6);
    hemi.intensity = 0.9;
    sun.intensity = 1.6;
    sun.color.set(0xfff2d8);
    for (const h of lampHeads) h.material = MAT(0xffe9a8);
    winLitMat.color.set(0x4a6a7a); // day: glass reads dark blue-grey
    winDarkMat.color.set(0x2a3542);
  }
}
state.isNight = false;

// --- title screen + start. Demo URLs (?...) skip the title. ---
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

// --- phone (TAB/P), saves (Q), ESC closes overlays ---
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
// Demo shot fires after the first frames, once the scene is up.
if (qp.has('shoot')) setTimeout(() => fireShot(), 300);

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
  // Traffic + pedestrians move only once the game has started.
  if (state.started) {
    for (const tc of traffic) {
      tc.mesh.position.x += tc.dir * tc.speed * dt;
      if (tc.mesh.position.x > 125) { tc.dir = -1; tc.mesh.rotation.y = -Math.PI / 2; }
      if (tc.mesh.position.x < -125) { tc.dir = 1; tc.mesh.rotation.y = Math.PI / 2; }
      animateWheels(tc.mesh, tc.speed, dt);
    }
    for (const p of pedestrians) {
      p.pos += p.dir * p.speed * dt;
      if (p.pos > p.max) { p.pos = p.max; p.dir = -1; }
      if (p.pos < p.min) { p.pos = p.min; p.dir = 1; }
      if (p.axis === 'z') {
        p.mesh.position.set(p.fixed, 0.3, p.pos);
        p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
      } else {
        p.mesh.position.set(p.pos, 0.3, p.fixed);
        p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      animateWalk(p.mesh, t, true);
    }
  }
  if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 20;
  // Heli searchlight beam: a pale cone straight down from the heli,
  // visible while the chase is on (wanted >= 2).
  if (heli.userData.beam) heli.userData.beam.visible = state.wanted >= 2;
  // Tracer fades shortly after a shot (stays up in ?shoot demos).
  if (tracer.visible && !state.demoTracer && performance.now() > tracerUntil) tracer.visible = false;
  // --- missions + police response + pickups (paused behind the title screen) ---
  if (state.started) {
    updateMissions(state, dt, log);
    updatePolice(state, dt, t, { hero, policeCar, cop, heli });
    updatePickups(state, log);
  }
  syncPickups(t);
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
