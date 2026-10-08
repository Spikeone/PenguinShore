// All DOM except the SVG scene (scene.js) and transient effects (fx.js):
// the HUD, the shop, overlays, settings, the collection, and input wiring.

import {
  ITEMS, ITEM_BY_ID, SPECIES, SPECIES_ORDER, PEARL_UPGRADES, MILESTONES, COSMETICS, COSMETIC_BY_ID,
  BIOMES, EVENTS,
  costOfMany, comboMult, comboTier, biomeAt, biomeLap, pearlsFor, migrateTarget,
  masteryTier, nextMasteryAt, MASTERY_TIERS,
  LABELS, label, APP_VERSION, COMBO_WINDOW_MS,
} from './config.js';
import { fmt, fmtRate, fmtTime } from './format.js';
import { buildingSvg } from './penguin.js';
import { colonySizeOf, masteryTotal } from './game.js';
import * as scene from './scene.js';

const $ = (id) => document.getElementById(id);
const OVERLAYS = ['overlay-settings', 'overlay-migrate', 'overlay-collection'];

export function createUi(cb) {
  const els = {
    app: $('app'),
    fishCount: $('fish-count'),
    fishRate: $('fish-rate'),
    combo: $('combo'),
    comboText: $('combo-text'),
    comboFill: $('combo-fill'),
    tapChip: $('tap-chip'),
    pearlPill: $('pearl-pill'),
    pearlCount: $('pearl-count'),
    boosts: $('boost-pills'),
    sceneWrap: $('scene-wrap'),
    shop: $('shop'),
    tabs: Array.from(document.querySelectorAll('.tab')),
    qtys: Array.from(document.querySelectorAll('.qty')),
    migrateDesc: $('migrate-desc'),
    migrateTitle: $('migrate-title'),
    statsGrid: $('stats-grid'),
    milestoneList: $('milestone-list'),
    milestoneCount: $('milestone-count'),
    version: $('version'),
  };

  let tab = 'colony';
  let qty = 1;
  let cards = new Map();     // id -> card
  let goals = null;          // { root, rows: [{ id, fill, text }] }
  let shopSignature = '';

  // ---------------- overlays ----------------
  function showOverlay(name) {
    for (const id of OVERLAYS) {
      const o = $(id);
      if (o) o.classList.toggle('hidden', id !== name);
    }
  }
  const hideOverlays = () => showOverlay(null);
  const isOverlayOpen = () => OVERLAYS.some((id) => {
    const o = $(id);
    return o && !o.classList.contains('hidden');
  });

  // ---------------- HUD ----------------
  let lastFishText = '';
  let lastRateText = '';
  let lastChipText = '';
  function renderHud(game) {
    const s = game.state;
    const fishText = fmt(s.fish);
    if (fishText !== lastFishText) { els.fishCount.textContent = fishText; lastFishText = fishText; }
    const rateText = '+' + fmtRate(game.fishPerSecond()) + LABELS.perSecond;
    if (rateText !== lastRateText) { els.fishRate.textContent = rateText; lastRateText = rateText; }
    // combo
    const tier = comboTier(s.combo);
    const show = s.combo >= 3;
    els.combo.classList.toggle('hidden', !show);
    if (show) {
      els.comboText.textContent = tier ? '×' + comboMult(s.combo) : s.combo;
      els.combo.classList.toggle('tiered', !!tier);
      els.combo.classList.toggle('hot', s.sinceTapMs <= COMBO_WINDOW_MS);
      const next = s.combo < 20 ? 20 : (s.combo < 50 ? 50 : 100);
      els.comboFill.style.width = Math.min(100, (s.combo / next) * 100) + '%';
    }
    // tired flippers
    const fatigue = game.tapFatigue();
    const chip = fatigue < 0.985 ? label('tired', { n: Math.round(fatigue * 100) }) : '';
    if (chip !== lastChipText) {
      lastChipText = chip;
      els.tapChip.textContent = chip;
      els.tapChip.classList.toggle('hidden', !chip);
    }
    els.pearlCount.textContent = fmt(s.pearls);
    els.pearlPill.classList.toggle('ready', game.canMigrate());
    els.pearlPill.classList.toggle('hidden', s.pearls === 0 && s.migrations === 0 && !game.canMigrate());
    const pearlsTab = els.tabs.find((t) => t.dataset.tab === 'pearls');
    if (pearlsTab) pearlsTab.classList.toggle('glow', game.canMigrate());
  }

  function renderBoosts(state) {
    const kinds = Object.keys(state.boosts);
    const want = kinds.map((k) => k + ':' + Math.ceil(state.boosts[k].msLeft / 1000)).join('|');
    if (els.boosts.dataset.sig === want) return;
    els.boosts.dataset.sig = want;
    els.boosts.innerHTML = '';
    for (const k of kinds) {
      const b = state.boosts[k];
      const pill = document.createElement('div');
      pill.className = 'boost-pill ' + k;
      const name = k === 'swarm' ? LABELS.boostSwarm : (k === 'star' ? LABELS.boostStar : LABELS.boostWelcome);
      pill.textContent = name + ' · ' + Math.ceil(b.msLeft / 1000) + 's';
      els.boosts.appendChild(pill);
    }
  }

  // ---------------- goals ----------------
  // Progress of a milestone condition, 0..1, or null when it is not a number.
  function goalProgress(m, game) {
    const s = game.state;
    const c = m.cond;
    const frac = (have, need) => Math.max(0, Math.min(1, have / need));
    switch (c.type) {
      case 'taps': return { f: frac(s.taps, c.value), text: fmt(s.taps) + ' / ' + fmt(c.value) };
      case 'sessionTaps': return { f: frac(s.sessionTaps, c.value), text: fmt(s.sessionTaps) + ' / ' + fmt(c.value) };
      case 'penguins': return { f: frac(game.colonySize(), c.value), text: fmt(game.colonySize()) + ' / ' + fmt(c.value) };
      case 'lifetimeFish': return { f: frac(s.lifetimeFish, c.value), text: fmt(s.lifetimeFish) + ' / ' + fmt(c.value) };
      case 'totalFish': return { f: frac(s.totalFish, c.value), text: fmt(s.totalFish) + ' / ' + fmt(c.value) };
      case 'combo': return { f: frac(s.bestCombo, c.value), text: s.bestCombo + ' / ' + c.value };
      case 'counter': return { f: frac(s.counters[c.value.key] || 0, c.value.n), text: (s.counters[c.value.key] || 0) + ' / ' + c.value.n };
      case 'migrations': return { f: frac(s.migrations, c.value), text: s.migrations + ' / ' + c.value };
      case 'lucky': return { f: frac(s.luckyFound, c.value), text: s.luckyFound + ' / ' + c.value };
      case 'mastery': return { f: frac(game.masteryTotal(), c.value), text: game.masteryTotal() + ' / ' + c.value };
      case 'item': return { f: 0, text: '' };
      default: return { f: 0, text: '' };
    }
  }

  // The three closest unmet goals, nearest first. Goals that cannot start yet
  // (a species not unlocked, a shore not reached) stay out of the list.
  function nextGoals(game) {
    const s = game.state;
    const open = MILESTONES.filter((m) => !s.seen.milestones.includes(m.id)).filter((m) => {
      if (m.cond.type === 'item') return game.isUnlocked(m.cond.value);
      if (m.cond.type === 'counter' && m.cond.value.key === 'egg') return s.items.snowNest > 0;
      return true;
    });
    const scored = open.map((m) => ({ m, p: goalProgress(m, game) }));
    scored.sort((a, b) => b.p.f - a.p.f || MILESTONES.indexOf(a.m) - MILESTONES.indexOf(b.m));
    return scored.slice(0, 3);
  }

  function buildGoalsCard(game) {
    const root = document.createElement('div');
    root.className = 'goals-card';
    root.innerHTML = '<div class="gc-title">' + LABELS.goalsTitle + '</div>';
    const rows = [];
    for (const g of nextGoals(game)) {
      const row = document.createElement('div');
      row.className = 'goal';
      row.innerHTML = '<div class="g-head"><span class="g-name">' + g.m.name + '</span><span class="g-text"></span></div>'
        + '<div class="g-desc">' + g.m.desc + '</div>'
        + '<div class="g-bar"><div class="g-fill"></div></div>';
      root.appendChild(row);
      rows.push({ m: g.m, fill: row.querySelector('.g-fill'), text: row.querySelector('.g-text') });
    }
    goals = { root, rows };
    return root;
  }

  function updateGoals(game) {
    if (!goals) return;
    for (const r of goals.rows) {
      const p = goalProgress(r.m, game);
      r.fill.style.width = (p.f * 100).toFixed(1) + '%';
      if (r.text.textContent !== p.text) r.text.textContent = p.text;
    }
  }

  // ---------------- shop ----------------
  // Each building is a different shape; frame it so it fills its thumbnail.
  const THUMB_BOX = {
    iceHole: '-28 -24 56 36',
    snowNest: '-26 -22 52 32',
    krillPantry: '-26 -40 52 48',
    igloo: '-30 -36 60 42',
    lighthouse: '-26 -60 52 68',
    hotSpring: '-30 -28 60 40',
    observatory: '-32 -44 64 50',
    tidePools: '-30 -18 60 28',
    lanternDock: '-12 -44 56 52',
    hotVents: '-30 -30 60 40',
    icebreaker: '-36 -42 72 52',
    auroraBeacon: '-20 -56 40 64',
    crystalCave: '-28 -44 56 52',
  };
  const thumbFor = (it) => {
    if (it.kind === 'penguin') {
      return '<svg class="thumb" viewBox="-24 -62 48 66" aria-hidden="true"><use href="#sp-' + it.species + '"/></svg>';
    }
    const box = THUMB_BOX[it.id] || '-34 -60 68 70';
    return '<svg class="thumb" viewBox="' + box + '" aria-hidden="true">' + buildingSvg(it.id, 1) + '</svg>';
  };

  const effectText = (it) => {
    if (it.rate) return label('perSec', { n: fmtRate(it.rate) });
    if (it.tapAdd) return label('perTap', { n: it.tapAdd });
    if (it.prodMult) return label('prodMult', { n: Math.round(it.prodMult * 100) });
    if (it.krill) return label('krill', { n: Math.round(it.krill * 100) });
    if (it.swarmFreq) return label('swarmBonus', { n: Math.round(it.swarmFreq * 100), s: it.swarmWindowMs / 1000 });
    if (it.comboSlow) return label('hotSpring', { n: Math.round(it.comboSlow * 100), g: (it.golden * 100).toFixed(1).replace(/\.0$/, '') });
    if (it.tapMult) return label('tidePools', { n: Math.round(it.tapMult * 100), g: Math.round(it.golden * 100) });
    if (it.burstMult) return label('burstMult', { n: Math.round(it.burstMult * 100) });
    if (it.perPenguin) return label('perPenguin', { n: Math.round(it.perPenguin * 1000) });
    if (it.nightMult) return label('nightMult', { n: Math.round(it.nightMult * 100) });
    if (it.masteryBonus) return label('masteryBonus', { n: Math.round(it.masteryBonus * 100) });
    return '';
  };

  function lockText(it, game) {
    const u = it.unlock || {};
    const s = game.state;
    if (u.biome && s.biome < u.biome) return LABELS.lockedBiome;
    if (u.penguins && game.colonySize() < u.penguins) return label('lockedPenguins', { n: u.penguins });
    if (u.item && !(s.items[u.item] > 0)) return label('lockedItem', { name: ITEM_BY_ID[u.item].name });
    if (u.lifetimeFish && s.lifetimeFish < u.lifetimeFish) return label('lockedFish', { n: u.lifetimeFish });
    return '';
  }

  const stars = (n) => '★'.repeat(n);

  function masteryText(it, game) {
    const owned = game.state.items[it.id] || 0;
    const tier = masteryTier(owned);
    const next = nextMasteryAt(owned);
    const parts = [];
    if (tier > 0) parts.push(label('mastery', { stars: stars(tier) }));
    parts.push(next ? label('masteryNext', { n: next }) : LABELS.masteryMax);
    const lucky = game.state.lucky[it.id] || 0;
    if (lucky) parts.push(label('luckyOwned', { n: lucky }));
    return parts.join(' · ');
  }

  // Which cards a tab shows: everything unlocked, plus the next two locked
  // ones so there is always something to look forward to. Items that need a
  // later shore stay hidden until then.
  function itemsForTab(game) {
    const kind = tab === 'colony' ? 'penguin' : 'building';
    const out = [];
    let lockedShown = 0;
    for (const it of ITEMS) {
      if (it.kind !== kind) continue;
      if (it.unlock.biome && game.state.biome < it.unlock.biome) continue;
      if (game.isUnlocked(it.id)) { out.push(it); continue; }
      if (lockedShown < 2) { out.push(it); lockedShown++; }
    }
    return out;
  }

  function buildItemCard(it, game) {
    const root = document.createElement('button');
    root.className = 'shop-item' + (it.kind === 'penguin' ? ' penguin-item' : '');
    root.dataset.id = it.id;
    root.innerHTML = thumbFor(it)
      + '<div class="info"><div class="name">' + it.name + ' <span class="owned"></span></div>'
      + '<div class="effect">' + effectText(it) + '</div>'
      + '<div class="flavour">' + it.flavour + '</div>'
      + (it.kind === 'penguin' ? '<div class="mastery"></div>' : '')
      + '<div class="lock"></div></div>'
      + '<div class="price"><span class="cost"></span><span class="eta"></span></div>';
    root.addEventListener('click', () => cb.onBuy(it.id, qty));
    return {
      root,
      owned: root.querySelector('.owned'),
      cost: root.querySelector('.cost'),
      eta: root.querySelector('.eta'),
      lock: root.querySelector('.lock'),
      mastery: root.querySelector('.mastery'),
      item: it,
    };
  }

  function buildPearlCard(def) {
    const root = document.createElement('button');
    root.className = 'shop-item pearl-item';
    root.dataset.id = def.id;
    root.innerHTML = '<div class="pearl-icon"></div>'
      + '<div class="info"><div class="name">' + def.name + ' <span class="owned"></span></div>'
      + '<div class="effect">' + def.desc + '</div></div>'
      + '<div class="price"><span class="cost"></span></div>';
    root.addEventListener('click', () => cb.onBuyPearl(def.id));
    return { root, owned: root.querySelector('.owned'), cost: root.querySelector('.cost'), pearl: def };
  }

  function biomeTitle(index) {
    const lap = biomeLap(index);
    return biomeAt(index).name + (lap > 0 ? ' (' + label('lap', { n: lap + 1 }) + ')' : '');
  }

  function buildMigrateCard(game) {
    const root = document.createElement('div');
    root.className = 'migrate-card';
    const s = game.state;
    const next = s.biome + 1;
    const target = game.migrateGoal();
    if (game.canMigrate()) {
      const n = game.pearlsOnMigrate();
      const base = pearlsFor(s.lifetimeFish, s.migrations);
      // the fish needed for one more base pearl
      const nextTarget = Math.pow((base - 2 * s.migrations + 1) / 4, 2) * target;
      root.innerHTML = '<div class="mc-title">' + LABELS.migrateTitle + '</div>'
        + '<div class="mc-desc">' + label('migrateReady', { n, next: fmt(nextTarget), more: n + 1 }) + '</div>'
        + '<div class="mc-next">' + label('newBiome', { name: biomeTitle(next) }) + ' · ' + biomeAt(next).tagline + '</div>'
        + '<button class="big-btn primary" id="btn-migrate">' + LABELS.migrateButton + '</button>';
      root.querySelector('#btn-migrate').addEventListener('click', () => cb.onMigrateOpen());
    } else {
      const frac = Math.min(1, s.lifetimeFish / target);
      root.innerHTML = '<div class="mc-title">' + LABELS.migrateLockedTitle + ' · ' + biomeTitle(s.biome) + '</div>'
        + '<div class="mc-desc">' + label('migrateLockedDesc', { n: fmt(target) }) + '</div>'
        + '<div class="mc-bar"><div class="mc-fill" style="width:' + (frac * 100).toFixed(1) + '%"></div></div>'
        + '<div class="mc-progress">' + fmt(s.lifetimeFish) + ' / ' + fmt(target) + '</div>';
    }
    return root;
  }

  function renderShop(game) {
    const list = tab === 'pearls' ? [] : itemsForTab(game);
    const goalIds = tab === 'colony' ? nextGoals(game).map((g) => g.m.id).join('+') : '';
    const sig = tab + ':' + list.map((it) => it.id + (game.isUnlocked(it.id) ? '+' : '-')).join(',')
      + ':' + (game.canMigrate() ? 'M' : 'm') + ':' + game.state.biome + ':' + qty + ':' + goalIds;
    if (sig === shopSignature) { updateShop(game); return; }
    shopSignature = sig;
    els.shop.innerHTML = '';
    cards = new Map();
    goals = null;
    if (tab === 'pearls') {
      els.shop.appendChild(buildMigrateCard(game));
      const note = document.createElement('p');
      note.className = 'shop-note';
      note.textContent = LABELS.pearlsHow;
      els.shop.appendChild(note);
      for (const def of PEARL_UPGRADES) {
        const card = buildPearlCard(def);
        cards.set(def.id, card);
        els.shop.appendChild(card.root);
      }
    } else {
      if (tab === 'colony') els.shop.appendChild(buildGoalsCard(game));
      for (const it of list) {
        const card = buildItemCard(it, game);
        cards.set(it.id, card);
        els.shop.appendChild(card.root);
      }
    }
    updateShop(game);
    els.shop.scrollTop = 0;
  }

  function updateShop(game) {
    const s = game.state;
    const fps = game.fishPerSecond();
    updateGoals(game);
    for (const card of cards.values()) {
      if (card.pearl) {
        const def = card.pearl;
        const lv = s.pearlUpgrades[def.id] || 0;
        const maxed = lv >= def.costs.length;
        card.owned.textContent = label('level', { n: lv + '/' + def.costs.length });
        card.cost.textContent = maxed ? LABELS.pearlMaxed : def.costs[lv] + ' ●';
        card.root.classList.toggle('maxed', maxed);
        card.root.classList.toggle('cant', !maxed && !game.canBuyPearl(def.id));
        continue;
      }
      const it = card.item;
      const level = s.items[it.id] || 0;
      const unlocked = game.isUnlocked(it.id);
      const lock = unlocked ? '' : lockText(it, game);
      if (card.lock.textContent !== lock) card.lock.textContent = lock;
      card.root.classList.toggle('locked', !unlocked);
      const ownedText = level ? '×' + level : '';
      if (card.owned.textContent !== ownedText) card.owned.textContent = ownedText;
      if (card.mastery) {
        const mt = unlocked && level > 0 ? masteryText(it, game) : '';
        if (card.mastery.textContent !== mt) card.mastery.textContent = mt;
      }
      const maxed = it.max && level >= it.max;
      card.root.classList.toggle('maxed', !!maxed);
      if (maxed) {
        card.cost.textContent = LABELS.maxed;
        card.eta.textContent = '';
        continue;
      }
      const n = qty === 'max' ? Math.max(1, game.quantityFor(it.id, 'max')) : Math.min(qty, it.max ? it.max - level : qty);
      const cost = costOfMany(it, level, n);
      const can = s.fish >= cost && unlocked;
      card.root.classList.toggle('cant', !can);
      const costText = fmt(cost) + (n > 1 ? ' · ' + n : '');
      if (card.cost.textContent !== costText) card.cost.textContent = costText;
      let eta = '';
      if (!can && unlocked && fps > 0) eta = label('nextIn', { s: fmtTime((cost - s.fish) / fps) });
      if (card.eta.textContent !== eta) card.eta.textContent = eta;
    }
  }

  function setTab(next) {
    tab = next;
    for (const t of els.tabs) t.classList.toggle('active', t.dataset.tab === tab);
  }
  function setQty(next) {
    qty = next;
    for (const q of els.qtys) q.classList.toggle('active', String(q.dataset.qty) === String(qty));
  }

  // ---------------- overlays' content ----------------
  function renderMigrate(game) {
    const s = game.state;
    els.migrateTitle.textContent = LABELS.migrateConfirmTitle;
    els.migrateDesc.textContent = label('migrateConfirmDesc', { biome: biomeTitle(s.biome + 1), n: game.pearlsOnMigrate() });
  }

  function renderSettings(settings, game) {
    $('set-muted').checked = !!settings.muted;
    $('set-sfx').value = settings.sfx;
    $('set-music').value = settings.music;
    $('set-reduce').checked = !!settings.reduceMotion;
    $('set-reset-pearls').checked = false;
    const s = game.state;
    const rows = [
      [LABELS.statBiome, biomeTitle(s.biome)],
      [LABELS.statFish, fmt(s.lifetimeFish)],
      [LABELS.statAllFish, fmt(s.totalFish)],
      [LABELS.statTaps, fmt(s.taps)],
      [LABELS.statMigrations, String(s.migrations)],
      [LABELS.statPearlsEarned, String(s.pearlsEarned)],
      [LABELS.statLucky, String(s.luckyFound)],
      [LABELS.statMastery, String(game.masteryTotal())],
    ];
    els.statsGrid.innerHTML = rows.map((r) => '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>').join('');
    els.version.textContent = label('version', { n: APP_VERSION });
  }

  function renderCollection(game) {
    const s = game.state;
    // species: seen ones with their current count, mastery and golden count
    $('col-species').innerHTML = SPECIES_ORDER.map((sp) => {
      const item = ITEMS.find((it) => it.species === sp);
      const seen = s.seen.species.includes(sp);
      const owned = s.items[item.id] || 0;
      const tier = masteryTier(owned);
      const lucky = s.lucky[item.id] || 0;
      return '<div class="col-cell ' + (seen ? 'seen' : '') + '">'
        + '<svg viewBox="-24 -62 48 66" aria-hidden="true"><use href="#sp-' + sp + (lucky ? '-gold' : '') + '"/></svg>'
        + '<div class="col-name">' + (seen ? SPECIES[sp].name : LABELS.unknown) + '</div>'
        + '<div class="col-sub">' + (seen ? (owned ? '×' + owned + ' ' + stars(tier) : '') : '') + '</div>'
        + '</div>';
    }).join('');
    $('col-cosmetics').innerHTML = COSMETICS.map((c) => {
      const have = s.unlockedCosmetics.includes(c.id);
      return '<div class="col-cell small ' + (have ? 'seen' : '') + '">'
        + '<svg viewBox="-24 -70 48 74" aria-hidden="true"><use href="#sp-adelie"/>' + (have ? '<use href="#acc-' + c.id + '"/>' : '') + '</svg>'
        + '<div class="col-name">' + (have ? c.name : LABELS.unknown) + '</div></div>';
    }).join('');
    $('col-shores').innerHTML = BIOMES.map((b, i) => {
      const seen = s.seen.biomes.some((idx) => idx % BIOMES.length === i);
      return '<div class="col-shore ' + (seen ? 'seen' : '') + '" style="--a:' + b.day.skyTop + ';--b:' + b.day.water + ';--c:' + b.day.ice + '">'
        + '<div class="col-swatch"></div><div class="col-name">' + (seen ? b.name : LABELS.unknown) + '</div></div>';
    }).join('');
    $('col-visitors').innerHTML = EVENTS.map((e) => {
      const n = s.counters[e.id] || 0;
      return '<div class="col-visitor ' + (n ? 'seen' : '') + '"><span>' + (n ? e.name : LABELS.unknown) + '</span><span class="col-count">' + (n ? '×' + n : '') + '</span></div>';
    }).join('');
    els.milestoneCount.textContent = s.seen.milestones.length + ' / ' + MILESTONES.length;
    els.milestoneList.innerHTML = MILESTONES.map((m) => {
      const done = s.seen.milestones.includes(m.id);
      return '<div class="ms ' + (done ? 'done' : '') + '"><span class="ms-name">' + (done ? m.name : LABELS.unknown) + '</span>'
        + '<span class="ms-desc">' + m.desc + '</span></div>';
    }).join('');
  }

  // ---------------- input ----------------
  function bind() {
    // one tap anywhere on the scene; buttons elsewhere use click
    els.sceneWrap.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      const eventId = scene.eventIdOf(e.target);
      if (eventId) { cb.onTapEvent(e.clientX, e.clientY); return; }
      const key = scene.penguinKeyOf(e.target);
      if (key) { cb.onTapPenguin(key, e.clientX, e.clientY); return; }
      cb.onTap(e.clientX, e.clientY);
    });
    els.sceneWrap.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (isOverlayOpen()) return;
        e.preventDefault();
        const p = scene.heroClientPoint();
        cb.onTap(p.x, p.y);
      } else if (e.key === 'Escape') {
        if (isOverlayOpen()) cb.onCloseOverlay();
      }
    });

    for (const t of els.tabs) t.addEventListener('click', () => cb.onTab(t.dataset.tab));
    for (const q of els.qtys) q.addEventListener('click', () => cb.onQty(q.dataset.qty === 'max' ? 'max' : Number(q.dataset.qty)));
    els.pearlPill.addEventListener('click', () => cb.onTab('pearls'));
    $('btn-settings').addEventListener('click', () => cb.onOpenSettings());
    $('btn-collection').addEventListener('click', () => cb.onOpenCollection());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => cb.onCloseOverlay()));
    $('btn-migrate-go').addEventListener('click', () => cb.onMigrateConfirm());

    $('set-muted').addEventListener('change', (e) => cb.onSetting('muted', e.target.checked));
    $('set-sfx').addEventListener('input', (e) => cb.onSetting('sfx', Number(e.target.value)));
    $('set-music').addEventListener('input', (e) => cb.onSetting('music', Number(e.target.value)));
    $('set-reduce').addEventListener('change', (e) => cb.onSetting('reduceMotion', e.target.checked));
    $('btn-reset').addEventListener('click', (e) => cb.onReset(e.currentTarget, $('set-reset-pearls').checked));
  }

  bind();
  setTab('colony');
  setQty(1);

  return {
    renderHud, renderBoosts, renderShop, updateShop, setTab, setQty,
    showOverlay, hideOverlays, isOverlayOpen, renderMigrate, renderSettings, renderCollection,
    biomeTitle,
    get tab() { return tab; },
    get qty() { return qty; },
  };
}

export const speciesName = (id) => (SPECIES[id] ? SPECIES[id].name : id);
export const cosmeticName = (id) => (COSMETIC_BY_ID[id] ? COSMETIC_BY_ID[id].name : id);
