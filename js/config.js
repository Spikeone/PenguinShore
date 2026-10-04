// Every tunable number and every UI string. Nothing in here touches the DOM, so
// the tests can import it from node.

// Bump together with CACHE in sw.js before every deploy (a test checks they match).
export const APP_VERSION = '1';
export const TITLE = 'Penguin Shore';

// ---------------------------------------------------------------- clock
// The economy ticks at 10 Hz. A single tick never credits more than this, so
// time away from the app (hidden tab, closed app, clock jumps) is never paid out.
export const TICK_MS = 100;
export const MAX_TICK_MS = 250;

// Cosmetic day/night cycle: dawn 1 min, day 4, dusk 1, night 4.
export const DAY_CYCLE_MS = 10 * 60 * 1000;
export const PHASES = [
  { id: 'dawn', until: 0.1 },
  { id: 'day', until: 0.5 },
  { id: 'dusk', until: 0.6 },
  { id: 'night', until: 1.0 },
];
export function phaseAt(fraction) {
  const f = ((fraction % 1) + 1) % 1;
  for (const p of PHASES) if (f < p.until) return p.id;
  return 'night';
}
// How "night" the sky is, 0 (full day) to 1 (full night), for palette blending.
export function nightAmount(fraction) {
  const f = ((fraction % 1) + 1) % 1;
  if (f < 0.1) return 1 - f / 0.1;             // dawn: night fades out
  if (f < 0.5) return 0;                       // day
  if (f < 0.6) return (f - 0.5) / 0.1;         // dusk: night fades in
  return 1;                                    // night
}

// ---------------------------------------------------------------- tapping
export const COMBO_WINDOW_MS = 1200;   // taps this close together build the combo
export const COMBO_DECAY_MS = 500;     // after the window, the combo settles by 1 per this
export const COMBO_CAP = 50;
export const COMBO_TIERS = [
  { at: 10, mult: 1.5, name: 'Nice rhythm' },
  { at: 25, mult: 2, name: 'Flow' },
  { at: 50, mult: 3, name: 'Frenzy' },
];
export function comboMult(combo) {
  let mult = 1;
  for (const tier of COMBO_TIERS) if (combo >= tier.at) mult = tier.mult;
  return mult;
}
export function comboTier(combo) {
  let tier = null;
  for (const t of COMBO_TIERS) if (combo >= t.at) tier = t;
  return tier;
}
export const GOLDEN_BASE_CHANCE = 0.02;
export const GOLDEN_MULT = 10;

// Coming back to the app (not being away) is rewarded: a short boost, at most
// once per cooldown. This is the honest replacement for offline earnings.
export const WELCOME = { mult: 2, ms: 60 * 1000, cooldownMs: 10 * 60 * 1000 };

// ---------------------------------------------------------------- migration
export const PEARL_DIVISOR = 20000;
export const MIGRATE_MIN_FISH = 100000;
export const pearlsFor = (lifetimeFish) =>
  Math.floor(Math.sqrt(Math.max(0, lifetimeFish) / PEARL_DIVISOR));
export const BIOME_BONUS = 0.25;       // flat production bonus per biome index
export const HEAD_START_FISH = 100;
export const HEAD_START_ADELIES = 3;

// ---------------------------------------------------------------- species
// Drawn in code by penguin.js from these parameters. `size` scales the whole
// bird; `crest` picks an optional head decoration.
export const SPECIES = {
  adelie: { name: 'Adelie', body: '#2b3140', belly: '#ffffff', beak: '#2b3140', feet: '#f2a3a3', eyeRing: '#ffffff', size: 0.9 },
  chinstrap: { name: 'Chinstrap', body: '#262b36', belly: '#ffffff', beak: '#3a3f4a', feet: '#f2a3a3', chinstrap: true, size: 0.92 },
  gentoo: { name: 'Gentoo', body: '#2f3542', belly: '#ffffff', beak: '#f27a3d', feet: '#f7a44a', cap: '#ffffff', size: 1.0 },
  rockhopper: { name: 'Rockhopper', body: '#2a2f3a', belly: '#ffffff', beak: '#e0742f', feet: '#f2a3a3', crest: 'rockhopper', eye: '#c0392b', size: 0.88 },
  macaroni: { name: 'Macaroni', body: '#262a33', belly: '#ffffff', beak: '#d8632a', feet: '#f2a3a3', crest: 'macaroni', size: 0.96 },
  emperor: { name: 'Emperor', body: '#2b3140', belly: '#fff8e8', beak: '#3a3f4a', beakStripe: '#f59e42', feet: '#3a3f4a', earPatch: '#f2c94c', size: 1.15 },
  littleBlue: { name: 'Little blue', body: '#5b7fb5', belly: '#ffffff', beak: '#4a4f5a', feet: '#8a94a6', size: 0.7 },
  chick: { name: 'Chick', body: '#9aa3ad', belly: '#d9dde3', beak: '#4a4f5a', feet: '#6b7280', face: '#ffffff', size: 0.6 },
};
export const SPECIES_ORDER = ['adelie', 'chinstrap', 'gentoo', 'rockhopper', 'macaroni', 'emperor', 'littleBlue'];

// ---------------------------------------------------------------- the shop
// cost = round(base * growth ^ level). Penguins climb gently so "one more
// penguin" is always a few seconds away; multiplier buildings climb steeply and
// are capped because their power compounds.
//
// unlock: all listed conditions must hold.
//   penguins     colony size (penguins owned, all species)
//   lifetimeFish fish ever caught in this run
//   item         at least one of that item
//   biome        current biome index at least this
//
// anchor: where a building stands in the scene (viewBox 360x400).
export const ITEMS = [
  { id: 'adelie', kind: 'penguin', species: 'adelie', name: 'Adelie penguin',
    flavour: 'Small, speedy, always hungry.', rate: 0.5, base: 10, growth: 1.10, unlock: {} },
  { id: 'iceHole', kind: 'building', name: 'Ice hole',
    flavour: 'A hole in the ice. Fish included.', tapAdd: 1, base: 30, growth: 1.15, max: 50,
    unlock: { lifetimeFish: 20 }, anchor: { x: 62, y: 312 } },
  { id: 'chinstrap', kind: 'penguin', species: 'chinstrap', name: 'Chinstrap penguin',
    flavour: 'Wears a helmet strap, never a helmet.', rate: 3, base: 100, growth: 1.10, unlock: { penguins: 5 } },
  { id: 'snowNest', kind: 'building', name: 'Snow nest',
    flavour: 'Cozy pebbles. Eggs optional.', prodMult: 0.10, base: 250, growth: 1.25, max: 10,
    unlock: { item: 'chinstrap' }, anchor: { x: 292, y: 262 } },
  { id: 'gentoo', kind: 'penguin', species: 'gentoo', name: 'Gentoo penguin',
    flavour: 'Fastest swimmer on the shore.', rate: 12, base: 600, growth: 1.10, unlock: { penguins: 15 } },
  { id: 'krillPantry', kind: 'building', name: 'Krill pantry',
    flavour: 'Keeps fish fresh and tappers happy.', krill: 0.02, base: 1500, growth: 1.20, max: 25,
    unlock: { item: 'gentoo' }, anchor: { x: 46, y: 262 } },
  { id: 'rockhopper', kind: 'penguin', species: 'rockhopper', name: 'Rockhopper penguin',
    flavour: 'Yellow crest, zero chill.', rate: 50, base: 4000, growth: 1.10, unlock: { penguins: 30 } },
  { id: 'igloo', kind: 'building', name: 'Igloo',
    flavour: 'Everyone fits. Somehow.', prodMult: 0.25, base: 12000, growth: 1.30, max: 10,
    unlock: { item: 'rockhopper' }, anchor: { x: 120, y: 248 } },
  { id: 'macaroni', kind: 'penguin', species: 'macaroni', name: 'Macaroni penguin',
    flavour: 'Fancy eyebrows, fancier appetite.', rate: 200, base: 30000, growth: 1.10, unlock: { penguins: 50 } },
  { id: 'lighthouse', kind: 'building', name: 'Lighthouse',
    flavour: 'Guides shoals home.', swarmFreq: 0.25, swarmWindowMs: 2000, base: 100000, growth: 1.35, max: 5,
    unlock: { item: 'macaroni' }, anchor: { x: 326, y: 214 } },
  { id: 'emperor', kind: 'penguin', species: 'emperor', name: 'Emperor penguin',
    flavour: 'Tall, calm, slightly majestic.', rate: 1000, base: 250000, growth: 1.10, unlock: { penguins: 80 } },
  { id: 'hotSpring', kind: 'building', name: 'Hot spring',
    flavour: 'Steam, bubbles, bliss.', comboSlow: 0.2, golden: 0.01, base: 600000, growth: 1.30, max: 10,
    unlock: { item: 'emperor' }, anchor: { x: 236, y: 300 } },
  { id: 'littleBlue', kind: 'penguin', species: 'littleBlue', name: 'Little blue penguin',
    flavour: 'The tiniest penguin. Immense charm.', rate: 5000, base: 2000000, growth: 1.10,
    unlock: { penguins: 120, biome: 1 } },
  { id: 'observatory', kind: 'building', name: 'Observatory',
    flavour: 'For watching the sky. And fish.', prodMult: 0.5, base: 5000000, growth: 1.5, max: 5,
    unlock: { biome: 2 }, anchor: { x: 200, y: 226 } },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

export const costOf = (def, level) => Math.round(def.base * Math.pow(def.growth, level));
export function costOfMany(def, level, qty) {
  let sum = 0;
  for (let i = 0; i < qty; i++) sum += costOf(def, level + i);
  return sum;
}
// How many can be afforded from `level` with `fish` (bounded by max).
export function affordable(def, level, fish) {
  let n = 0;
  let left = fish;
  const limit = def.max ? def.max - level : 1000;
  while (n < limit) {
    const c = costOf(def, level + n);
    if (c > left) break;
    left -= c;
    n++;
  }
  return n;
}
export const BUY_QUANTITIES = [1, 10, 'max'];

// ---------------------------------------------------------------- pearls
export const PEARL_UPGRADES = [
  { id: 'warmFeathers', name: 'Warm feathers', desc: '+15% fish per second per level', costs: [2, 3, 5, 8, 12], prodMult: 0.15 },
  { id: 'deepDiver', name: 'Deep diver', desc: '+1 fish per tap per level', costs: [1, 2, 4, 7, 12], tapAdd: 1 },
  { id: 'headStart', name: 'Head start', desc: 'Each colony starts with 3 Adelies and 100 fish per level', costs: [3, 6, 12] },
  { id: 'luckyShoal', name: 'Lucky shoal', desc: 'Events come 20% more often per level', costs: [4, 8, 16], eventFreq: 0.2 },
  { id: 'goldenCurrent', name: 'Golden current', desc: '+2% golden fish chance per level', costs: [5, 10, 20], golden: 0.02 },
  { id: 'swiftWaddle', name: 'Swift waddle', desc: '+30% fish per second while the combo is 10 or more', costs: [6], comboProd: 0.3 },
  { id: 'elder', name: 'Elder penguin', desc: 'An elder Emperor joins every colony. +1% production per Pearl ever earned', costs: [10] },
  { id: 'pearlDiver', name: 'Pearl diver', desc: '+1 Pearl per migration per level', costs: [15, 30, 60], extraPearls: 1 },
];
export const PEARL_BY_ID = Object.fromEntries(PEARL_UPGRADES.map((p) => [p.id, p]));

// ---------------------------------------------------------------- biomes
// Each biome has a day and a night palette; dawn and dusk blend between them.
export const BIOMES = [
  { id: 'iceShelf', name: 'Ice shelf', tagline: 'Milk-white ice under a lavender sky.',
    day: { skyTop: '#bfe3f7', skyBottom: '#eaf6fc', water: '#6fb3dc', waterDeep: '#4f97c7', ice: '#ffffff', iceShade: '#dcebf5', far: '#c9dcea', sun: '#ffe08a' },
    night: { skyTop: '#1b2340', skyBottom: '#3a4a74', water: '#243a5e', waterDeep: '#18294a', ice: '#b9c4dc', iceShade: '#8f9dbd', far: '#2d3a5c', sun: '#f4f1d8' },
    weather: 'snow', species: ['adelie', 'chinstrap', 'gentoo', 'rockhopper', 'macaroni', 'emperor'] },
  { id: 'rockyCoast', name: 'Rocky coast', tagline: 'Warm stone, teal water, moss in the cracks.',
    day: { skyTop: '#f7d9b8', skyBottom: '#fbeedd', water: '#5fb8ad', waterDeep: '#3f9a90', ice: '#d9d2c7', iceShade: '#b7ada0', far: '#9f958a', sun: '#ffd27a' },
    night: { skyTop: '#2a2638', skyBottom: '#4a3f5e', water: '#234b4a', waterDeep: '#183635', ice: '#8e8a93', iceShade: '#6e6a74', far: '#3c3645', sun: '#f4f1d8' },
    weather: 'mist', species: ['adelie', 'chinstrap', 'gentoo', 'rockhopper', 'macaroni', 'emperor', 'littleBlue'] },
  { id: 'auroraNight', name: 'Aurora night', tagline: 'Mint and violet ribbons over pale pink ice.',
    day: { skyTop: '#2c3566', skyBottom: '#5d6aa6', water: '#3b5a8f', waterDeep: '#2b4572', ice: '#f3dde9', iceShade: '#d4b8cb', far: '#45508a', sun: '#f8f2c8' },
    night: { skyTop: '#0f1433', skyBottom: '#2a2f66', water: '#1a2a55', waterDeep: '#111c3d', ice: '#c8b5d4', iceShade: '#9c86ab', far: '#1c2452', sun: '#f8f2c8' },
    weather: 'aurora', species: ['adelie', 'chinstrap', 'gentoo', 'rockhopper', 'macaroni', 'emperor', 'littleBlue'] },
  { id: 'sunriseLagoon', name: 'Sunrise lagoon', tagline: 'Golden pink dawn over turquoise shallows.',
    day: { skyTop: '#f9c6c0', skyBottom: '#fff0d6', water: '#5fd0cf', waterDeep: '#3bb3b4', ice: '#fbe9d2', iceShade: '#edd0b0', far: '#f0a68c', sun: '#ffd27a' },
    night: { skyTop: '#3a2a4a', skyBottom: '#6a4a6a', water: '#2a5a66', waterDeep: '#1b4149', ice: '#b8a0a8', iceShade: '#8d7680', far: '#5a3a52', sun: '#f4f1d8' },
    weather: 'petals', species: ['adelie', 'chinstrap', 'gentoo', 'rockhopper', 'macaroni', 'emperor', 'littleBlue'] },
];
export const biomeAt = (index) => BIOMES[((index % BIOMES.length) + BIOMES.length) % BIOMES.length];

// ---------------------------------------------------------------- events
// Each event keeps its own timer. Only one is on screen at a time; a timer
// that fires while another event is up waits a little and tries again.
//   burstSecs  grants that many seconds of current production (at least MIN_BURST)
//   boost      a temporary multiplier on everything
export const EVENTS = [
  { id: 'swarm', name: 'Fish swarm', minMs: 60000, maxMs: 120000, windowMs: 8000,
    burstSecs: 30, boost: { mult: 3, ms: 15000 }, slot: 'water' },
  { id: 'seal', name: 'Seal visit', minMs: 240000, maxMs: 420000, windowMs: 10000,
    burstSecs: 60, slot: 'waterRight' },
  { id: 'egg', name: 'Egg', minMs: 180000, maxMs: 300000, windowMs: 0, needsItem: 'snowNest',
    chick: true, slot: 'nest' },
  { id: 'star', name: 'Shooting star', minMs: 300000, maxMs: 480000, windowMs: 4000, nightOnly: true,
    boost: { mult: 2, ms: 60000 }, slot: 'sky' },
  { id: 'gift', name: 'Gift drift', minMs: 480000, maxMs: 720000, windowMs: 15000,
    cosmetic: true, slot: 'waterLeft' },
  { id: 'whale', name: 'Whale breach', minMs: 900000, maxMs: 1500000, windowMs: 6000,
    burstSecs: 300, slot: 'horizon' },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const MIN_BURST = 20;
export const EVENT_RETRY_MS = 15000;
export const CHICK_MS = 120000;
// The first swarm comes early so the mechanic is learned in the first minutes.
export const FIRST_EVENT_MS = { swarm: 75000 };

// ---------------------------------------------------------------- cosmetics
export const COSMETICS = [
  { id: 'scarfRed', name: 'Red scarf' },
  { id: 'bowBlue', name: 'Blue bow' },
  { id: 'scarfStripe', name: 'Striped scarf' },
  { id: 'partyHat', name: 'Party hat' },
  { id: 'beanie', name: 'Beanie' },
  { id: 'crown', name: 'Crown' },
  { id: 'scarfStar', name: 'Star scarf' },
  { id: 'flower', name: 'Flower' },
];
export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

// ---------------------------------------------------------------- milestones
// cond: { type, value }  type is one of
//   taps, sessionTaps, penguins, lifetimeFish, combo, item (value = id),
//   counter (value = { key, n }), migrations
// reward: { burstSecs } | { cosmetic } | { pearls } | {}
export const MILESTONES = [
  { id: 'firstSplash', name: 'First splash', desc: 'Your first fish.', cond: { type: 'taps', value: 1 }, reward: {} },
  { id: 'crowdOfFive', name: 'A crowd of five', desc: '5 penguins on the shore.', cond: { type: 'penguins', value: 5 }, reward: { burstSecs: 30 } },
  { id: 'rhythm', name: 'Rhythm section', desc: 'A combo of 10.', cond: { type: 'combo', value: 10 }, reward: { cosmetic: 'scarfRed' } },
  { id: 'hundred', name: 'Hundred fish', desc: '100 fish caught.', cond: { type: 'lifetimeFish', value: 100 }, reward: { burstSecs: 30 } },
  { id: 'strapIn', name: 'Strap in', desc: 'Your first Chinstrap.', cond: { type: 'item', value: 'chinstrap' }, reward: {} },
  { id: 'nestEgg', name: 'Nest egg', desc: 'A snow nest, ready for eggs.', cond: { type: 'item', value: 'snowNest' }, reward: { eggNow: true } },
  { id: 'fifteen', name: 'Fifteen friends', desc: '15 penguins.', cond: { type: 'penguins', value: 15 }, reward: { burstSecs: 60 } },
  { id: 'swarmCatcher', name: 'Swarm catcher', desc: 'Caught a fish swarm.', cond: { type: 'counter', value: { key: 'swarm', n: 1 } }, reward: {} },
  { id: 'thousand', name: 'Thousandaire', desc: '1,000 fish caught.', cond: { type: 'lifetimeFish', value: 1000 }, reward: { cosmetic: 'bowBlue' } },
  { id: 'gentooGo', name: 'Gentoo, go', desc: 'Your first Gentoo.', cond: { type: 'item', value: 'gentoo' }, reward: {} },
  { id: 'workout', name: 'Finger workout', desc: '100 taps in one session.', cond: { type: 'sessionTaps', value: 100 }, reward: { burstSecs: 60 } },
  { id: 'flow', name: 'Flow state', desc: 'A combo of 25.', cond: { type: 'combo', value: 25 }, reward: { cosmetic: 'scarfStripe' } },
  { id: 'thirty', name: 'Thirty strong', desc: '30 penguins.', cond: { type: 'penguins', value: 30 }, reward: { burstSecs: 90 } },
  { id: 'crested', name: 'Crested', desc: 'Your first Rockhopper.', cond: { type: 'item', value: 'rockhopper' }, reward: { cosmetic: 'partyHat' } },
  { id: 'tenThousand', name: 'Ten thousand', desc: '10,000 fish caught.', cond: { type: 'lifetimeFish', value: 10000 }, reward: {} },
  { id: 'sealApproval', name: 'Seal of approval', desc: 'Greeted the seal.', cond: { type: 'counter', value: { key: 'seal', n: 1 } }, reward: { burstSecs: 60 } },
  { id: 'hatchling', name: 'Hatchling', desc: 'Hatched an egg.', cond: { type: 'counter', value: { key: 'egg', n: 1 } }, reward: { cosmetic: 'flower' } },
  { id: 'fifty', name: 'Fifty flippers', desc: '50 penguins.', cond: { type: 'penguins', value: 50 }, reward: { cosmetic: 'beanie' } },
  { id: 'goldenTouch', name: 'Golden touch', desc: '10 golden fish.', cond: { type: 'counter', value: { key: 'golden', n: 10 } }, reward: {} },
  { id: 'frenzy', name: 'Frenzy!', desc: 'A combo of 50.', cond: { type: 'combo', value: 50 }, reward: { burstSecs: 120 } },
  { id: 'million', name: 'Million', desc: '1,000,000 fish caught.', cond: { type: 'lifetimeFish', value: 1000000 }, reward: { pearls: 1 } },
  { id: 'eighty', name: 'Eighty strong', desc: '80 penguins.', cond: { type: 'penguins', value: 80 }, reward: { burstSecs: 120 } },
  { id: 'majesty', name: 'Majesty', desc: 'Your first Emperor.', cond: { type: 'item', value: 'emperor' }, reward: { cosmetic: 'crown' } },
  { id: 'nightOwl', name: 'Night owl', desc: 'Stayed through a whole night.', cond: { type: 'counter', value: { key: 'nights', n: 1 } }, reward: { cosmetic: 'scarfStar' } },
  { id: 'whaleHello', name: 'Whale, hello', desc: 'Waved at a whale.', cond: { type: 'counter', value: { key: 'whale', n: 1 } }, reward: { pearls: 1 } },
  { id: 'wanderer', name: 'Wanderer', desc: 'Migrated for the first time.', cond: { type: 'migrations', value: 1 }, reward: {} },
  { id: 'tinyBlue', name: 'Tiny and blue', desc: 'Your first Little blue.', cond: { type: 'item', value: 'littleBlue' }, reward: { burstSecs: 120 } },
  { id: 'stargazer', name: 'Stargazer', desc: 'Caught 10 shooting stars.', cond: { type: 'counter', value: { key: 'star', n: 10 } }, reward: { pearls: 2 } },
];
export const MILESTONE_BY_ID = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

// ---------------------------------------------------------------- the scene
export const VIEW_W = 360;
export const VIEW_H = 400;
export const MAX_VISIBLE = 40;
export const MAX_PER_SPECIES = 10;
export const HERO = { x: 180, y: 338 };
export const ELDER = { x: 180, y: 252 };

// Standing spots on the floe. Rows front to back; the y also sets the depth
// scale and the paint order. Spots too close to a building anchor are skipped.
export const SLOTS = (() => {
  const slots = [];
  const anchors = ITEMS.filter((it) => it.anchor).map((it) => it.anchor);
  const rows = [
    { y: 258, xs: [80, 150, 186, 222, 258] },
    { y: 272, xs: [96, 130, 164, 198, 232, 264] },
    { y: 286, xs: [84, 118, 152, 186, 220, 254, 288, 318] },
    { y: 300, xs: [100, 134, 168, 202, 270, 304] },
    { y: 314, xs: [90, 124, 158, 192, 282, 316] },
    { y: 326, xs: [108, 142, 176, 210, 244, 278, 304] },
    { y: 340, xs: [60, 120, 240, 300, 330] },
  ];
  for (const row of rows) {
    for (const x of row.xs) {
      const tooClose = anchors.some((a) => Math.abs(a.x - x) < 26 && Math.abs(a.y - row.y) < 20);
      if (!tooClose) slots.push({ x, y: row.y });
    }
  }
  return slots;
})();
export const depthScale = (y) => 0.78 + ((y - 250) / 80) * 0.34;

// ---------------------------------------------------------------- strings
export const LABELS = {
  title: TITLE,
  fish: 'fish',
  perSecond: '/s',
  pearls: 'Pearls',
  tabColony: 'Colony',
  tabBuildings: 'Buildings',
  tabPearls: 'Pearls',
  buy: 'Buy',
  owned: 'owned',
  each: 'each',
  maxed: 'Fully built',
  nextIn: 'next in {s}',
  lockedPenguins: 'Unlocks at {n} penguins',
  lockedFish: 'Unlocks after {n} fish',
  lockedItem: 'Needs a {name}',
  lockedBiome: 'Unlocks in a later biome',
  perTap: '+{n} per tap each',
  perSec: '+{n}/s each',
  prodMult: '+{n}% production per level',
  krill: 'Tap gains {n}% of production per level',
  swarmBonus: 'Swarms +{n}% more often, +{s}s longer per level',
  hotSpring: 'Combo settles {n}% slower, +{g}% golden per level',
  hintTap: 'Tap the water to catch a fish',
  hintBuy: 'Buy an Adelie with your fish',
  milestone: 'Milestone',
  speciesUnlocked: '{name} penguins can join!',
  newBiome: 'Welcome to the {name}',
  comboTier: '{name} x{mult}',
  golden: 'Golden fish!',
  welcome: 'Warm welcome! x2 for a minute',
  boostSwarm: 'Swarm! x3',
  boostStar: 'Starlight! x2',
  boostWelcome: 'Welcome x2',
  migrateTitle: 'Migration',
  migrateLockedTitle: 'Migration',
  migrateLockedDesc: 'Catch {n} fish in this colony to open the way to a new shore.',
  migrateReady: 'Migrating now earns {n} Pearls. Waiting until {next} fish earns {more}.',
  migrateButton: 'Migrate',
  migrateConfirmTitle: 'Leave this shore?',
  migrateConfirmDesc: 'The colony sets off for the {biome}. Fish, penguins and buildings stay behind. You keep {n} Pearls, every Pearl upgrade and all your cosmetics.',
  migrateGo: 'Set off',
  cancel: 'Not yet',
  pearlsLocked: 'Pearls come from migrating. Grow this colony to 100K fish and the way opens.',
  pearlBuy: 'Upgrade',
  pearlMaxed: 'Complete',
  level: 'Lv {n}',
  settings: 'Settings',
  muted: 'Mute',
  sfx: 'Effects',
  music: 'Music',
  reduceMotion: 'Reduce motion',
  resetColony: 'Start over',
  resetAlsoPearls: 'Also forget Pearls and upgrades',
  confirmAgain: 'Tap again to confirm',
  back: 'Back',
  stats: 'Colony',
  statFish: 'Fish this colony',
  statAllFish: 'Fish all time',
  statTaps: 'Taps all time',
  statMigrations: 'Migrations',
  statBiome: 'Shore',
  milestonesHeader: 'Milestones',
  cosmeticGiven: '{what} for a {species}',
  chickGrown: 'The chick grew up and joined the Adelies',
  giftOpened: 'A gift washed ashore: {what}!',
  eventSwarm: 'Tap the swarm!',
  eventSeal: 'A seal says hello',
  eventEgg: 'Something is wobbling in the nest',
  eventStar: 'A shooting star!',
  eventGift: 'A crate drifts by',
  eventWhale: 'A whale!',
  version: 'v{n}',
};

export function label(key, vars) {
  let text = LABELS[key] || key;
  if (vars) {
    for (const k of Object.keys(vars)) text = text.split('{' + k + '}').join(String(vars[k]));
  }
  return text;
}
