import * as THREE from 'three';

// Palet warna — ubah di sini saja untuk membuat varian baru.
const COLORS = {
  skinColor: 0xc98a5b,
  heroCoat: 0xb23a2e,   // warna jaket khas hero (ganti sesuai ceritamu)
  enemyTop: 0xe07b22,   // seragam faksi musuh
  policeTop: 0x2b3a55,  // seragam polisi
  pantsColor: 0x2a2f36,
  shoesColor: 0x141414,
  hairColor: 0x1b1b1b,
};

// Helper: box dengan material flat.
function box(w, h, d, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(g, m);
}

// Helper: capsule (lengan/kaki) — lebih halus dari box, hemat segmen.
function capsule(radius, length, color) {
  const g = new THREE.CapsuleGeometry(radius, length, 3, 6);
  const m = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(g, m);
}

// Helper: kepala — box dengan sedikit bevel via sphere segmen rendah.
function head(color) {
  const g = new THREE.SphereGeometry(0.13, 8, 6);
  const m = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(g, m);
  mesh.scale.set(1, 1.1, 1); // sedikit lonjong
  return mesh;
}

/**
 * Membangun karakter manusia proporsi realistis.
 * @param {object} opts - { topColor, skinColor, pantsColor, shoesColor, hairColor }
 * @returns {THREE.Group} grup dengan sendi bernama untuk animasi
 */
export function buildCharacter(opts = {}) {
  const c = { ...COLORS, ...opts };
  const g = new THREE.Group();

  // --- Badan (torso) ---
  const torso = box(0.42, 0.55, 0.22, c.topColor ?? c.heroCoat);
  torso.position.y = 1.05;
  g.add(torso);

  // --- Kepala + rambut ---
  const headMesh = head(c.skinColor);
  headMesh.position.y = 1.5;
  g.add(headMesh);

  const hair = box(0.28, 0.1, 0.28, c.hairColor);
  hair.position.y = 1.6;
  g.add(hair);

  // --- Lengan (kiri & kanan) — pivot di bahu ---
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, 1.28, 0);
    const upper = capsule(0.06, 0.3, c.topColor ?? c.heroCoat);
    upper.position.y = -0.15;
    pivot.add(upper);
    const lower = capsule(0.055, 0.28, c.skinColor);
    lower.position.y = -0.45;
    pivot.add(lower);
    return pivot;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  g.add(armL, armR);

  // --- Kaki (kiri & kanan) — pivot di pinggul ---
  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, 0.78, 0);
    const thigh = capsule(0.075, 0.34, c.pantsColor);
    thigh.position.y = -0.18;
    pivot.add(thigh);
    const shin = capsule(0.07, 0.32, c.pantsColor);
    shin.position.y = -0.5;
    pivot.add(shin);
    const shoe = box(0.14, 0.08, 0.22, c.shoesColor);
    shoe.position.set(0, -0.68, 0.04);
    pivot.add(shoe);
    return pivot;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  g.add(legL, legR);

  // Simpan referensi sendi untuk animasi.
  g.userData.joints = { armL, armR, legL, legR, torso, headMesh };

  // Tinggi total ~1.8 unit (kaki 0.78 + torso 0.55 + kepala 0.26 + leher).
  return g;
}

/**
 * Animasi jalan sederhana via rotasi sendi.
 * @param {THREE.Group} character - hasil buildCharacter
 * @param {number} t - waktu (detik)
 * @param {boolean} moving - apakah karakter bergerak
 */
export function animateWalk(character, t, moving) {
  const j = character.userData.joints;
  if (!j) return;
  if (moving) {
    const s = Math.sin(t * 8);
    j.legL.rotation.x = s * 0.5;
    j.legR.rotation.x = -s * 0.5;
    j.armL.rotation.x = -s * 0.4;
    j.armR.rotation.x = s * 0.4;
  } else {
    // idle: napas halus
    const b = Math.sin(t * 1.5) * 0.02;
    j.torso.position.y = 1.05 + b;
    j.legL.rotation.x = 0;
    j.legR.rotation.x = 0;
    j.armL.rotation.x = 0;
    j.armR.rotation.x = 0;
  }
}

// Varian siap pakai — panggil dari main.js.
export function buildHero() {
  return buildCharacter({ topColor: COLORS.heroCoat });
}
export function buildEnemy() {
  return buildCharacter({ topColor: COLORS.enemyTop });
}
export function buildPolice() {
  const p = buildCharacter({ topColor: COLORS.policeTop });
  // topi polisi
  const hat = box(0.3, 0.08, 0.3, 0x111111);
  hat.position.y = 1.62;
  p.add(hat);
  return p;
}
