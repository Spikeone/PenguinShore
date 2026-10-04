// All the artwork, as SVG strings built from primitives. No image files.
// Every penguin symbol is drawn with its feet at (0, 0), about 40 wide and
// 58 tall, so the scene only has to translate and scale it. Pure functions,
// so the tests can check them from node.

import { SPECIES, COSMETICS } from './config.js';

const esc = (v) => String(v);

// ---------------------------------------------------------------- penguins

export function penguinSymbol(speciesId) {
  const sp = SPECIES[speciesId];
  if (!sp) return '';
  const body = sp.body;
  const belly = sp.belly;
  const eye = sp.eye || '#0b0d12';
  const parts = [];
  // shadow on the ice
  parts.push('<ellipse class="shadow" cx="0" cy="0" rx="15" ry="3.5" fill="#000" opacity="0.12"/>');
  // flippers behind the body
  parts.push('<ellipse cx="-16" cy="-24" rx="5" ry="13" fill="' + body + '" transform="rotate(14 -16 -24)" class="flipper l"/>');
  parts.push('<ellipse cx="16" cy="-24" rx="5" ry="13" fill="' + body + '" transform="rotate(-14 16 -24)" class="flipper r"/>');
  // feet
  parts.push('<ellipse cx="-7" cy="-1" rx="6.5" ry="2.6" fill="' + sp.feet + '"/>');
  parts.push('<ellipse cx="7" cy="-1" rx="6.5" ry="2.6" fill="' + sp.feet + '"/>');
  // body and belly
  parts.push('<ellipse cx="0" cy="-28" rx="17" ry="25" fill="' + body + '"/>');
  parts.push('<ellipse cx="0" cy="-22" rx="11.5" ry="17" fill="' + belly + '"/>');
  if (sp.face) {
    parts.push('<ellipse cx="0" cy="-41" rx="9" ry="7" fill="' + sp.face + '"/>');
  }
  if (sp.chinstrap) {
    parts.push('<ellipse cx="0" cy="-40" rx="10.5" ry="8" fill="#ffffff"/>');
    parts.push('<path d="M-9 -37 Q0 -31 9 -37" fill="none" stroke="' + body + '" stroke-width="1.4"/>');
  }
  if (sp.cap) {
    parts.push('<path d="M-11 -44 Q-6 -49 -2 -46 Q0 -45 2 -46 Q6 -49 11 -44 Q6 -45 2 -44 Q0 -43 -2 -44 Q-6 -45 -11 -44 Z" fill="' + sp.cap + '"/>');
  }
  if (sp.earPatch) {
    parts.push('<ellipse cx="-12" cy="-38" rx="3.5" ry="5" fill="' + sp.earPatch + '" opacity="0.9"/>');
    parts.push('<ellipse cx="12" cy="-38" rx="3.5" ry="5" fill="' + sp.earPatch + '" opacity="0.9"/>');
  }
  // eyes
  const ring = sp.eyeRing || (sp.chinstrap || sp.face ? null : '#ffffff');
  const ringR = sp.eyeRing ? 3.6 : 3;
  if (ring) {
    parts.push('<circle cx="-6" cy="-41" r="' + ringR + '" fill="' + ring + '"/>');
    parts.push('<circle cx="6" cy="-41" r="' + ringR + '" fill="' + ring + '"/>');
  }
  parts.push('<circle cx="-5.5" cy="-41" r="1.7" fill="' + eye + '"/>');
  parts.push('<circle cx="6.5" cy="-41" r="1.7" fill="' + eye + '"/>');
  parts.push('<circle cx="-5" cy="-41.6" r="0.6" fill="#fff"/>');
  parts.push('<circle cx="7" cy="-41.6" r="0.6" fill="#fff"/>');
  // eyelids: the same colour as whatever is behind the eye, scaled in to blink
  const lid = sp.chinstrap || sp.face ? '#ffffff' : body;
  // SMIL rather than CSS: document styles do not reliably reach into a
  // <use> shadow tree, and a blink that never opens looks like a glare.
  const blinkAt = (0.4 + (Object.keys(SPECIES).indexOf(speciesId) * 0.7) % 3.9).toFixed(1);
  parts.push('<rect class="lids" x="-10" y="-45.5" width="20" height="0" fill="' + lid + '">'
    + '<animate attributeName="height" values="0;0;5;5;0;0" keyTimes="0;0.9;0.92;0.96;0.98;1" dur="4.6s" begin="-' + blinkAt + 's" repeatCount="indefinite"/>'
    + '</rect>');
  // crest
  if (sp.crest === 'rockhopper') {
    parts.push('<path d="M-8 -46 L-15 -54 L-11 -45 L-16 -50 L-10 -43 Z" fill="#f2c94c"/>');
    parts.push('<path d="M8 -46 L15 -54 L11 -45 L16 -50 L10 -43 Z" fill="#f2c94c"/>');
    parts.push('<path d="M-9 -45 Q-6 -47 -3 -45 M3 -45 Q6 -47 9 -45" fill="none" stroke="#f2c94c" stroke-width="1.6"/>');
  } else if (sp.crest === 'macaroni') {
    parts.push('<path d="M-2 -51 L-14 -56 L-8 -48 L-18 -50 L-9 -45 Z" fill="#f0a830"/>');
    parts.push('<path d="M2 -51 L14 -56 L8 -48 L18 -50 L9 -45 Z" fill="#f0a830"/>');
  }
  // beak
  parts.push('<path d="M-4 -36 L4 -36 L0 -30 Z" fill="' + sp.beak + '"/>');
  if (sp.beakStripe) parts.push('<path d="M-2.5 -36 L1 -36 L-0.5 -31 Z" fill="' + sp.beakStripe + '"/>');
  // cheeks
  parts.push('<circle cx="-10" cy="-35" r="2" fill="#ffb3b3" opacity="0.45"/>');
  parts.push('<circle cx="10" cy="-35" r="2" fill="#ffb3b3" opacity="0.45"/>');
  return '<symbol id="sp-' + esc(speciesId) + '" overflow="visible">' + parts.join('') + '</symbol>';
}

export function allPenguinSymbols() {
  return Object.keys(SPECIES).map(penguinSymbol).join('');
}

// ---------------------------------------------------------------- accessories
// Drawn on top of a penguin in the same coordinate space.

const ACCESSORY_ART = {
  scarfRed: () => '<path d="M-13 -32 Q0 -25 13 -32 L13 -27 Q0 -20 -13 -27 Z" fill="#e05a5a"/>'
    + '<rect x="4" y="-28" width="6" height="14" rx="3" fill="#e05a5a"/>',
  scarfStripe: () => '<path d="M-13 -32 Q0 -25 13 -32 L13 -27 Q0 -20 -13 -27 Z" fill="#6fa8dc"/>'
    + '<path d="M-10 -29 Q0 -23 10 -29" fill="none" stroke="#ffffff" stroke-width="1.6"/>'
    + '<rect x="-10" y="-28" width="6" height="14" rx="3" fill="#6fa8dc"/>'
    + '<rect x="-10" y="-22" width="6" height="2" fill="#ffffff"/>',
  scarfStar: () => '<path d="M-13 -32 Q0 -25 13 -32 L13 -27 Q0 -20 -13 -27 Z" fill="#3b3f73"/>'
    + '<circle cx="-6" cy="-28" r="1" fill="#ffe08a"/><circle cx="2" cy="-26" r="1" fill="#ffe08a"/><circle cx="9" cy="-29" r="1" fill="#ffe08a"/>'
    + '<rect x="4" y="-28" width="6" height="14" rx="3" fill="#3b3f73"/><circle cx="7" cy="-19" r="1" fill="#ffe08a"/>',
  bowBlue: () => '<path d="M0 -31 L-8 -35 L-8 -27 Z" fill="#4f8fd9"/><path d="M0 -31 L8 -35 L8 -27 Z" fill="#4f8fd9"/>'
    + '<circle cx="0" cy="-31" r="2.2" fill="#2f6fb5"/>',
  partyHat: () => '<path d="M-7 -50 L0 -66 L7 -50 Z" fill="#f28ab2"/><path d="M-4 -56 L4 -56 L0 -60 Z" fill="#ffffff" opacity="0.8"/>'
    + '<circle cx="0" cy="-66" r="2.2" fill="#ffe08a"/>',
  beanie: () => '<path d="M-11 -48 Q0 -62 11 -48 Z" fill="#7bb661"/><rect x="-12" y="-50" width="24" height="4" rx="2" fill="#5e9448"/>'
    + '<circle cx="0" cy="-60" r="2.6" fill="#ffffff"/>',
  crown: () => '<path d="M-9 -49 L-9 -57 L-4 -52 L0 -59 L4 -52 L9 -57 L9 -49 Z" fill="#f2c94c"/>'
    + '<circle cx="0" cy="-53" r="1.3" fill="#e05a5a"/>',
  flower: () => '<g transform="translate(9 -50)"><circle cx="-2.5" cy="0" r="2" fill="#f7a8c4"/><circle cx="2.5" cy="0" r="2" fill="#f7a8c4"/>'
    + '<circle cx="0" cy="-2.5" r="2" fill="#f7a8c4"/><circle cx="0" cy="2.5" r="2" fill="#f7a8c4"/><circle cx="0" cy="0" r="1.6" fill="#ffe08a"/></g>',
};

export function accessorySymbol(id) {
  const art = ACCESSORY_ART[id];
  if (!art) return '';
  return '<symbol id="acc-' + esc(id) + '" overflow="visible">' + art() + '</symbol>';
}

export function allAccessorySymbols() {
  return COSMETICS.map((c) => accessorySymbol(c.id)).join('');
}

// ---------------------------------------------------------------- fish

export function fishSymbols() {
  const fish = (id, fill, fin) =>
    '<symbol id="' + id + '" overflow="visible">'
    + '<path d="M-7 0 L-12 -4 L-11 0 L-12 4 Z" fill="' + fin + '"/>'
    + '<ellipse cx="0" cy="0" rx="8" ry="4.2" fill="' + fill + '"/>'
    + '<circle cx="4" cy="-1" r="1" fill="#1d2230"/>'
    + '</symbol>';
  return fish('fish', '#f59e42', '#e0742f') + fish('fish-gold', '#f2c94c', '#d9a62a');
}

// ---------------------------------------------------------------- buildings
// Each returns a <g> at the origin. `tier` is 1, 2 or 3 and adds detail.

const BUILDING_ART = {
  iceHole: (t) => '<ellipse cx="0" cy="0" rx="20" ry="8" fill="var(--c-ice-shade)"/>'
    + '<ellipse cx="0" cy="0" rx="16" ry="6" fill="var(--c-water-deep)"/>'
    + '<ellipse class="ripple" cx="0" cy="0" rx="7" ry="2.6" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.6"/>'
    + (t >= 2 ? '<rect x="-27" y="-11" width="7" height="9" rx="1.5" fill="#6fa8dc"/><rect x="-28" y="-12" width="9" height="2" rx="1" fill="#4f8fd9"/>' : '')
    + (t >= 3 ? '<rect x="20" y="-10" width="9" height="4" rx="1" fill="#a9744f"/><path d="M22 -10 L26 -22 L28 -22" fill="none" stroke="#a9744f" stroke-width="1.5"/>' : ''),
  snowNest: (t) => {
    const n = 8 + (t - 1) * 4;
    let s = '<ellipse cx="0" cy="0" rx="18" ry="7" fill="var(--c-ice-shade)"/>';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * 16;
      const y = Math.sin(a) * 6;
      s += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="3.2" ry="2.2" fill="' + (i % 2 ? '#9aa3ad' : '#b7bec7') + '"/>';
    }
    return s;
  },
  krillPantry: (t) => '<rect x="-14" y="-24" width="2.5" height="24" fill="#8c6a4a"/><rect x="11.5" y="-24" width="2.5" height="24" fill="#8c6a4a"/>'
    + '<path d="M-18 -24 L0 -34 L18 -24 Z" fill="#e05a5a"/><path d="M-18 -24 L18 -24 L18 -21 L-18 -21 Z" fill="#ffffff"/>'
    + '<rect x="-12" y="-10" width="24" height="6" rx="1" fill="#a9744f"/>'
    + '<g transform="translate(-6 -17) scale(0.5)"><use href="#fish"/></g><g transform="translate(5 -16) scale(0.5)"><use href="#fish"/></g>'
    + (t >= 2 ? '<g transform="translate(-1 -13) scale(0.45)"><use href="#fish"/></g>' : '')
    + (t >= 3 ? '<rect x="-8" y="-7" width="5" height="3" fill="#f2c94c"/><rect x="3" y="-7" width="5" height="3" fill="#f2c94c"/>' : ''),
  igloo: (t) => '<path d="M-24 0 Q-24 -30 0 -30 Q24 -30 24 0 Z" fill="#ffffff"/>'
    + '<path d="M-24 0 Q-24 -30 0 -30 Q24 -30 24 0 Z" fill="none" stroke="var(--c-ice-shade)" stroke-width="1.2"/>'
    + '<path d="M-16 -16 L16 -16 M-21 -8 L21 -8 M-8 -24 L8 -24" stroke="var(--c-ice-shade)" stroke-width="1"/>'
    + '<path d="M-6 0 Q-6 -12 0 -12 Q6 -12 6 0 Z" fill="#2b3140"/>'
    + '<path class="window-glow" d="M-6 0 Q-6 -12 0 -12 Q6 -12 6 0 Z" fill="#ffd27a" opacity="0"/>'
    + (t >= 2 ? '<rect x="8" y="-30" width="4" height="7" fill="var(--c-ice-shade)"/><circle class="smoke" cx="10" cy="-35" r="2.5" fill="#ffffff" opacity="0.6"/>' : '')
    + (t >= 3 ? '<path d="M24 0 Q24 -16 36 -16 Q48 -16 48 0 Z" fill="#ffffff"/><path d="M33 0 Q33 -7 36 -7 Q39 -7 39 0 Z" fill="#2b3140"/>' : ''),
  lighthouse: (t) => '<ellipse cx="0" cy="2" rx="18" ry="6" fill="#8a8f99"/>'
    + '<path d="M-7 0 L-5 -40 L5 -40 L7 0 Z" fill="#ffffff"/>'
    + '<path d="M-6.4 -12 L6.4 -12 L6.8 -4 L-6.8 -4 Z M-5.6 -30 L5.6 -30 L6 -22 L-6 -22 Z" fill="#e05a5a"/>'
    + '<rect x="-6" y="-48" width="12" height="8" fill="#2b3140"/><rect x="-4" y="-47" width="8" height="6" class="lamp" fill="#ffd27a"/>'
    + '<path d="M-7 -48 L0 -54 L7 -48 Z" fill="#e05a5a"/>'
    + '<path class="beam" d="M4 -44 L60 -70 L60 -24 Z" fill="#ffe9a8" opacity="0"/>'
    + (t >= 2 ? '<rect x="-16" y="-4" width="8" height="4" fill="#a9744f"/>' : '')
    + (t >= 3 ? '<circle cx="12" cy="-2" r="3" fill="#7bb661"/>' : ''),
  hotSpring: (t) => '<ellipse cx="0" cy="0" rx="24" ry="9" fill="#8a94a6"/>'
    + '<ellipse cx="0" cy="-1" rx="20" ry="7" fill="#7fd1c9"/>'
    + '<ellipse cx="-4" cy="-2" rx="8" ry="2.5" fill="#ffffff" opacity="0.35"/>'
    + '<ellipse class="steam s1" cx="-8" cy="-10" rx="4" ry="6" fill="#ffffff" opacity="0.5"/>'
    + '<ellipse class="steam s2" cx="6" cy="-12" rx="4.5" ry="7" fill="#ffffff" opacity="0.5"/>'
    + (t >= 2 ? '<ellipse cx="-20" cy="-4" rx="4" ry="3" fill="#9aa3ad"/><ellipse cx="19" cy="-3" rx="4" ry="3" fill="#9aa3ad"/>' : '')
    + (t >= 3 ? '<ellipse class="steam s3" cx="-1" cy="-14" rx="4" ry="6" fill="#ffffff" opacity="0.5"/>' : ''),
  observatory: (t) => '<path d="M-20 0 L-20 -16 L20 -16 L20 0 Z" fill="#e9e4f5"/>'
    + '<path d="M-20 -16 Q0 -38 20 -16 Z" fill="#8f7fc9"/>'
    + '<path d="M2 -20 L10 -34 L14 -32 L6 -18 Z" fill="#3b3f73"/>'
    + '<rect x="-14" y="-10" width="6" height="6" rx="1" fill="#3b3f73"/><rect x="8" y="-10" width="6" height="6" rx="1" class="window-glow" fill="#ffd27a"/>'
    + (t >= 2 ? '<path d="M-26 0 L-26 -10 L-20 -10 L-20 0 Z" fill="#d9d2ea"/>' : '')
    + (t >= 3 ? '<circle cx="-28" cy="-24" r="2" fill="#ffffff"/><circle cx="26" cy="-30" r="1.5" fill="#ffffff"/>' : ''),
};

export const tierFor = (level) => (level >= 15 ? 3 : (level >= 5 ? 2 : 1));

export function buildingSvg(id, tier) {
  const art = BUILDING_ART[id];
  if (!art) return '';
  return '<g class="building b-' + esc(id) + ' tier-' + tier + '">' + art(tier) + '</g>';
}

// ---------------------------------------------------------------- events

const EVENT_ART = {
  swarm: () => {
    let s = '<ellipse cx="0" cy="0" rx="30" ry="12" fill="#ffffff" opacity="0.18"/>';
    const pts = [[-16, -3], [-6, -7], [4, -2], [14, -6], [-10, 4], [2, 6], [12, 3], [-20, 6]];
    pts.forEach((p, i) => {
      s += '<g class="swarm-fish f' + (i % 3) + '" transform="translate(' + p[0] + ' ' + p[1] + ') scale(0.6)"><use href="#fish"/></g>';
    });
    s += '<circle class="bubble b1" cx="-8" cy="-10" r="2" fill="#ffffff" opacity="0.7"/><circle class="bubble b2" cx="10" cy="-12" r="1.5" fill="#ffffff" opacity="0.7"/>';
    return s;
  },
  seal: () => '<ellipse cx="0" cy="4" rx="26" ry="7" fill="#ffffff" opacity="0.25"/>'
    + '<ellipse cx="0" cy="-2" rx="18" ry="12" fill="#8a94a6"/>'
    + '<ellipse cx="0" cy="-6" rx="14" ry="9" fill="#9aa3ad"/>'
    + '<circle cx="-5" cy="-8" r="1.8" fill="#1d2230"/><circle cx="5" cy="-8" r="1.8" fill="#1d2230"/>'
    + '<ellipse cx="0" cy="-3" rx="3" ry="2" fill="#2b3140"/>'
    + '<path d="M-4 -2 L-12 -4 M-4 -1 L-12 0 M4 -2 L12 -4 M4 -1 L12 0" stroke="#2b3140" stroke-width="0.7"/>'
    + '<ellipse class="wave-flipper" cx="20" cy="-8" rx="4" ry="8" fill="#8a94a6"/>'
    + '<circle cx="-7" cy="-4" r="2" fill="#ffb3b3" opacity="0.5"/><circle cx="7" cy="-4" r="2" fill="#ffb3b3" opacity="0.5"/>',
  egg: () => '<ellipse class="egg" cx="0" cy="-6" rx="7" ry="9" fill="#fff8e8" stroke="#e5dcc5" stroke-width="1"/>'
    + '<circle cx="-2" cy="-9" r="1.2" fill="#e5dcc5"/><circle cx="3" cy="-4" r="1" fill="#e5dcc5"/>',
  star: () => '<path d="M-60 24 L0 0" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>'
    + '<path d="M-40 16 L0 0" stroke="#fff6c8" stroke-width="3" stroke-linecap="round" opacity="0.9"/>'
    + '<path d="M0 -8 L2.4 -2.4 L8 0 L2.4 2.4 L0 8 L-2.4 2.4 L-8 0 L-2.4 -2.4 Z" fill="#ffe08a"/>',
  gift: () => '<ellipse cx="0" cy="6" rx="22" ry="7" fill="#ffffff"/>'
    + '<rect x="-10" y="-12" width="20" height="16" rx="2" fill="#a9744f"/>'
    + '<rect x="-10" y="-6" width="20" height="3" fill="#e05a5a"/><rect x="-1.5" y="-12" width="3" height="16" fill="#e05a5a"/>'
    + '<path d="M0 -12 L-5 -17 L-2 -18 L0 -14 L2 -18 L5 -17 Z" fill="#e05a5a"/>',
  whale: () => '<path d="M-50 0 Q-30 -34 10 -28 Q40 -22 50 0 Z" fill="#6f8fb5"/>'
    + '<path d="M-50 0 Q-20 -12 50 0 Z" fill="#9fb8d8"/>'
    + '<path d="M44 -6 Q60 -24 66 -14 Q62 -8 56 -2 Z" fill="#6f8fb5"/>'
    + '<circle cx="18" cy="-18" r="2" fill="#1d2230"/>'
    + '<path class="spout" d="M-6 -30 Q-10 -46 -16 -50 M-6 -30 Q-4 -46 2 -50" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.8"/>',
};

export function eventSvg(id) {
  const art = EVENT_ART[id];
  if (!art) return '';
  return '<g class="event event-target ev-' + esc(id) + '" data-event="' + esc(id) + '">' + art() + '</g>';
}

// A small chick that follows a penguin after an egg hatched.
export function chickSvg() {
  return '<g class="chick"><use href="#sp-chick"/></g>';
}
