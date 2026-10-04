// Owns the SVG scene: sky, water, floe, buildings, penguins, events. Everything
// is built from penguin.js strings and positioned here; motion is CSS. Nothing
// in here runs per tick except setPalette (once a second) and the tap effects.

import {
  SPECIES_ORDER, ITEMS, ITEM_BY_ID, SLOTS, depthScale, HERO, ELDER, VIEW_W, VIEW_H,
  biomeAt, EVENT_BY_ID,
} from './config.js';
import {
  allPenguinSymbols, allAccessorySymbols, fishSymbols, buildingSvg, tierFor, eventSvg,
} from './penguin.js';
import { visibleCounts } from './game.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

let svg = null;
let layers = {};
let slotOrder = [];              // slot indices in seeded order
let slotTaken = new Map();       // key -> slot index
let penguinNodes = new Map();    // key -> { g, acc, species }
let buildingTiers = {};          // id -> tier rendered
let seedUsed = 0;
let currentBiome = -1;
let elderNode = null;
let chickNode = null;
let eventNode = null;

// ---------------------------------------------------------------- helpers

function el(tag, attrs, html) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
  if (html) node.innerHTML = html;
  return node;
}

// Small deterministic rng so the layout is the same after a reload.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
}

// ---------------------------------------------------------------- building the stage

const FAR_SHAPES = {
  iceShelf: '<path d="M0 214 L30 190 L58 214 L80 200 L104 214 L150 184 L196 214 L226 198 L250 214 L300 186 L340 214 L360 204 L360 240 L0 240 Z" style="fill:var(--c-far)"/>'
    + '<path d="M150 184 L196 214 L150 214 Z M300 186 L340 214 L300 214 Z" fill="#ffffff" opacity="0.35"/>',
  rockyCoast: '<path d="M0 220 Q40 196 90 214 Q130 190 180 212 Q230 192 270 210 Q320 190 360 216 L360 240 L0 240 Z" style="fill:var(--c-far)"/>'
    + '<path d="M120 212 Q150 200 180 212 Z M250 210 Q290 196 320 212 Z" fill="#7bb661" opacity="0.5"/>',
  auroraNight: '<path d="M0 224 L50 176 L96 212 L140 168 L200 214 L244 180 L290 212 L330 186 L360 214 L360 240 L0 240 Z" style="fill:var(--c-far)"/>'
    + '<path d="M50 176 L62 190 L38 190 Z M140 168 L154 186 L126 186 Z M244 180 L256 194 L232 194 Z" fill="#ffffff" opacity="0.5"/>',
  sunriseLagoon: '<path d="M0 226 Q60 196 120 222 Q180 200 240 224 Q300 198 360 226 L360 240 L0 240 Z" style="fill:var(--c-far)"/>'
    + '<path d="M70 222 L74 196 L82 200 L78 222 Z M300 224 L304 198 L312 202 L308 224 Z" fill="#7bb661" opacity="0.6"/>',
};

function buildSky() {
  const sky = layers.sky;
  sky.innerHTML = '';
  sky.appendChild(el('rect', { x: 0, y: 0, width: VIEW_W, height: VIEW_H, style: 'fill:var(--c-sky-bottom)' }));
  sky.appendChild(el('rect', { x: 0, y: 0, width: VIEW_W, height: 160, style: 'fill:var(--c-sky-top)', opacity: 0.85 }));
  sky.appendChild(el('rect', { x: 0, y: 120, width: VIEW_W, height: 100, style: 'fill:var(--c-sky-bottom)', opacity: 0.7 }));
  // stars (hidden by day)
  const stars = el('g', { id: 'stars', opacity: 0 });
  const rnd = mulberry(99);
  for (let i = 0; i < 28; i++) {
    const r = 0.6 + rnd() * 1.1;
    stars.appendChild(el('circle', {
      cx: (rnd() * VIEW_W).toFixed(1), cy: (rnd() * 150).toFixed(1), r: r.toFixed(2), fill: '#ffffff',
      class: 'star', style: '--d:' + (rnd() * 4).toFixed(2) + 's',
    }));
  }
  sky.appendChild(stars);
  // aurora ribbons (shown in the aurora biome at night)
  const aurora = el('g', { id: 'aurora', opacity: 0 });
  aurora.innerHTML = '<path class="ribbon r1" d="M-20 120 Q60 60 140 100 T300 70 T420 110" fill="none" stroke="#7fe3c4" stroke-width="18" stroke-linecap="round" opacity="0.35"/>'
    + '<path class="ribbon r2" d="M-20 90 Q80 40 170 80 T330 50 T420 90" fill="none" stroke="#b79cf0" stroke-width="12" stroke-linecap="round" opacity="0.3"/>';
  sky.appendChild(aurora);
  // sun / moon
  const sun = el('g', { id: 'sun' });
  sun.innerHTML = '<circle r="18" style="fill:var(--c-sun)"/><circle r="26" style="fill:var(--c-sun)" opacity="0.18"/>';
  sky.appendChild(sun);
  // weather particles
  const weather = el('g', { id: 'weather' });
  const wr = mulberry(7);
  for (let i = 0; i < 14; i++) {
    weather.appendChild(el('circle', {
      class: 'flake', cx: (wr() * VIEW_W).toFixed(1), cy: 0, r: (1 + wr() * 1.6).toFixed(2), fill: '#ffffff',
      style: '--d:' + (wr() * 9).toFixed(2) + 's;--x:' + (wr() * 30 - 15).toFixed(0) + 'px;--t:' + (7 + wr() * 6).toFixed(1) + 's',
    }));
  }
  sky.appendChild(weather);
}

function buildWater() {
  const w = layers.water;
  w.innerHTML = '';
  w.appendChild(el('rect', { x: 0, y: 206, width: VIEW_W, height: VIEW_H - 206, style: 'fill:var(--c-water)' }));
  w.appendChild(el('rect', { x: 0, y: 300, width: VIEW_W, height: VIEW_H - 300, style: 'fill:var(--c-water-deep)', opacity: 0.55 }));
  const wave = (y, cls) => '<path class="wave ' + cls + '" d="M-40 ' + y + ' q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.35"/>';
  w.insertAdjacentHTML('beforeend', wave(360, 'w1') + wave(384, 'w2') + wave(222, 'w3'));
  const mist = el('ellipse', { id: 'mist', cx: 180, cy: 236, rx: 240, ry: 14, fill: '#ffffff', opacity: 0 });
  w.appendChild(mist);
}

function buildFloe() {
  const f = layers.floe;
  f.innerHTML = '';
  const outline = 'M0 236 L0 304 Q40 346 120 354 Q180 358 240 354 Q320 346 360 304 L360 236 Q300 228 180 231 Q60 228 0 236 Z';
  f.appendChild(el('path', { d: outline, style: 'fill:var(--c-ice-shade)', transform: 'translate(0 7)' }));
  f.appendChild(el('path', { d: outline, style: 'fill:var(--c-ice)' }));
  f.appendChild(el('path', { d: 'M30 262 Q90 252 150 258 M210 250 Q270 246 330 256', fill: 'none', style: 'stroke:var(--c-ice-shade)', 'stroke-width': 1.2, opacity: 0.7 }));
  // a splash target in front of the hero
  f.appendChild(el('g', { id: 'splashes' }));
}

function buildRows() {
  const p = layers.penguins;
  p.innerHTML = '';
  const ys = Array.from(new Set(SLOTS.map((s) => s.y))).sort((a, b) => a - b);
  for (const y of ys) p.appendChild(el('g', { class: 'row', 'data-y': y }));
}

function rowFor(y) {
  return layers.penguins.querySelector('.row[data-y="' + y + '"]') || layers.penguins;
}

function buildHero() {
  const h = layers.hero;
  h.innerHTML = '';
  const s = depthScale(HERO.y) * 1.05;
  h.appendChild(el('g', { transform: 'translate(' + HERO.x + ' ' + HERO.y + ') scale(' + s.toFixed(3) + ')' },
    '<g class="anim hero-anim"><use href="#sp-adelie"/></g>'));
}

export function init(svgElement) {
  svg = svgElement;
  svg.setAttribute('viewBox', '0 0 ' + VIEW_W + ' ' + VIEW_H);
  svg.innerHTML = '';
  const defs = el('defs', null, allPenguinSymbols() + allAccessorySymbols() + fishSymbols());
  svg.appendChild(defs);
  layers = {};
  for (const id of ['sky', 'far', 'farBuildings', 'water', 'floe', 'buildings', 'penguins', 'extras', 'event', 'hero', 'fx']) {
    layers[id] = el('g', { id: 'L-' + id });
    svg.appendChild(layers[id]);
  }
  buildSky();
  buildWater();
  buildFloe();
  buildRows();
  buildHero();
}

// ---------------------------------------------------------------- palette and time of day

export function setBiome(index) {
  if (index === currentBiome) return;
  currentBiome = index;
  const biome = biomeAt(index);
  layers.far.innerHTML = FAR_SHAPES[biome.id] || FAR_SHAPES.iceShelf;
  svg.setAttribute('data-weather', biome.weather);
  svg.setAttribute('data-biome', biome.id);
}

// night: 0 day .. 1 night. dayFraction: position in the cycle, for the sun.
export function setPalette(index, night, dayFraction) {
  const biome = biomeAt(index);
  const style = svg.style;
  for (const key of Object.keys(biome.day)) {
    const css = '--c-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    style.setProperty(css, mix(biome.day[key], biome.night[key], night));
  }
  svg.classList.toggle('night', night > 0.5);
  const stars = svg.querySelector('#stars');
  if (stars) stars.setAttribute('opacity', night.toFixed(2));
  const aurora = svg.querySelector('#aurora');
  if (aurora) aurora.setAttribute('opacity', biome.weather === 'aurora' ? (0.3 + night * 0.7).toFixed(2) : '0');
  const mist = svg.querySelector('#mist');
  if (mist) mist.setAttribute('opacity', biome.weather === 'mist' ? '0.35' : '0');
  // the sun rises at dawn and sets at dusk; the moon takes the night shift
  const sun = svg.querySelector('#sun');
  if (sun) {
    // 0.05 = dawn middle, 0.55 = dusk middle; map day to an arc, night to another
    let t;
    if (dayFraction >= 0.05 && dayFraction < 0.55) t = (dayFraction - 0.05) / 0.5;
    else t = (((dayFraction - 0.55) % 1) + 1) % 1 / 0.5;
    const x = 30 + t * 300;
    const y = 150 - Math.sin(t * Math.PI) * 110;
    sun.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
    sun.classList.toggle('moon', night > 0.5);
  }
}

// ---------------------------------------------------------------- penguins

function ensureSlots(seed) {
  if (seedUsed === seed && slotOrder.length) return;
  seedUsed = seed;
  const rnd = mulberry(seed);
  slotOrder = SLOTS.map((_, i) => i);
  for (let i = slotOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = slotOrder[i]; slotOrder[i] = slotOrder[j]; slotOrder[j] = t;
  }
  slotTaken = new Map();
  for (const key of penguinNodes.keys()) removePenguin(key);
}

function freeSlot() {
  const used = new Set(slotTaken.values());
  for (const idx of slotOrder) if (!used.has(idx)) return idx;
  return slotOrder[Math.floor(Math.random() * slotOrder.length)];
}

function behaviourFor(key) {
  const h = hashKey(key);
  if (h < 0.68) return 'bob';
  if (h < 0.9) return 'waddle';
  return 'slide';
}

function addPenguin(key, species, fresh) {
  const idx = freeSlot();
  slotTaken.set(key, idx);
  const slot = SLOTS[idx];
  const h = hashKey(key + 'x');
  const s = depthScale(slot.y);
  const g = el('g', {
    class: 'penguin' + (fresh ? ' arrive' : ''),
    'data-key': key,
    transform: 'translate(' + slot.x + ' ' + slot.y + ') scale(' + s.toFixed(3) + ')',
  });
  const flip = h > 0.5 ? ' flip' : '';
  g.innerHTML = '<g class="anim ' + behaviourFor(key) + flip + '" style="--seed:' + h.toFixed(3) + ';--wx:' + (8 + h * 12).toFixed(0) + 'px">'
    + '<use href="#sp-' + species + '"/><use class="acc" href="" style="display:none"/></g>';
  rowFor(slot.y).appendChild(g);
  penguinNodes.set(key, { g, acc: g.querySelector('.acc'), species });
}

function removePenguin(key) {
  const node = penguinNodes.get(key);
  if (node && node.g.parentNode) node.g.parentNode.removeChild(node.g);
  penguinNodes.delete(key);
  slotTaken.delete(key);
}

function setAccessory(node, id) {
  if (!id) {
    node.acc.style.display = 'none';
    node.acc.setAttribute('href', '');
    return;
  }
  node.acc.style.display = '';
  node.acc.setAttribute('href', '#acc-' + id);
}

function syncPenguins(state, announce) {
  ensureSlots(state.layoutSeed);
  const counts = visibleCounts(state.items);
  const wanted = new Set();
  for (const sp of SPECIES_ORDER) {
    const n = counts[sp] || 0;
    for (let i = 0; i < n; i++) {
      const key = sp + '#' + i;
      wanted.add(key);
      if (!penguinNodes.has(key)) addPenguin(key, sp, announce);
      setAccessory(penguinNodes.get(key), state.cosmetics[key] || null);
    }
  }
  for (const key of Array.from(penguinNodes.keys())) {
    if (!wanted.has(key)) removePenguin(key);
  }
  // surplus badges: "x27" above the front-most penguin of a species
  const badges = layers.extras.querySelectorAll('.badge');
  badges.forEach((b) => b.remove());
  for (const sp of SPECIES_ORDER) {
    const item = ITEMS.find((it) => it.species === sp);
    const owned = state.items[item.id] || 0;
    const shown = counts[sp] || 0;
    if (owned > shown && shown > 0) {
      let best = null;
      for (let i = 0; i < shown; i++) {
        const node = penguinNodes.get(sp + '#' + i);
        const slot = SLOTS[slotTaken.get(sp + '#' + i)];
        if (node && (!best || slot.y > best.slot.y)) best = { node, slot };
      }
      if (best) {
        const b = el('g', { class: 'badge', transform: 'translate(' + best.slot.x + ' ' + (best.slot.y - 58 * depthScale(best.slot.y)) + ')' });
        const text = '×' + (owned - shown);
        b.innerHTML = '<rect x="-14" y="-8" width="28" height="13" rx="6.5" fill="#26344a" opacity="0.75"/>'
          + '<text x="0" y="2" text-anchor="middle" font-size="8.5" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="600">' + text + '</text>';
        layers.extras.appendChild(b);
      }
    }
  }
}

function syncBuildings(state) {
  for (const it of ITEMS) {
    if (it.kind !== 'building') continue;
    const level = state.items[it.id] || 0;
    const parent = it.anchor.y < 236 ? layers.farBuildings : layers.buildings;
    let slot = svg.querySelector('#b-' + it.id);
    if (!level) {
      if (slot) slot.remove();
      buildingTiers[it.id] = 0;
      continue;
    }
    const tier = tierFor(level);
    if (!slot) {
      slot = el('g', { id: 'b-' + it.id, class: 'bslot arrive', transform: 'translate(' + it.anchor.x + ' ' + it.anchor.y + ')' });
      parent.appendChild(slot);
      buildingTiers[it.id] = 0;
    }
    if (buildingTiers[it.id] !== tier) {
      slot.innerHTML = buildingSvg(it.id, tier);
      buildingTiers[it.id] = tier;
    }
  }
}

function syncExtras(state) {
  // the elder emperor from the pearl tree
  const wantElder = !!state.pearlUpgrades.elder;
  if (wantElder && !elderNode) {
    const s = depthScale(ELDER.y) * 1.1;
    elderNode = el('g', { class: 'penguin elder arrive', transform: 'translate(' + ELDER.x + ' ' + ELDER.y + ') scale(' + s.toFixed(3) + ')' },
      '<g class="anim bob" style="--seed:0.5"><use href="#sp-emperor"/><use href="#acc-crown"/></g>');
    layers.extras.appendChild(elderNode);
  } else if (!wantElder && elderNode) {
    elderNode.remove();
    elderNode = null;
  }
  // a chick while one is growing up, next to the nest
  const wantChick = state.chickMs > 0;
  if (wantChick && !chickNode) {
    const a = ITEM_BY_ID.snowNest.anchor;
    chickNode = el('g', { class: 'penguin chick arrive', transform: 'translate(' + (a.x - 24) + ' ' + (a.y + 10) + ') scale(0.8)' },
      '<g class="anim bob" style="--seed:0.2"><use href="#sp-chick"/></g>');
    layers.extras.appendChild(chickNode);
  } else if (!wantChick && chickNode) {
    chickNode.remove();
    chickNode = null;
  }
}

// announce: new penguins pop in (false on a plain reload)
export function sync(state, announce) {
  setBiome(state.biome);
  syncPenguins(state, announce !== false);
  syncBuildings(state);
  syncExtras(state);
}

export function rebuild(state) {
  for (const key of Array.from(penguinNodes.keys())) removePenguin(key);
  layers.buildings.innerHTML = '';
  layers.farBuildings.innerHTML = '';
  layers.extras.innerHTML = '';
  buildingTiers = {};
  elderNode = null;
  chickNode = null;
  seedUsed = 0;
  hideEvent();
  sync(state, false);
}

// ---------------------------------------------------------------- events

const EVENT_POS = {
  water: { x: 110, y: 374 },
  waterRight: { x: 296, y: 372 },
  waterLeft: { x: 56, y: 372 },
  nest: { x: ITEM_BY_ID.snowNest.anchor.x, y: ITEM_BY_ID.snowNest.anchor.y },
  sky: { x: 250, y: 60 },
  horizon: { x: 90, y: 222 },
};

export function showEvent(id) {
  hideEvent();
  const def = EVENT_BY_ID[id];
  if (!def) return;
  const pos = EVENT_POS[def.slot] || EVENT_POS.water;
  const wrap = el('g', { class: 'event-wrap', transform: 'translate(' + pos.x + ' ' + pos.y + ')' });
  wrap.innerHTML = eventSvg(id);
  // a generous invisible hit area, so a thumb cannot miss it
  const hit = el('ellipse', { class: 'event-target', 'data-event': id, cx: 0, cy: -6, rx: 44, ry: 34, fill: '#fff', opacity: 0.001 });
  wrap.appendChild(hit);
  layers.event.appendChild(wrap);
  eventNode = wrap;
}

export function hideEvent() {
  if (eventNode) eventNode.remove();
  eventNode = null;
}

export function eventClientPoint() {
  if (!eventNode) return null;
  const r = eventNode.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ---------------------------------------------------------------- tap effects

export function clientToSvg(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const m = svg.getScreenCTM();
  if (!m) return { x: VIEW_W / 2, y: VIEW_H / 2 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

export function svgToClient(x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m);
  return { x: p.x, y: p.y };
}

function restart(node, cls, ms) {
  node.classList.remove(cls);
  void node.getBoundingClientRect();
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

// The hero dives, a fish flies from the water to where the finger was.
export function tapFx(clientX, clientY, golden, reduce) {
  const anim = layers.hero.querySelector('.hero-anim');
  if (anim && !reduce) restart(anim, 'dive', 520);
  const from = { x: HERO.x, y: HERO.y + 16 };
  const splash = el('ellipse', { class: 'splash', cx: from.x, cy: from.y, rx: 6, ry: 2.4, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, opacity: 0.8 });
  layers.fx.appendChild(splash);
  setTimeout(() => splash.remove(), 600);
  const to = clientToSvg(clientX, clientY);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fish = el('g', { class: 'fish-fly' + (golden ? ' gold' : ''), transform: 'translate(' + from.x + ' ' + from.y + ')', style: '--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px' });
  fish.innerHTML = '<use href="#' + (golden ? 'fish-gold' : 'fish') + '"/>';
  layers.fx.appendChild(fish);
  setTimeout(() => fish.remove(), reduce ? 350 : 650);
  if (layers.fx.childElementCount > 30) layers.fx.firstElementChild.remove();
}

// Makes every penguin hop once (frenzy, migration, big milestones).
export function cheer() {
  for (const node of penguinNodes.values()) {
    const anim = node.g.querySelector('.anim');
    if (anim) restart(anim, 'cheer', 700);
  }
}

export const penguinKeyOf = (target) => {
  const g = target && target.closest ? target.closest('.penguin[data-key]') : null;
  return g ? g.getAttribute('data-key') : null;
};
export const eventIdOf = (target) => {
  const g = target && target.closest ? target.closest('.event-target') : null;
  return g ? g.getAttribute('data-event') : null;
};
export const heroClientPoint = () => svgToClient(HERO.x, HERO.y - 30);
