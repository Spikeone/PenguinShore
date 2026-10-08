// The whole game, with no DOM, no timers and no storage. The driver calls
// tick(elapsedMs) and the input methods; every one of them returns the list of
// events it produced, and the driver turns those into rendering and sound.
// That keeps everything here testable from node.

import {
  MAX_TICK_MS, DAY_CYCLE_MS, phaseAt, nightAmount,
  COMBO_WINDOW_MS, COMBO_DECAY_MS, COMBO_CAP, comboMult, comboTier,
  GOLDEN_BASE_CHANCE, GOLDEN_MULT, WELCOME,
  FATIGUE_TAPS, FATIGUE_FLOOR, fatigueMult,
  migrateTarget, pearlsFor, BIOME_BONUS, HEAD_START_ADELIES, headStartFish,
  ITEMS, ITEM_BY_ID, costOf, costOfMany, affordable,
  PEARL_UPGRADES, PEARL_BY_ID,
  EVENTS, EVENT_BY_ID, MIN_BURST, EVENT_RETRY_MS, CHICK_MS, FIRST_EVENT_MS,
  COSMETICS, MILESTONES,
  MAX_VISIBLE, MAX_PER_SPECIES, SPECIES_ORDER,
  MASTERY_MULT, masteryTier, LUCKY_CHANCE, LUCKY_WORTH,
} from './config.js';

export const SAVE_VERSION = 2;

const PENGUIN_ITEMS = ITEMS.filter((it) => it.kind === 'penguin');
const COUNTER_KEYS = ['swarm', 'seal', 'egg', 'star', 'gift', 'whale', 'golden', 'nights'];

export function freshState() {
  const items = {};
  for (const it of ITEMS) items[it.id] = 0;
  const lucky = {};
  for (const it of PENGUIN_ITEMS) lucky[it.id] = 0;
  const pearlUpgrades = {};
  for (const p of PEARL_UPGRADES) pearlUpgrades[p.id] = 0;
  const counters = {};
  for (const k of COUNTER_KEYS) counters[k] = 0;
  return {
    v: SAVE_VERSION,
    fish: 0,
    lifetimeFish: 0,       // this colony; drives the Pearl formula
    totalFish: 0,          // all colonies, statistics only
    taps: 0,
    sessionTaps: 0,
    recentTaps: 0,         // drains over an hour; drives tap fatigue
    items,
    lucky,                 // golden penguins per penguin item, this colony
    luckyFound: 0,         // golden penguins ever, all colonies
    seen: { species: ['adelie'], milestones: [], biomes: [0] },
    unlockedCosmetics: [],
    cosmetics: {},         // 'species#index' -> cosmetic id
    combo: 0,
    bestCombo: 0,
    sinceTapMs: COMBO_WINDOW_MS + 1,
    comboDecayAcc: 0,
    boosts: {},            // kind -> { mult, msLeft }
    event: null,           // { id, msLeft }
    eventTimers: {},       // id -> ms until it tries to appear
    chickMs: 0,
    counters,
    dayMs: DAY_CYCLE_MS * 0.15,   // a fresh colony starts in the morning
    pearls: 0,
    pearlsEarned: 0,
    pearlUpgrades,
    biome: 0,
    migrations: 0,
    lastWelcomeAt: 0,
    layoutSeed: 1,
    runStartedAt: 0,
    savedAt: 0,
  };
}

// ---------------------------------------------------------------- saves

const MIGRATIONS = {
  // 0 -> 1: the first saves had no version field at all.
  0: (raw) => Object.assign({}, raw, { v: 1 }),
  // 1 -> 2: mastery, golden penguins and tap fatigue. Nothing to convert, the
  // new fields simply default; the economy was retuned, owned items stay.
  1: (raw) => Object.assign({}, raw, { v: 2 }),
};

const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const int = (v, fallback) => Math.floor(num(v, fallback));

// Turns whatever came out of storage into a valid state. Unknown ids are
// dropped, numbers clamped, missing fields defaulted. `savedAt` is never used
// to credit time: nothing accrues while the app is closed.
export function normalizeSave(raw) {
  const fresh = freshState();
  if (!raw || typeof raw !== 'object') return fresh;
  let src = raw;
  let guard = 0;
  while ((src.v || 0) < SAVE_VERSION && guard++ < 10) {
    const step = MIGRATIONS[src.v || 0];
    if (!step) break;
    src = step(src);
  }
  const out = fresh;
  out.fish = num(src.fish, 0);
  out.lifetimeFish = num(src.lifetimeFish, 0);
  out.totalFish = num(src.totalFish, out.lifetimeFish);
  out.taps = int(src.taps, 0);
  out.sessionTaps = 0;
  out.recentTaps = num(src.recentTaps, 0);
  if (src.items && typeof src.items === 'object') {
    for (const id of Object.keys(out.items)) out.items[id] = int(src.items[id], 0);
    for (const id of Object.keys(out.items)) {
      const def = ITEM_BY_ID[id];
      if (def.max) out.items[id] = Math.min(out.items[id], def.max);
    }
  }
  if (src.lucky && typeof src.lucky === 'object') {
    for (const id of Object.keys(out.lucky)) out.lucky[id] = Math.min(out.items[id], int(src.lucky[id], 0));
  }
  out.luckyFound = int(src.luckyFound, 0);
  const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  if (src.seen && typeof src.seen === 'object') {
    out.seen.species = strList(src.seen.species).filter((s) => SPECIES_ORDER.includes(s));
    if (!out.seen.species.includes('adelie')) out.seen.species.unshift('adelie');
    out.seen.milestones = strList(src.seen.milestones).filter((m) => MILESTONES.some((d) => d.id === m));
    if (Array.isArray(src.seen.biomes)) {
      out.seen.biomes = src.seen.biomes.filter((b) => typeof b === 'number' && b >= 0).map((b) => Math.floor(b));
    }
  }
  out.unlockedCosmetics = strList(src.unlockedCosmetics).filter((c) => COSMETICS.some((d) => d.id === c));
  if (src.cosmetics && typeof src.cosmetics === 'object') {
    for (const key of Object.keys(src.cosmetics)) {
      const c = src.cosmetics[key];
      if (typeof c === 'string' && out.unlockedCosmetics.includes(c)) out.cosmetics[key] = c;
    }
  }
  out.combo = Math.min(COMBO_CAP, int(src.combo, 0));
  out.bestCombo = Math.min(COMBO_CAP, int(src.bestCombo, out.combo));
  out.sinceTapMs = COMBO_WINDOW_MS + 1;
  if (src.boosts && typeof src.boosts === 'object') {
    for (const kind of Object.keys(src.boosts)) {
      const b = src.boosts[kind];
      if (b && typeof b === 'object' && num(b.msLeft, 0) > 0 && num(b.mult, 0) >= 1) {
        out.boosts[kind] = { mult: b.mult, msLeft: b.msLeft };
      }
    }
  }
  if (src.event && typeof src.event === 'object' && EVENT_BY_ID[src.event.id]) {
    out.event = { id: src.event.id, msLeft: num(src.event.msLeft, 0) };
  }
  if (src.eventTimers && typeof src.eventTimers === 'object') {
    for (const id of Object.keys(src.eventTimers)) {
      if (EVENT_BY_ID[id]) out.eventTimers[id] = num(src.eventTimers[id], 0);
    }
  }
  out.chickMs = num(src.chickMs, 0);
  if (src.counters && typeof src.counters === 'object') {
    for (const k of COUNTER_KEYS) out.counters[k] = int(src.counters[k], 0);
  }
  out.dayMs = (typeof src.dayMs === 'number' && Number.isFinite(src.dayMs) ? Math.abs(src.dayMs) : fresh.dayMs) % DAY_CYCLE_MS;
  out.pearls = int(src.pearls, 0);
  out.pearlsEarned = int(src.pearlsEarned, out.pearls);
  if (src.pearlUpgrades && typeof src.pearlUpgrades === 'object') {
    for (const id of Object.keys(out.pearlUpgrades)) {
      out.pearlUpgrades[id] = Math.min(PEARL_BY_ID[id].costs.length, int(src.pearlUpgrades[id], 0));
    }
  }
  out.biome = int(src.biome, 0);
  out.migrations = int(src.migrations, 0);
  if (!out.seen.biomes.includes(out.biome)) out.seen.biomes.push(out.biome);
  out.lastWelcomeAt = num(src.lastWelcomeAt, 0);
  out.layoutSeed = int(src.layoutSeed, 1) || 1;
  out.runStartedAt = num(src.runStartedAt, 0);
  out.savedAt = num(src.savedAt, 0);
  return out;
}

// ---------------------------------------------------------------- helpers

export const colonySizeOf = (items) =>
  PENGUIN_ITEMS.reduce((sum, it) => sum + (items[it.id] || 0), 0);

// Mastery tiers reached across every species.
export const masteryTotal = (items) =>
  PENGUIN_ITEMS.reduce((sum, it) => sum + masteryTier(items[it.id] || 0), 0);

export function isUnlocked(def, state) {
  const u = def.unlock || {};
  if (u.penguins && colonySizeOf(state.items) < u.penguins) return false;
  if (u.lifetimeFish && state.lifetimeFish < u.lifetimeFish) return false;
  if (u.item && !(state.items[u.item] > 0)) return false;
  if (u.biome && state.biome < u.biome) return false;
  return true;
}

// How many of each species the scene shows. Each species shows at most
// MAX_PER_SPECIES, and the whole floe at most MAX_VISIBLE; beyond that the
// counts shrink proportionally (never below one of an owned species).
export function visibleCounts(items) {
  const counts = {};
  let total = 0;
  for (const it of PENGUIN_ITEMS) {
    const n = Math.min(MAX_PER_SPECIES, items[it.id] || 0);
    if (n > 0) counts[it.species] = n;
    total += n;
  }
  if (total > MAX_VISIBLE) {
    const scale = MAX_VISIBLE / total;
    for (const sp of Object.keys(counts)) counts[sp] = Math.max(1, Math.floor(counts[sp] * scale));
  }
  return counts;
}

function pick(rng, list) {
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// ---------------------------------------------------------------- the game

export function createGame(options) {
  const rng = (options && options.rng) || Math.random;
  let state = freshState();
  const derived = {
    baseFps: 0, tapBase: 1, tapMult: 1, goldenChance: GOLDEN_BASE_CHANCE, comboDecayMs: COMBO_DECAY_MS,
    nightMult: 0, burstMult: 0, fatigueFloor: FATIGUE_FLOOR, luckyChance: LUCKY_CHANCE, starsAnytime: false,
  };

  // ---- derived numbers, recomputed after anything that changes them
  function recompute() {
    let rate = 0;
    let mult = 1;
    let tapBase = 1;
    let tapMult = 1;
    let golden = GOLDEN_BASE_CHANCE;
    let decay = COMBO_DECAY_MS;
    let night = 0;
    let burst = 0;
    let masteryBonus = 0;
    let perPenguin = 0;
    let stars = false;
    const colony = colonySizeOf(state.items);
    const tiers = masteryTotal(state.items);
    for (const it of ITEMS) {
      const lv = state.items[it.id] || 0;
      if (!lv) continue;
      if (it.kind === 'penguin') {
        // a golden penguin counts for several, and mastery doubles the species
        const heads = lv + (state.lucky[it.id] || 0) * (LUCKY_WORTH - 1);
        rate += it.rate * heads * Math.pow(MASTERY_MULT, masteryTier(lv));
        continue;
      }
      if (it.prodMult) mult += it.prodMult * lv;
      if (it.tapAdd) tapBase += it.tapAdd * lv;
      if (it.tapMult) tapMult += it.tapMult * lv;
      if (it.golden) golden += it.golden * lv;
      if (it.comboSlow) decay *= 1 + it.comboSlow * lv;
      if (it.nightMult) night += it.nightMult * lv;
      if (it.burstMult) burst += it.burstMult * lv;
      if (it.masteryBonus) masteryBonus += it.masteryBonus * lv;
      if (it.perPenguin) perPenguin += it.perPenguin * lv;
      if (it.starsAnytime) stars = true;
    }
    mult += masteryBonus * tiers;
    mult += perPenguin * colony;
    const pu = state.pearlUpgrades;
    mult *= 1 + PEARL_BY_ID.warmFeathers.prodMult * (pu.warmFeathers || 0);
    mult *= 1 + BIOME_BONUS * state.biome;
    if (pu.elder) mult *= 1 + 0.01 * state.pearlsEarned;
    tapMult += PEARL_BY_ID.deepDiver.tapMult * (pu.deepDiver || 0);
    golden += PEARL_BY_ID.goldenCurrent.golden * (pu.goldenCurrent || 0);
    night += PEARL_BY_ID.nightMarket.nightMult * (pu.nightMarket || 0);
    derived.baseFps = rate * mult;
    derived.tapBase = tapBase;
    derived.tapMult = tapMult;
    derived.goldenChance = Math.min(0.5, golden);
    derived.comboDecayMs = decay;
    derived.nightMult = night;
    derived.burstMult = burst;
    derived.fatigueFloor = Math.min(1, FATIGUE_FLOOR + PEARL_BY_ID.steadyFlippers.fatigueFloor * (pu.steadyFlippers || 0));
    derived.luckyChance = LUCKY_CHANCE * (1 + PEARL_BY_ID.luckyCharm.luckyMult * (pu.luckyCharm || 0));
    derived.starsAnytime = stars;
  }

  const boostMult = () => {
    let m = 1;
    for (const kind of Object.keys(state.boosts)) m *= state.boosts[kind].mult;
    return m;
  };

  function fishPerSecond() {
    let fps = derived.baseFps * boostMult();
    if (state.pearlUpgrades.swiftWaddle && state.combo >= 20) {
      fps *= 1 + PEARL_BY_ID.swiftWaddle.comboProd;
    }
    if (derived.nightMult) fps *= 1 + derived.nightMult * nightAmount(state.dayMs / DAY_CYCLE_MS);
    return fps;
  }

  const tapFatigue = () => fatigueMult(state.recentTaps, derived.fatigueFloor);

  function fishPerTap() {
    let krill = 0;
    const lv = state.items.krillPantry || 0;
    if (lv) krill = ITEM_BY_ID.krillPantry.krill * lv * derived.baseFps;
    return (derived.tapBase + krill) * derived.tapMult * comboMult(state.combo) * boostMult() * tapFatigue();
  }

  const colonySize = () => colonySizeOf(state.items);

  function gain(amount) {
    state.fish += amount;
    state.lifetimeFish += amount;
    state.totalFish += amount;
  }

  const burstFor = (secs) => Math.max(MIN_BURST, secs * fishPerSecond()) * (1 + derived.burstMult);

  // ---- events (the things that appear on the floe)
  function eventFrequency() {
    let f = 1;
    f *= 1 + PEARL_BY_ID.luckyShoal.eventFreq * (state.pearlUpgrades.luckyShoal || 0);
    return f;
  }

  function rollTimer(def) {
    let ms = def.minMs + rng() * (def.maxMs - def.minMs);
    let freq = eventFrequency();
    if (def.id === 'swarm') freq *= 1 + ITEM_BY_ID.lighthouse.swarmFreq * (state.items.lighthouse || 0);
    return ms / freq;
  }

  function ensureTimers() {
    for (const def of EVENTS) {
      if (typeof state.eventTimers[def.id] !== 'number') {
        state.eventTimers[def.id] = FIRST_EVENT_MS[def.id] || rollTimer(def);
      }
    }
  }

  function spawnEvent(def, events) {
    let windowMs = def.windowMs;
    if (def.id === 'swarm') windowMs += ITEM_BY_ID.lighthouse.swarmWindowMs * (state.items.lighthouse || 0);
    state.event = { id: def.id, msLeft: windowMs };
    events.push({ type: 'eventSpawned', id: def.id, slot: def.slot, msLeft: windowMs });
  }

  function unlockCosmetic(id, events, source) {
    if (!state.unlockedCosmetics.includes(id)) state.unlockedCosmetics.push(id);
    // Put it on a random visible penguin so it shows up straight away.
    const counts = visibleCounts(state.items);
    const keys = [];
    for (const sp of Object.keys(counts)) for (let i = 0; i < counts[sp]; i++) keys.push(sp + '#' + i);
    const key = pick(rng, keys);
    if (key) state.cosmetics[key] = id;
    events.push({ type: 'cosmetic', id, key, source });
  }

  // ---- unlocks and milestones
  function conditionMet(cond) {
    switch (cond.type) {
      case 'taps': return state.taps >= cond.value;
      case 'sessionTaps': return state.sessionTaps >= cond.value;
      case 'penguins': return colonySize() >= cond.value;
      case 'lifetimeFish': return state.lifetimeFish >= cond.value;
      case 'totalFish': return state.totalFish >= cond.value;
      case 'combo': return state.bestCombo >= cond.value;
      case 'item': return (state.items[cond.value] || 0) >= 1;
      case 'counter': return (state.counters[cond.value.key] || 0) >= cond.value.n;
      case 'migrations': return state.migrations >= cond.value;
      case 'lucky': return state.luckyFound >= cond.value;
      case 'mastery': return masteryTotal(state.items) >= cond.value;
      case 'species': return PENGUIN_ITEMS.filter((it) => state.items[it.id] > 0).length >= cond.value;
      default: return false;
    }
  }

  function checkUnlocks(events) {
    for (const it of PENGUIN_ITEMS) {
      if (state.seen.species.includes(it.species)) continue;
      if (!isUnlocked(it, state)) continue;
      state.seen.species.push(it.species);
      events.push({ type: 'speciesUnlocked', species: it.species, id: it.id });
    }
    for (const m of MILESTONES) {
      if (state.seen.milestones.includes(m.id)) continue;
      if (!conditionMet(m.cond)) continue;
      state.seen.milestones.push(m.id);
      const ev = { type: 'milestone', id: m.id, reward: m.reward };
      if (m.reward.burstSecs) {
        ev.fish = burstFor(m.reward.burstSecs);
        gain(ev.fish);
      }
      if (m.reward.pearls) {
        state.pearls += m.reward.pearls;
        state.pearlsEarned += m.reward.pearls;
      }
      if (m.reward.cosmetic) unlockCosmetic(m.reward.cosmetic, events, 'milestone');
      if (m.reward.eggNow && !state.event) spawnEvent(EVENT_BY_ID.egg, events);
      events.push(ev);
    }
  }

  // ---- the clock
  function tick(elapsedMs) {
    const events = [];
    if (!(elapsedMs > 0)) return events;
    const dt = Math.min(MAX_TICK_MS, elapsedMs);

    // combo settles once the window has passed; it is never dropped to zero
    state.sinceTapMs += dt;
    if (state.sinceTapMs > COMBO_WINDOW_MS && state.combo > 0) {
      state.comboDecayAcc += dt;
      while (state.comboDecayAcc >= derived.comboDecayMs && state.combo > 0) {
        state.comboDecayAcc -= derived.comboDecayMs;
        state.combo -= 1;
      }
      if (state.combo === 0) state.comboDecayAcc = 0;
    }
    // tired flippers recover over the hour
    if (state.recentTaps > 0) state.recentTaps = Math.max(0, state.recentTaps - FATIGUE_TAPS * dt / 3600000);

    // production
    const fps = fishPerSecond();
    if (fps > 0) gain(fps * dt / 1000);

    // boosts
    for (const kind of Object.keys(state.boosts)) {
      state.boosts[kind].msLeft -= dt;
      if (state.boosts[kind].msLeft <= 0) {
        delete state.boosts[kind];
        events.push({ type: 'boostEnded', kind });
      }
    }

    // the event on the floe
    if (state.event) {
      const def = EVENT_BY_ID[state.event.id];
      if (def.windowMs > 0) {
        state.event.msLeft -= dt;
        if (state.event.msLeft <= 0) {
          events.push({ type: 'eventExpired', id: state.event.id });
          state.event = null;
        }
      }
    }

    // the timers for the next ones
    ensureTimers();
    const phase = phaseAt(state.dayMs / DAY_CYCLE_MS);
    for (const def of EVENTS) {
      if (def.needsItem && !(state.items[def.needsItem] > 0)) continue;
      state.eventTimers[def.id] -= dt;
      if (state.eventTimers[def.id] > 0) continue;
      if (def.nightOnly && phase !== 'night' && !derived.starsAnytime) { state.eventTimers[def.id] = 0; continue; }
      if (state.event) { state.eventTimers[def.id] = EVENT_RETRY_MS; continue; }
      spawnEvent(def, events);
      state.eventTimers[def.id] = rollTimer(def);
    }

    // a hatched chick grows into a penguin
    if (state.chickMs > 0) {
      state.chickMs -= dt;
      if (state.chickMs <= 0) {
        state.chickMs = 0;
        state.items.adelie += 1;
        recompute();
        events.push({ type: 'chickGrown' });
      }
    }

    // the sky
    const before = phaseAt(state.dayMs / DAY_CYCLE_MS);
    state.dayMs = (state.dayMs + dt) % DAY_CYCLE_MS;
    const after = phaseAt(state.dayMs / DAY_CYCLE_MS);
    if (before !== after) {
      if (before === 'night' && after === 'dawn') state.counters.nights += 1;
      events.push({ type: 'dayPhase', phase: after });
    }

    checkUnlocks(events);
    return events;
  }

  // ---- input
  function tap() {
    const events = [];
    const tierBefore = comboTier(state.combo);
    if (state.sinceTapMs <= COMBO_WINDOW_MS) {
      state.combo = Math.min(COMBO_CAP, state.combo + 1);
    } else if (state.combo === 0) {
      state.combo = 1;
    }
    state.sinceTapMs = 0;
    state.comboDecayAcc = 0;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const tierAfter = comboTier(state.combo);
    if (tierAfter && tierAfter !== tierBefore) {
      events.push({ type: 'comboTier', tier: tierAfter });
    }

    const golden = rng() < derived.goldenChance;
    const amount = fishPerTap() * (golden ? GOLDEN_MULT : 1);
    gain(amount);
    state.taps += 1;
    state.sessionTaps += 1;
    state.recentTaps += 1;
    if (golden) state.counters.golden += 1;
    events.push({ type: 'fishGained', amount, source: 'tap', golden });
    checkUnlocks(events);
    return events;
  }

  function tapEvent() {
    const events = [];
    if (!state.event) return events;
    const def = EVENT_BY_ID[state.event.id];
    const ev = { type: 'eventResolved', id: def.id };
    if (def.burstSecs) {
      ev.fish = burstFor(def.burstSecs);
      gain(ev.fish);
    }
    if (def.boost) {
      state.boosts[def.id] = { mult: def.boost.mult, msLeft: def.boost.ms };
      events.push({ type: 'boostStarted', kind: def.id, mult: def.boost.mult, msLeft: def.boost.ms });
    }
    if (def.chick) state.chickMs = CHICK_MS;
    if (def.cosmetic) {
      const locked = COSMETICS.filter((c) => !state.unlockedCosmetics.includes(c.id));
      const choice = pick(rng, locked.length ? locked : COSMETICS);
      ev.cosmetic = choice.id;
      unlockCosmetic(choice.id, events, 'gift');
    }
    state.counters[def.id] = (state.counters[def.id] || 0) + 1;
    state.event = null;
    events.push(ev);
    checkUnlocks(events);
    return events;
  }

  // A tap on a penguin cycles the accessory it wears (purely visual).
  function tapPenguin(key) {
    const options = [null].concat(state.unlockedCosmetics);
    if (options.length < 2) return [];
    const current = state.cosmetics[key] || null;
    const index = options.indexOf(current);
    const next = options[(index + 1) % options.length];
    if (next) state.cosmetics[key] = next;
    else delete state.cosmetics[key];
    return [{ type: 'cosmeticChanged', key, id: next }];
  }

  function quantityFor(def, qty) {
    const level = state.items[def.id] || 0;
    const room = def.max ? Math.max(0, def.max - level) : Infinity;
    const can = affordable(def, level, state.fish);
    const wanted = qty === 'max' ? can : Math.min(qty || 1, can);
    return Math.min(wanted, room);
  }

  const canBuy = (id, qty) => {
    const def = ITEM_BY_ID[id];
    return !!def && isUnlocked(def, state) && quantityFor(def, qty) > 0;
  };

  function buy(id, qty) {
    const events = [];
    const def = ITEM_BY_ID[id];
    if (!def || !isUnlocked(def, state)) return events;
    const n = quantityFor(def, qty);
    if (n <= 0) return events;
    const level = state.items[id] || 0;
    const cost = costOfMany(def, level, n);
    state.fish -= cost;
    state.items[id] = level + n;
    const ev = { type: 'bought', id, level: state.items[id], count: n, cost };
    if (def.kind === 'penguin') {
      // every new penguin has a small chance to be a golden one
      let lucky = 0;
      for (let i = 0; i < n; i++) if (rng() < derived.luckyChance) lucky++;
      if (lucky) {
        state.lucky[id] = (state.lucky[id] || 0) + lucky;
        state.luckyFound += lucky;
        ev.lucky = lucky;
        events.push({ type: 'lucky', id, species: def.species, count: lucky });
      }
      const tierBefore = masteryTier(level);
      const tierAfter = masteryTier(state.items[id]);
      if (tierAfter > tierBefore) events.push({ type: 'masteryUp', id, species: def.species, tier: tierAfter });
    }
    recompute();
    events.push(ev);
    checkUnlocks(events);
    return events;
  }

  const canBuyPearl = (id) => {
    const def = PEARL_BY_ID[id];
    if (!def) return false;
    const lv = state.pearlUpgrades[id] || 0;
    return lv < def.costs.length && state.pearls >= def.costs[lv];
  };

  function buyPearl(id) {
    const events = [];
    if (!canBuyPearl(id)) return events;
    const def = PEARL_BY_ID[id];
    const lv = state.pearlUpgrades[id] || 0;
    state.pearls -= def.costs[lv];
    state.pearlUpgrades[id] = lv + 1;
    recompute();
    events.push({ type: 'pearlBought', id, level: lv + 1 });
    return events;
  }

  // ---- migration
  const migrateGoal = () => migrateTarget(state.migrations);
  const canMigrate = () => state.lifetimeFish >= migrateGoal();
  function pearlsOnMigrate() {
    const base = pearlsFor(state.lifetimeFish, state.migrations);
    if (base < 1) return 0;
    return base + PEARL_BY_ID.pearlDiver.extraPearls * (state.pearlUpgrades.pearlDiver || 0);
  }

  function migrate() {
    const events = [];
    if (!canMigrate()) return events;
    const gained = pearlsOnMigrate();
    const fresh = freshState();
    const keep = {
      totalFish: state.totalFish,
      taps: state.taps,
      sessionTaps: state.sessionTaps,
      recentTaps: state.recentTaps,
      luckyFound: state.luckyFound,
      pearls: state.pearls + gained,
      pearlsEarned: state.pearlsEarned + gained,
      pearlUpgrades: state.pearlUpgrades,
      unlockedCosmetics: state.unlockedCosmetics,
      cosmetics: state.cosmetics,
      counters: state.counters,
      biome: state.biome + 1,
      migrations: state.migrations + 1,
      lastWelcomeAt: state.lastWelcomeAt,
      dayMs: state.dayMs,
      bestCombo: state.bestCombo,
      layoutSeed: (state.layoutSeed * 48271) % 2147483647 || 7,
      runStartedAt: state.runStartedAt,
    };
    keep.seen = { species: ['adelie'], milestones: state.seen.milestones.slice(), biomes: state.seen.biomes.slice() };
    if (!keep.seen.biomes.includes(keep.biome)) keep.seen.biomes.push(keep.biome);
    state = Object.assign(fresh, keep);
    const hs = state.pearlUpgrades.headStart || 0;
    if (hs) {
      state.items.adelie = HEAD_START_ADELIES * hs;
      state.fish = headStartFish(hs);
    }
    recompute();
    events.push({ type: 'migrated', pearls: gained, biome: state.biome });
    checkUnlocks(events);
    return events;
  }

  // ---- coming back to the app
  function welcome(nowMs) {
    const events = [];
    if (derived.baseFps <= 0) return events;
    if (state.lastWelcomeAt && nowMs - state.lastWelcomeAt < WELCOME.cooldownMs) return events;
    state.lastWelcomeAt = nowMs;
    state.boosts.welcome = { mult: WELCOME.mult, msLeft: WELCOME.ms };
    events.push({ type: 'boostStarted', kind: 'welcome', mult: WELCOME.mult, msLeft: WELCOME.ms });
    return events;
  }

  // ---- saving
  const snapshot = () => JSON.parse(JSON.stringify(state));

  function loadState(raw) {
    state = normalizeSave(raw);
    if (!state.runStartedAt) state.runStartedAt = Date.now();
    recompute();
    const events = [{ type: 'loaded' }];
    checkUnlocks(events);
    return events;
  }

  recompute();
  return {
    get state() { return state; },
    derived,
    tick, tap, tapEvent, tapPenguin,
    buy, canBuy, buyPearl, canBuyPearl,
    costOf: (id) => costOf(ITEM_BY_ID[id], state.items[id] || 0),
    quantityFor: (id, qty) => quantityFor(ITEM_BY_ID[id], qty),
    isUnlocked: (id) => isUnlocked(ITEM_BY_ID[id], state),
    fishPerSecond, fishPerTap, colonySize, boostMult, tapFatigue,
    masteryTotal: () => masteryTotal(state.items),
    canMigrate, migrateGoal, pearlsOnMigrate, migrate, welcome,
    snapshot, loadState,
    recompute,
  };
}
