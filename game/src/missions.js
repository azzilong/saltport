// SALTPORT — missions + wanted + police response (re-written in-session
// for rebuild #3, recording 5). Pure logic over the shared state object;
// the 3D actors are passed in so this file never touches the renderer.
// Called once per frame from main.js.
import { animateWalk } from './characterBuilder.js';

export const SPAWN = { x: -52, z: -52 };

// Mission clock + marker reach. Completing a stage pays the reward, opens
// the next mission and raises the heat: job 2 brings wanted 2 (air
// support), job 3 brings wanted 3 (every unit converges).
export function updateMissions(state, dt, log) {
  if (state.allDone) return;
  const m = state.missions[state.missionIdx];
  state.missionTimer -= dt;
  if (state.missionTimer <= 0) {
    state.missionTimer = m.time;
    log(`MISSION FAILED: ${m.name} — out of time. Try again.`);
    return;
  }
  const dx = state.heroPos.x - m.marker.x;
  const dz = state.heroPos.z - m.marker.z;
  if (Math.hypot(dx, dz) > 5) return;
  state.money += m.reward;
  log(`${m.name} complete — +$${m.reward}.`);
  state.missionIdx += 1;
  if (state.missionIdx >= state.missions.length) {
    state.allDone = true;
    log('ALL MISSIONS COMPLETE — Saltport is yours, Kade.');
    return;
  }
  const next = state.missions[state.missionIdx];
  state.missionTimer = next.time;
  if (state.missionIdx === 1) {
    state.wanted = 2;
    log('SPD DISPATCH: wanted level 2 — air support scrambled.');
  }
  if (state.missionIdx === 2) {
    state.wanted = 3;
    log('SPD DISPATCH: wanted level 3 — all units converge.');
  }
}

// Police response, driven by the wanted level. The pursuit car closes in
// fast (12 u/s, up from 8) so the closing is visible in a chase frame, and
// rams when it gets close; the helicopter shadows the hero from wanted 2,
// hovering low (13) with its searchlight beam on; the foot patrol joins
// the chase at wanted 3. Busted at zero health: Kade is dumped back at
// the spawn street, half his cash gone.
export function updatePolice(state, dt, t, actors) {
  const { hero, policeCar, cop, heli } = actors;
  const hp = hero.position;
  const dCar = Math.hypot(policeCar.position.x - hp.x, policeCar.position.z - hp.z);
  if (state.wanted >= 1 && dCar > 6) {
    const vx = (hp.x - policeCar.position.x) / dCar;
    const vz = (hp.z - policeCar.position.z) / dCar;
    policeCar.position.x += vx * 12 * dt;
    policeCar.position.z += vz * 12 * dt;
    policeCar.rotation.y = Math.atan2(vx, vz) + Math.PI;
    if (policeCar.userData.wheels) {
      for (const w of policeCar.userData.wheels) w.rotation.x += 12 * dt * 2;
    }
  }
  if (state.wanted >= 2 && dCar < 4) {
    state.health -= 4 * dt;
    if (!state._ramCd || t - state._ramCd > 10) {
      state._ramCd = t;
      log2(state, "SPD-7 'Harbor' is ramming Kade!");
    }
  }
  if (state.wanted >= 2) {
    // Shadow point is ahead of the hero, so the heli stays in the
    // over-shoulder camera's view with its beam on the street ahead.
    const tx = hp.x, tz = hp.z - 20;
    const k = 1 - Math.exp(-dt * 2.0);
    heli.position.x += (tx - heli.position.x) * k;
    heli.position.z += (tz - heli.position.z) * k;
    heli.position.y += (13 - heli.position.y) * k;
  }
  let copMoving = false;
  if (state.wanted >= 3) {
    const dCop = Math.hypot(cop.position.x - hp.x, cop.position.z - hp.z);
    if (dCop > 3) {
      const vx = (hp.x - cop.position.x) / dCop;
      const vz = (hp.z - cop.position.z) / dCop;
      cop.position.x += vx * 3.5 * dt;
      cop.position.z += vz * 3.5 * dt;
      cop.rotation.y = Math.atan2(vx, vz);
      copMoving = true;
    }
  }
  animateWalk(cop, t, copMoving);
  if (state.health <= 0) {
    state.health = 100;
    state.armour = 0;
    state.money = Math.floor(state.money / 2);
    state.wanted = 1;
    hero.position.set(SPAWN.x, 0, SPAWN.z);
    hero.rotation.y = Math.PI;
    log2(state, 'BUSTED — Kade dumped back on the street, half the cash gone.');
  }
}

function log2(state, s) {
  state.dispatch.unshift(s);
  if (state.dispatch.length > 8) state.dispatch.pop();
}

// --- ITEM DROPS: cash + weapon pickups (pure data; main.js renders them) ---
// Every fallen Rusthook drops cash ($25–$50); 1 in 3 also drops a weapon
// (SMG unlock with ammo if Kade does not own it yet, else a PISTOL ammo
// refill). Two fixed weapon pickups sit in the world: the docks in
// Harborlight and a street in Old Cannery. Walk-over radius is 1.5.
export const PICKUP_RADIUS = 1.5;
const FIXED_WEAPON_SPOTS = [
  { x: -52, z: -100, label: 'the docks' },
  { x: 0, z: -52, label: 'Old Cannery' },
];

export function spawnDrop(state, kind, x, z, opts = {}) {
  const p = { kind, x, z, phase: Math.random() * 6.28 };
  if (kind === 'cash') p.amount = opts.amount ?? (25 + Math.floor(Math.random() * 26));
  if (kind === 'weapon') p.weapon = opts.weapon ?? (state.owned[3] ? 2 : 3);
  state.pickups.push(p);
  return p;
}

// Drops from one fallen Rusthook: always cash, 1-in-3 a weapon too.
// Drops land along the street (z offsets keep x on the street — an
// east/west offset would land inside the block's buildings).
export function spawnEnemyDrops(state, x, z) {
  spawnDrop(state, 'cash', x, z - 2.0);
  if (Math.random() < 1 / 3) spawnDrop(state, 'weapon', x, z + 2.0);
}

// The two fixed world weapon pickups (SMG while it is still locked).
export function spawnFixedPickups(state) {
  for (const s of FIXED_WEAPON_SPOTS) spawnDrop(state, 'weapon', s.x, s.z, { weapon: 3 });
}

// Walk-over collection: cash raises the HUD $ counter with a +$XX log
// line; a weapon you own refills to full, a new one unlocks + equips.
export function updatePickups(state, log) {
  if (!state.pickups.length) return;
  const hp = state.heroPos;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i];
    if (Math.hypot(p.x - hp.x, p.z - hp.z) > PICKUP_RADIUS) continue;
    state.pickups.splice(i, 1);
    if (p.kind === 'cash') {
      state.money += p.amount;
      log(`+$${p.amount} — cash picked up.`);
    } else {
      const w = state.weapons[p.weapon];
      const full = p.weapon === 2 ? 48 : 90;
      if (!state.owned[p.weapon]) {
        state.owned[p.weapon] = true;
        w.mag = w.magSize;
        w.reserve = full;
        state.weapon = p.weapon;
        log(`PICKED UP — ${w.name} unlocked!`);
      } else {
        w.mag = w.magSize;
        w.reserve = full;
        log(`PICKED UP — ${w.name} ammo refilled.`);
      }
    }
  }
}
