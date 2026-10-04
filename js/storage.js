// localStorage wrapper. Every access is guarded: Safari in private mode throws
// on setItem, and a corrupt value must never stop the game from starting.

const PREFIX = 'penguinshore.';

function get(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (err) { /* ignore */ }
}

// ----- the colony (game.js normalises whatever comes back) -----
export const loadRun = () => get('run', null);
export const saveRun = (snap) => set('run', snap);
export const clearRun = () => remove('run');

// ----- settings -----
const DEFAULT_SETTINGS = {
  muted: false,
  sfx: 0.8,
  music: 0.35,
  reduceMotion: false,
};

export function loadSettings() {
  const stored = get('settings', {});
  const out = Object.assign({}, DEFAULT_SETTINGS);
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof stored[key] === typeof DEFAULT_SETTINGS[key]) out[key] = stored[key];
    }
  }
  out.sfx = Math.max(0, Math.min(1, out.sfx));
  out.music = Math.max(0, Math.min(1, out.music));
  return out;
}
export const saveSettings = (s) => set('settings', s);

export function resetAll() {
  for (const key of ['run', 'settings']) remove(key);
}
