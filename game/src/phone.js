// SALTPORT — in-game phone + save slots (re-written in-session for
// rebuild #3, recording 5). Phone: one app (MAP) drawn from the same
// city object as the minimap. Saves: 3 localStorage slots, SAVE/LOAD
// mode, slot labels show what is stored. Keys: TAB or P = phone,
// Q = save menu, ESC = close overlays.
import { drawPhoneMap } from './hud.js';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

let phoneOpen = false;
let savesOpen = false;
let saveMode = 'save'; // 'save' | 'load'

export function isPhoneOpen() { return phoneOpen; }
export function isSavesOpen() { return savesOpen; }

export function togglePhone(state) {
  phoneOpen = !phoneOpen;
  $('phone').style.display = phoneOpen ? 'flex' : 'none';
  if (phoneOpen) drawPhoneMap($('phone-map'), state, 0);
}

export function drawPhone(state, t) {
  if (phoneOpen) drawPhoneMap($('phone-map'), state, t);
}

export function closeOverlays() {
  phoneOpen = false;
  savesOpen = false;
  $('phone').style.display = 'none';
  $('saves').style.display = 'none';
}

// --- save slots ------------------------------------------------------------
const KEY = (n) => `saltport-save-${n}`;

export function slotLabel(n) {
  const raw = localStorage.getItem(KEY(n));
  if (!raw) return `SLOT ${n} — empty`;
  try {
    const d = JSON.parse(raw);
    const hh = pad2(Math.floor(d.clockMin / 60) % 24);
    const mm = pad2(Math.floor(d.clockMin) % 60);
    return `SLOT ${n} — Day ${d.day} ${hh}:${mm} · $${d.money} · Mission ${Math.min(d.missionIdx + 1, 3)}/3`;
  } catch (e) {
    return `SLOT ${n} — unreadable`;
  }
}

export function refreshSaves() {
  const title = $('saves-title');
  if (title) title.textContent = saveMode === 'save' ? 'SAVE GAME' : 'LOAD GAME';
  document.querySelectorAll('.save-slot').forEach((el) => {
    el.textContent = slotLabel(Number(el.dataset.save));
  });
  const bs = $('saves-mode-save');
  const bl = $('saves-mode-load');
  if (bs) bs.classList.toggle('on', saveMode === 'save');
  if (bl) bl.classList.toggle('on', saveMode === 'load');
}

export function toggleSaves() {
  savesOpen = !savesOpen;
  $('saves').style.display = savesOpen ? 'flex' : 'none';
  if (savesOpen) refreshSaves();
}

export function setSaveMode(mode) {
  saveMode = mode;
  refreshSaves();
}

export function clickSlot(n, state, hero) {
  if (saveMode === 'save') {
    const d = {
      money: state.money, day: state.day, clockMin: state.clockMin,
      health: state.health, armour: state.armour, weapon: state.weapon,
      wanted: state.wanted, missionIdx: state.missionIdx,
      missionTimer: state.missionTimer, allDone: state.allDone,
      heroX: hero.position.x, heroZ: hero.position.z,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY(n), JSON.stringify(d));
    refreshSaves();
    return `Saved to slot ${n}.`;
  }
  const raw = localStorage.getItem(KEY(n));
  if (!raw) return `Slot ${n} is empty.`;
  try {
    const d = JSON.parse(raw);
    state.money = d.money; state.day = d.day; state.clockMin = d.clockMin;
    state.health = d.health; state.armour = d.armour; state.weapon = d.weapon;
    state.wanted = d.wanted; state.missionIdx = d.missionIdx;
    state.missionTimer = d.missionTimer; state.allDone = d.allDone;
    hero.position.set(d.heroX, 0, d.heroZ);
    hero.rotation.y = Math.PI;
    refreshSaves();
    return `Loaded slot ${n}.`;
  } catch (e) {
    return `Slot ${n} is unreadable.`;
  }
}
