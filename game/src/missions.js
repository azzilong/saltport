// SALTPORT — missions + wanted + police response (step 7).
// Pure logic over the shared state object; the 3D actors are passed in so
// this file never touches the renderer. Called once per frame from main.js.
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
// and rams when it gets close, the helicopter shadows the hero from
// wanted 2, and the foot patrol joins the chase at wanted 3. Busted at
// zero health: Kade is dumped back at the spawn street, half his cash gone.
export function updatePolice(state, dt, t, actors) {
  const { hero, policeCar, cop, heli } = actors;
  const hp = hero.position;
  const dCar = Math.hypot(policeCar.position.x - hp.x, policeCar.position.z - hp.z);
  if (state.wanted >= 1 && dCar > 6) {
    const vx = (hp.x - policeCar.position.x) / dCar;
    const vz = (hp.z - policeCar.position.z) / dCar;
    policeCar.position.x += vx * 8 * dt;
    policeCar.position.z += vz * 8 * dt;
    policeCar.rotation.y = Math.atan2(vx, vz) + Math.PI;
    if (policeCar.userData.wheels) {
      for (const w of policeCar.userData.wheels) w.rotation.x += 8 * dt * 2;
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
    const tx = hp.x + 10, tz = hp.z - 10;
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
