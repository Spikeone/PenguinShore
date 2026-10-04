// Run with:  node tests/game.test.mjs
import assert from 'assert';
import { readFileSync } from 'fs';
import * as cfg from '../js/config.js';
import { createGame, normalizeSave, visibleCounts, SAVE_VERSION, freshState } from '../js/game.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (err) { failures.push(name + '\n    ' + (err.stack || err.message)); }
}

// A deterministic rng: replays the given values, then cycles.
const seq = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const constRng = (v) => () => v;
// 0.99 never rolls a golden fish, so tap values are predictable.
const noLuck = constRng(0.99);

const newGame = (rng) => {
  const g = createGame({ rng: rng || noLuck });
  g.loadState(null);
  return g;
};
const give = (g, n) => { g.state.fish += n; };
// Lets a span of time pass the way the driver does: in small ticks. A single
// tick is clamped, so one big tick would not do.
const run = (g, ms) => {
  let events = [];
  for (let t = 0; t < ms; t += 250) events = events.concat(g.tick(Math.min(250, ms - t)));
  return events;
};
const types = (events) => events.map((e) => e.type);

// ---------------------------------------------------------------- config

test('item ids are unique and every reference resolves', () => {
  const ids = cfg.ITEMS.map((it) => it.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'unique ids');
  for (const it of cfg.ITEMS) {
    if (it.unlock.item) assert.ok(cfg.ITEM_BY_ID[it.unlock.item], it.id + ' unlock item exists');
    if (it.kind === 'penguin') assert.ok(cfg.SPECIES[it.species], it.id + ' species exists');
    if (it.anchor) {
      assert.ok(it.anchor.x >= 0 && it.anchor.x <= cfg.VIEW_W, it.id + ' anchor x inside');
      assert.ok(it.anchor.y >= 0 && it.anchor.y <= cfg.VIEW_H, it.id + ' anchor y inside');
    }
  }
  for (const b of cfg.BIOMES) {
    for (const sp of b.species) assert.ok(cfg.SPECIES[sp], b.id + ' species ' + sp);
  }
  for (const m of cfg.MILESTONES) {
    if (m.reward.cosmetic) assert.ok(cfg.COSMETIC_BY_ID[m.reward.cosmetic], m.id + ' cosmetic exists');
    if (m.cond.type === 'item') assert.ok(cfg.ITEM_BY_ID[m.cond.value], m.id + ' cond item exists');
  }
  const mids = cfg.MILESTONES.map((m) => m.id);
  assert.strictEqual(new Set(mids).size, mids.length, 'unique milestone ids');
  for (const s of cfg.SLOTS) {
    assert.ok(s.x > 0 && s.x < cfg.VIEW_W && s.y > 200 && s.y < cfg.VIEW_H, 'slot inside the floe');
  }
  assert.ok(cfg.SLOTS.length >= cfg.MAX_VISIBLE, 'enough slots for the visible cap: ' + cfg.SLOTS.length);
});

test('costs follow base * growth ^ level and climb strictly', () => {
  for (const it of cfg.ITEMS) {
    let prev = -1;
    for (let lv = 0; lv < 60; lv++) {
      const c = cfg.costOf(it, lv);
      assert.strictEqual(c, Math.round(it.base * Math.pow(it.growth, lv)));
      assert.ok(c > prev, it.id + ' climbs at ' + lv);
      prev = c;
    }
  }
  assert.strictEqual(cfg.costOf(cfg.ITEM_BY_ID.adelie, 0), 10);
  assert.strictEqual(cfg.costOfMany(cfg.ITEM_BY_ID.adelie, 0, 2), 10 + 11);
  assert.strictEqual(cfg.affordable(cfg.ITEM_BY_ID.adelie, 0, 20), 1);
  assert.strictEqual(cfg.affordable(cfg.ITEM_BY_ID.adelie, 0, 21), 2);
});

test('the pearl formula is zero at first, monotonic, and matches the design table', () => {
  assert.strictEqual(cfg.pearlsFor(0), 0);
  assert.strictEqual(cfg.pearlsFor(100000), 2);
  assert.strictEqual(cfg.pearlsFor(1000000), 7);
  assert.strictEqual(cfg.pearlsFor(10000000), 22);
  let prev = 0;
  for (let f = 0; f < 5e7; f += 123457) {
    const p = cfg.pearlsFor(f);
    assert.ok(p >= prev);
    prev = p;
  }
});

test('the day cycle has four phases in order', () => {
  assert.strictEqual(cfg.phaseAt(0.05), 'dawn');
  assert.strictEqual(cfg.phaseAt(0.3), 'day');
  assert.strictEqual(cfg.phaseAt(0.55), 'dusk');
  assert.strictEqual(cfg.phaseAt(0.8), 'night');
  assert.strictEqual(cfg.nightAmount(0.3), 0);
  assert.strictEqual(cfg.nightAmount(0.8), 1);
  assert.ok(cfg.nightAmount(0.55) > 0 && cfg.nightAmount(0.55) < 1);
});

test('the shown version matches the one the service worker caches under', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const cache = sw.match(/const CACHE = '([^']+)'/);
  assert.ok(cache, 'sw.js names a cache');
  assert.ok(/^[0-9]+$/.test(cfg.APP_VERSION), 'the version is a plain number');
  assert.strictEqual(cache[1], 'penguinshore-v' + cfg.APP_VERSION,
    'bump APP_VERSION in js/config.js and CACHE in sw.js together');
});

// ---------------------------------------------------------------- tapping

test('a tap catches one fish at the start and counts', () => {
  const g = newGame();
  const events = g.tap();
  assert.strictEqual(g.state.fish, 1);
  assert.strictEqual(g.state.taps, 1);
  assert.strictEqual(g.state.sessionTaps, 1);
  assert.ok(types(events).includes('fishGained'));
  assert.ok(types(events).includes('milestone'), 'first splash milestone');
});

test('a golden fish is worth ten taps', () => {
  const g = createGame({ rng: constRng(0.0) });
  g.loadState(null);
  g.tap();
  assert.strictEqual(g.state.fish, cfg.GOLDEN_MULT);
  assert.strictEqual(g.state.counters.golden, 1);
});

test('the combo builds on quick taps, multiplies at its tiers, and settles slowly', () => {
  const g = newGame();
  for (let i = 0; i < 10; i++) { g.tap(); g.tick(100); }
  assert.strictEqual(g.state.combo, 10);
  assert.strictEqual(cfg.comboMult(10), 1.5);
  const before = g.state.fish;
  g.tap();
  assert.ok(Math.abs(g.state.fish - before - 1.5) < 1e-9, 'tap worth x1.5 at combo 10');
  // past the window it settles by one per COMBO_DECAY_MS, never straight to zero
  run(g, cfg.COMBO_WINDOW_MS);
  const c = g.state.combo;
  run(g, cfg.COMBO_DECAY_MS);
  assert.strictEqual(g.state.combo, c - 1);
  run(g, cfg.COMBO_DECAY_MS * 3);
  assert.strictEqual(g.state.combo, c - 4);
  assert.ok(g.state.combo > 0);
});

test('ice holes and krill pantry raise the tap value', () => {
  const g = newGame();
  g.state.items.iceHole = 3;
  g.recompute();
  assert.strictEqual(g.fishPerTap(), 4);
  g.state.items.adelie = 100;      // 50 fish/s
  g.state.items.krillPantry = 5;   // tap +10% of production
  g.recompute();
  assert.ok(Math.abs(g.fishPerTap() - (4 + 5)) < 1e-9);
});

// ---------------------------------------------------------------- buying

test('buying needs the fish and the unlock', () => {
  const g = newGame();
  assert.deepStrictEqual(g.buy('adelie'), []);
  assert.strictEqual(g.state.items.adelie, 0);
  give(g, 10);
  const events = g.buy('adelie');
  assert.strictEqual(g.state.items.adelie, 1);
  assert.strictEqual(g.state.fish, 0);
  assert.ok(types(events).includes('bought'));
  assert.ok(g.fishPerSecond() > 0);
  // chinstrap needs five penguins
  give(g, 1e6);
  assert.deepStrictEqual(g.buy('chinstrap'), []);
  g.buy('adelie', 4);
  assert.ok(g.isUnlocked('chinstrap'));
  assert.ok(g.buy('chinstrap').length > 0);
});

test('x10 and max buy as many as fit and respect the cap', () => {
  const g = newGame();
  give(g, 1e9);
  g.buy('adelie', 10);
  assert.strictEqual(g.state.items.adelie, 10);
  g.state.lifetimeFish = 1e9;
  g.buy('iceHole', 'max');
  assert.strictEqual(g.state.items.iceHole, cfg.ITEM_BY_ID.iceHole.max);
  assert.deepStrictEqual(g.buy('iceHole'), [], 'nothing past the cap');
  const g2 = newGame();
  give(g2, 25);
  g2.buy('adelie', 10);
  assert.strictEqual(g2.state.items.adelie, 2, 'only two fit in 25 fish');
});

// ---------------------------------------------------------------- the clock

test('production credits exactly the elapsed time and never a catch-up', () => {
  const g = newGame();
  assert.deepStrictEqual(g.tick(1000), []);
  assert.strictEqual(g.state.fish, 0);
  g.state.items.adelie = 2;   // 1 fish/s
  g.recompute();
  g.tick(1000 / 4); g.tick(1000 / 4); g.tick(1000 / 4); g.tick(1000 / 4);
  assert.ok(Math.abs(g.state.fish - 1) < 1e-9);
  const before = g.state.fish;
  g.tick(60000);
  assert.ok(Math.abs(g.state.fish - before - cfg.MAX_TICK_MS / 1000) < 1e-9, 'a minute away pays a quarter second');
  assert.deepStrictEqual(g.tick(0), []);
  assert.deepStrictEqual(g.tick(-5), []);
});

test('multipliers and the biome bonus compound on production', () => {
  const g = newGame();
  g.state.items.adelie = 2;      // 1/s
  g.state.items.igloo = 2;       // +50%
  g.state.items.snowNest = 1;    // +10%
  g.state.pearlUpgrades.warmFeathers = 1; // +15%
  g.state.biome = 1;             // +25%
  g.recompute();
  const expected = 1 * (1 + 0.5 + 0.1) * 1.15 * 1.25;
  assert.ok(Math.abs(g.fishPerSecond() - expected) < 1e-9, g.fishPerSecond() + ' vs ' + expected);
});

test('species unlock once and the save remembers it', () => {
  const g = newGame();
  give(g, 1e6);
  const events = g.buy('adelie', 5);
  const unlocked = events.filter((e) => e.type === 'speciesUnlocked').map((e) => e.species);
  assert.deepStrictEqual(unlocked, ['chinstrap']);
  const again = g.buy('adelie', 1);
  assert.ok(!types(again).includes('speciesUnlocked'));
  const g2 = createGame({ rng: noLuck });
  const loaded = g2.loadState(g.snapshot());
  assert.ok(!types(loaded).includes('speciesUnlocked'), 'reload does not announce again');
});

test('milestones fire once with their rewards', () => {
  const g = newGame();
  give(g, 1e6);
  const events = g.buy('adelie', 5);
  const ms = events.filter((e) => e.type === 'milestone').map((e) => e.id);
  assert.ok(ms.includes('crowdOfFive'));
  assert.ok(g.state.fish > 1e6 - cfg.costOfMany(cfg.ITEM_BY_ID.adelie, 0, 5), 'burst credited');
  for (let i = 0; i < 10; i++) { g.tap(); g.tick(50); }
  assert.ok(g.state.seen.milestones.includes('rhythm'));
  assert.ok(g.state.unlockedCosmetics.includes('scarfRed'));
  assert.ok(Object.values(g.state.cosmetics).includes('scarfRed'), 'worn by someone');
});

// ---------------------------------------------------------------- events

test('events appear on their timers, one at a time, and resolve on a tap', () => {
  const g = createGame({ rng: constRng(0.5) });
  g.loadState(null);
  g.state.items.adelie = 2;
  g.recompute();
  let spawned = [];
  // the first swarm is scheduled early
  for (let t = 0; t < cfg.FIRST_EVENT_MS.swarm + 500 && !spawned.length; t += 250) {
    spawned = g.tick(250).filter((e) => e.type === 'eventSpawned');
  }
  assert.strictEqual(spawned.length, 1);
  assert.strictEqual(spawned[0].id, 'swarm');
  assert.ok(g.state.event && g.state.event.id === 'swarm');
  // nothing else lands on top of it
  for (let t = 0; t < 5000; t += 250) {
    assert.ok(!g.tick(250).some((e) => e.type === 'eventSpawned'));
  }
  const before = g.state.fish;
  const events = g.tapEvent();
  assert.ok(types(events).includes('eventResolved'));
  assert.ok(types(events).includes('boostStarted'));
  assert.ok(g.state.fish >= before + cfg.MIN_BURST);
  assert.strictEqual(g.state.event, null);
  assert.strictEqual(g.state.counters.swarm, 1);
  assert.ok(g.state.seen.milestones.includes('swarmCatcher'));
  assert.ok(g.boostMult() === 3);
  run(g, cfg.EVENT_BY_ID.swarm.boost.ms + 250);
  assert.strictEqual(g.boostMult(), 1, 'the boost ends');
});

test('a swarm nobody taps expires', () => {
  const g = createGame({ rng: constRng(0.5) });
  g.loadState(null);
  g.state.eventTimers.swarm = 100;
  g.tick(250);
  assert.ok(g.state.event);
  let expired = false;
  for (let t = 0; t < cfg.EVENT_BY_ID.swarm.windowMs + 500 && !expired; t += 250) {
    expired = g.tick(250).some((e) => e.type === 'eventExpired');
  }
  assert.ok(expired);
  assert.strictEqual(g.state.event, null);
});

test('shooting stars wait for night and eggs need a nest', () => {
  const g = createGame({ rng: constRng(0.5) });
  g.loadState(null);
  g.state.dayMs = cfg.DAY_CYCLE_MS * 0.3;   // day
  for (const def of cfg.EVENTS) g.state.eventTimers[def.id] = 1e9;
  g.state.eventTimers.star = 100;
  g.state.eventTimers.egg = 100;
  g.tick(250);
  assert.strictEqual(g.state.event, null, 'neither appears by day without a nest');
  g.state.dayMs = cfg.DAY_CYCLE_MS * 0.8;   // night
  g.tick(250);
  assert.ok(g.state.event && g.state.event.id === 'star');
  g.tapEvent();
  g.state.items.snowNest = 1;
  g.tick(250);
  assert.ok(g.state.event && g.state.event.id === 'egg');
  g.tapEvent();
  assert.ok(g.state.chickMs > 0);
  const adelies = g.state.items.adelie;
  for (let t = 0; t <= cfg.CHICK_MS; t += 250) g.tick(250);
  assert.strictEqual(g.state.items.adelie, adelies + 1, 'the chick grew up');
});

test('a gift unlocks a cosmetic and wears it', () => {
  const g = createGame({ rng: constRng(0.5) });
  g.loadState(null);
  g.state.items.adelie = 3;
  for (const def of cfg.EVENTS) g.state.eventTimers[def.id] = 1e9;
  g.state.eventTimers.gift = 100;
  g.tick(250);
  assert.ok(g.state.event && g.state.event.id === 'gift');
  const events = g.tapEvent();
  assert.ok(g.state.unlockedCosmetics.length === 1);
  assert.ok(types(events).includes('cosmetic'));
});

test('the welcome boost comes once per cooldown and only with a colony', () => {
  const g = newGame();
  assert.deepStrictEqual(g.welcome(1000), [], 'nothing to boost yet');
  g.state.items.adelie = 1;
  g.recompute();
  assert.ok(g.welcome(1000).length === 1);
  assert.deepStrictEqual(g.welcome(2000), []);
  assert.ok(g.welcome(1000 + cfg.WELCOME.cooldownMs).length === 1);
});

test('a night counted only when the whole night passes while open', () => {
  const g = newGame();
  g.state.dayMs = cfg.DAY_CYCLE_MS * 0.95;
  let phases = [];
  for (let t = 0; t < cfg.DAY_CYCLE_MS * 0.1; t += 250) {
    phases = phases.concat(g.tick(250).filter((e) => e.type === 'dayPhase').map((e) => e.phase));
  }
  assert.deepStrictEqual(phases, ['dawn']);
  assert.strictEqual(g.state.counters.nights, 1);
});

// ---------------------------------------------------------------- migration

test('migration keeps pearls and cosmetics, resets the colony, moves on', () => {
  const g = newGame();
  give(g, 1e6);
  g.buy('adelie', 10);
  g.state.unlockedCosmetics.push('crown');
  g.state.cosmetics['adelie#0'] = 'crown';
  assert.ok(!g.canMigrate());
  assert.deepStrictEqual(g.migrate(), []);
  g.state.lifetimeFish = 1000000;
  assert.ok(g.canMigrate());
  assert.strictEqual(g.pearlsOnMigrate(), 7);
  const total = g.state.totalFish;
  const events = g.migrate();
  assert.ok(types(events).includes('migrated'));
  assert.strictEqual(g.state.pearls, 7);
  assert.strictEqual(g.state.pearlsEarned, 7);
  assert.strictEqual(g.state.items.adelie, 0);
  assert.strictEqual(g.state.fish, 0);
  assert.strictEqual(g.state.lifetimeFish, 0);
  assert.strictEqual(g.state.totalFish, total);
  assert.strictEqual(g.state.biome, 1);
  assert.strictEqual(g.state.migrations, 1);
  assert.deepStrictEqual(g.state.unlockedCosmetics, ['crown']);
  assert.ok(g.state.seen.milestones.includes('wanderer'));
  assert.ok(g.state.seen.milestones.includes('crowdOfFive'), 'milestones are lifetime');
});

test('pearl upgrades cost pearls and head start applies to the next colony', () => {
  const g = newGame();
  assert.deepStrictEqual(g.buyPearl('deepDiver'), []);
  g.state.pearls = 10;
  g.buyPearl('deepDiver');
  assert.strictEqual(g.state.pearls, 9);
  assert.strictEqual(g.fishPerTap(), 2);
  g.buyPearl('headStart');
  assert.strictEqual(g.state.pearls, 6);
  g.state.lifetimeFish = cfg.MIGRATE_MIN_FISH;
  g.migrate();
  assert.strictEqual(g.state.items.adelie, cfg.HEAD_START_ADELIES);
  assert.strictEqual(g.state.fish, cfg.HEAD_START_FISH);
  assert.strictEqual(g.state.pearlUpgrades.deepDiver, 1);
  // pearl diver adds flat pearls
  g.state.pearls = 100;
  g.buyPearl('pearlDiver');
  g.state.lifetimeFish = cfg.MIGRATE_MIN_FISH;
  assert.strictEqual(g.pearlsOnMigrate(), 2 + 1);
});

// ---------------------------------------------------------------- saves

test('a snapshot round-trips and junk is cleaned up', () => {
  const g = newGame();
  give(g, 5000);
  g.buy('adelie', 10);
  g.tap();
  const snap = g.snapshot();
  const g2 = createGame({ rng: noLuck });
  g2.loadState(JSON.parse(JSON.stringify(snap)));
  const back = g2.snapshot();
  back.sessionTaps = snap.sessionTaps;
  back.sinceTapMs = snap.sinceTapMs;
  back.comboDecayAcc = snap.comboDecayAcc;
  assert.deepStrictEqual(back, snap);

  const dirty = normalizeSave({ fish: -5, items: { adelie: 2.7, bogus: 9, iceHole: 999 }, seen: { species: ['dragon'] }, pearls: 'x' });
  assert.strictEqual(dirty.fish, 0);
  assert.strictEqual(dirty.items.adelie, 2);
  assert.strictEqual(dirty.items.iceHole, cfg.ITEM_BY_ID.iceHole.max);
  assert.ok(!('bogus' in dirty.items));
  assert.deepStrictEqual(dirty.seen.species, ['adelie']);
  assert.strictEqual(dirty.pearls, 0);
  assert.strictEqual(normalizeSave(null).v, SAVE_VERSION);
  assert.strictEqual(normalizeSave('nonsense').v, SAVE_VERSION);
  const old = normalizeSave({ fish: 12, items: { adelie: 1 } });
  assert.strictEqual(old.v, SAVE_VERSION);
  assert.strictEqual(old.fish, 12);
});

test('visible counts cap each species and the whole floe', () => {
  const items = Object.assign({}, freshState().items, { adelie: 30, chinstrap: 3 });
  assert.deepStrictEqual(visibleCounts(items), { adelie: cfg.MAX_PER_SPECIES, chinstrap: 3 });
  const many = Object.assign({}, freshState().items);
  for (const it of cfg.ITEMS) if (it.kind === 'penguin') many[it.id] = 50;
  const v = visibleCounts(many);
  const total = Object.values(v).reduce((a, b) => a + b, 0);
  assert.ok(total <= cfg.MAX_VISIBLE, 'total ' + total);
  assert.ok(Object.values(v).every((n) => n >= 1));
});

console.log(passed + ' passed, ' + failures.length + ' failed');
for (const f of failures) console.log('  FAIL ' + f);
process.exit(failures.length ? 1 : 0);
