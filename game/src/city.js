// SALTPORT — the one city data object. The 3D renderer, the minimap canvas
// and the phone map all read this object, so the three views can never drift.
// Grid: 10 x 9 blocks. One side (south, +z past the last row) is beach + sea.
export const CITY = {
  name: 'Saltport',
  cols: 10,
  rows: 9,
  block: 18,      // block side in world units
  street: 8,      // street width between blocks
  get pitch() { return this.block + this.street; },
  // 8 facade colours + 2 bright accents (pink, bright teal) so a small
  // share of buildings pops against the earth tones — the plain-8 look
  // read as warehouses. Accents stay rare (~20% of buildings).
  palette: ['#c96f4a', '#d9a05b', '#7d8c6f', '#5b7d8c', '#8c5b6e', '#b5b0a1', '#6f7d5b', '#a1887f', '#d65a8f', '#2fb8a6'],
  districts: [
    { name: 'Harborlight',  x0: 0, z0: 0, x1: 3, z1: 4, standing: 62, tint: '#5b7d8c', neon: '#2fd8c4' },
    { name: 'Old Cannery',  x0: 4, z0: 0, x1: 6, z1: 4, standing: 41, tint: '#8c5b6e', neon: '#ff5da2' },
    { name: 'Saltmarket',   x0: 7, z0: 0, x1: 9, z1: 4, standing: 78, tint: '#d9a05b', neon: '#ffd23c' },
    { name: 'Gulltown',     x0: 0, z0: 5, x1: 3, z1: 8, standing: 55, tint: '#7d8c6f', neon: '#7ee081' },
    { name: 'The Terraces', x0: 4, z0: 5, x1: 6, z1: 8, standing: 33, tint: '#6f7d5b', neon: '#ff9f43' },
    { name: 'Breakwater',   x0: 7, z0: 5, x1: 9, z1: 8, standing: 70, tint: '#c96f4a', neon: '#5aa9e0' },
  ],
  // South edge: sand strip then open sea, both past the last block row.
  beachDepth: 20,
  seaDepth: 90,
};

export const FLOOR_H = 3; // one floor = 3 world units

// Sea plane height, verified in the first build and kept in the rebuild:
// the sea sits at y = 0.0, above the base plane (y = -0.12), so the sea
// is visible in the city overview instead of being hidden under the ground.
export const SEA_Y = 0.0;

// Deterministic 0..1 hash of two integers (no Math.random: same city every run).
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

// World centre of a block (col 0..9, row 0..8). City is centred on the origin.
export function blockCenter(col, row) {
  const p = CITY.pitch;
  return {
    x: (col - (CITY.cols - 1) / 2) * p,
    z: (row - (CITY.rows - 1) / 2) * p,
  };
}

// District that owns a block, or null.
export function blockDistrict(col, row) {
  for (const d of CITY.districts) {
    if (col >= d.x0 && col <= d.x1 && row >= d.z0 && row <= d.z1) return d;
  }
  return null;
}

// District at a world position, or null (sea / outside).
export function districtAt(x, z) {
  const p = CITY.pitch;
  const col = Math.floor(x / p + CITY.cols / 2);
  const row = Math.floor(z / p + CITY.rows / 2);
  if (col < 0 || col >= CITY.cols || row < 0 || row >= CITY.rows) return null;
  return blockDistrict(col, row);
}

export function standingLabel(v) {
  return v >= 60 ? 'FRIENDLY' : v >= 40 ? 'NEUTRAL' : 'WARY';
}

// City extents in world units.
export function cityExtents() {
  const w = CITY.cols * CITY.block + (CITY.cols - 1) * CITY.street;
  const d = CITY.rows * CITY.block + (CITY.rows - 1) * CITY.street;
  return { w, d, x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 };
}

// Buildings of one block: 4 boxes hugging the block's north and south edges
// (facades on the street), 2-5 floors, palette colour by hash. Deterministic.
// Skyline towers: four blocks carry one tall slab (7-8 floors) each so
// the north edge reads as a skyline instead of a flat warehouse row.
const TOWERS = new Set(['8,0', '1,1', '9,1', '5,0']);

export function buildingSpots(col, row) {
  const c = blockCenter(col, row);
  const b = CITY.block;
  const spots = [];
  const edges = [
    { dx: -b / 4, dz: -b / 4, w: b / 2 - 1, d: b / 2 - 1 },
    { dx: b / 4, dz: -b / 4, w: b / 2 - 1, d: b / 2 - 1 },
    { dx: -b / 4, dz: b / 4, w: b / 2 - 1, d: b / 2 - 1 },
    { dx: b / 4, dz: b / 4, w: b / 2 - 1, d: b / 2 - 1 },
  ];
  for (let i = 0; i < 4; i++) {
    const e = edges[i];
    const h = hash2(col * 4 + i, row * 7 + 1);
    // Height skew: mostly 2-3 floors, sometimes 4-5, rarely 6 — so the
    // roofline steps visibly instead of reading as one flat warehouse
    // deck. The first building of a tower block is 7-8 floors.
    const isTower = i === 0 && TOWERS.has(col + ',' + row);
    const floors = isTower
      ? 7 + Math.floor(hash2(col * 9 + i, row * 3) * 2)
      : 2 + Math.floor(h * h * 5);
    const ci = Math.floor(hash2(col + 11, row * 3 + i * 5) * CITY.palette.length);
    spots.push({
      x: c.x + e.dx, z: c.z + e.dz, w: e.w, d: e.d,
      h: floors * FLOOR_H, floors,
      color: CITY.palette[ci],
    });
  }
  return spots;
}

// Signage: the first 3 blocks of each district (row-major) carry its name.
// Returns { x, z, text } for a block, or null.
export function blockSign(col, row) {
  const d = blockDistrict(col, row);
  if (!d) return null;
  const idx = (row - d.z0) * (d.x1 - d.x0 + 1) + (col - d.x0);
  if (idx >= 3) return null;
  const c = blockCenter(col, row);
  return { x: c.x, z: c.z - CITY.block / 2 + 0.3, text: d.name.toUpperCase() };
}

// Palm positions along the main street (the central east-west street, row 4/5
// boundary) and the beach front. Deterministic, evenly spaced.
export function palmSpots() {
  const spots = [];
  const ext = cityExtents();
  const p = CITY.pitch;
  for (let col = 0; col < CITY.cols; col++) {
    const x = (col - (CITY.cols - 1) / 2) * p;
    spots.push({ x, z: 0, side: 1 });
    spots.push({ x, z: ext.z1 + 6, side: -1 });
  }
  return spots;
}
