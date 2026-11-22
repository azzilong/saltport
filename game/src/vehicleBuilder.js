import * as THREE from 'three';

function box(w, h, d, color, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.MeshLambertMaterial({
    color,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  return new THREE.Mesh(g, m);
}

function wheel(radius = 0.35, color = 0x111111) {
  const g = new THREE.CylinderGeometry(radius, radius, 0.18, 10);
  g.rotateZ(Math.PI / 2); // sumbu roda jadi X
  const m = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(g, m);
}

/**
 * Mobil dasar. Proporsi: panjang 4.2, lebar 1.8, tinggi 1.4.
 * @returns {THREE.Group} dengan userData.wheels untuk animasi putar
 */
export function buildCar(opts = {}) {
  const bodyColor = opts.bodyColor ?? 0xc47a2b;
  const g = new THREE.Group();

  // Body utama
  const body = box(1.8, 0.5, 4.2, bodyColor);
  body.position.y = 0.55;
  g.add(body);

  // Kabin
  const cabin = box(1.55, 0.55, 2.0, bodyColor);
  cabin.position.set(0, 1.05, -0.1);
  g.add(cabin);

  // Kaca depan & belakang (gelap semi-transparan)
  const glassMat = { transparent: true, opacity: 0.6 };
  const windshield = box(1.5, 0.45, 0.05, 0x223344, glassMat);
  windshield.position.set(0, 1.05, 0.92);
  windshield.rotation.x = -0.25;
  g.add(windshield);

  const rearGlass = box(1.5, 0.45, 0.05, 0x223344, glassMat);
  rearGlass.position.set(0, 1.05, -1.1);
  rearGlass.rotation.x = 0.25;
  g.add(rearGlass);

  // Lampu depan & belakang
  for (const sx of [-0.6, 0.6]) {
    const hl = box(0.25, 0.12, 0.05, 0xfff2c0);
    hl.position.set(sx, 0.6, 2.11);
    g.add(hl);
    const tl = box(0.25, 0.12, 0.05, 0xff2222);
    tl.position.set(sx, 0.6, -2.11);
    g.add(tl);
  }

  // Roda
  const wheels = [];
  const wpos = [
    [-0.9, 0.35, 1.35], [0.9, 0.35, 1.35],
    [-0.9, 0.35, -1.35], [0.9, 0.35, -1.35],
  ];
  for (const [x, y, z] of wpos) {
    const w = wheel(0.35);
    w.position.set(x, y, z);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;

  return g;
}

export function buildSedan(color = 0xc47a2b) {
  return buildCar({ bodyColor: color });
}

export function buildVan(color = 0xdddddd) {
  const v = buildCar({ bodyColor: color });
  // perbesar kabin untuk van
  v.children[1].scale.set(1.0, 1.3, 1.6);
  v.children[1].position.y = 1.15;
  return v;
}

export function buildPoliceCar() {
  const p = buildCar({ bodyColor: 0x1e2a44 });
  // lampu atap biru/merah
  const blue = box(0.3, 0.12, 0.3, 0x2266ff);
  blue.position.set(-0.25, 1.45, 0);
  p.add(blue);
  const red = box(0.3, 0.12, 0.3, 0xff2222);
  red.position.set(0.25, 1.45, 0);
  p.add(red);
  return p;
}

export function buildScooter(color = 0xff66aa) {
  const g = new THREE.Group();
  const body = box(0.4, 0.3, 1.2, color);
  body.position.y = 0.5;
  g.add(body);
  const seat = box(0.35, 0.15, 0.5, 0x111111);
  seat.position.set(0, 0.7, -0.2);
  g.add(seat);
  const w1 = wheel(0.25);
  w1.position.set(0, 0.25, 0.5);
  g.add(w1);
  const w2 = wheel(0.25);
  w2.position.set(0, 0.25, -0.5);
  g.add(w2);
  g.userData.wheels = [w1, w2];
  return g;
}

export function buildHelicopter(color = 0x334455) {
  const g = new THREE.Group();
  const body = box(1.2, 0.9, 2.4, color);
  body.position.y = 1.5;
  g.add(body);
  const tail = box(0.3, 0.3, 1.8, color);
  tail.position.set(0, 1.5, -1.8);
  g.add(tail);
  // rotor utama (akan diputar di main.js)
  const rotorG = new THREE.BoxGeometry(3.5, 0.05, 0.2);
  const rotorM = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(rotorG, rotorM);
  rotor.position.set(0, 2.05, 0);
  g.add(rotor);
  g.userData.rotor = rotor;
  return g;
}

/**
 * Animasi roda berputar. Panggil tiap frame.
 * @param {THREE.Group} vehicle
 * @param {number} speed - kecepatan gerak (unit/detik)
 * @param {number} dt - delta time
 */
export function animateWheels(vehicle, speed, dt) {
  const wheels = vehicle.userData.wheels;
  if (!wheels) return;
  for (const w of wheels) w.rotation.x += speed * dt * 2;
}
