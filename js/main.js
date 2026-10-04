// Bootstrap and driver: owns the clock, turns game events into rendering,
// sound and effects, and keeps everything saved.

import {
  TICK_MS, DAY_CYCLE_MS, nightAmount, LABELS, label, ITEM_BY_ID, MILESTONE_BY_ID, EVENT_BY_ID, biomeAt,
} from './config.js';
import { createGame } from './game.js';
import { createUi, speciesName, cosmeticName } from './ui.js';
import * as scene from './scene.js';
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as music from './music.js';
import * as fx from './fx.js';
import { fmt } from './format.js';

let settings = storage.loadSettings();
let game = createGame({ rng: Math.random });
let ui = null;

let lastTick = 0;
let lastSave = 0;
let lastSecond = 0;
let dirty = false;
let persistDisabled = false;
let updateReady = false;
let hintShown = '';

const now = () => (window.performance ? performance.now() : Date.now());

// ---------------------------------------------------------------- persistence

function persist(force) {
  if (persistDisabled) return;
  const t = now();
  if (!force && (!dirty || t - lastSave < 2000)) return;
  lastSave = t;
  dirty = false;
  const snap = game.snapshot();
  snap.savedAt = Date.now();
  storage.saveRun(snap);
}

// ---------------------------------------------------------------- audio

function startAudio() {
  if (audio.unlock()) {
    audio.applySettings(settings);
    if (!music.isPlaying()) music.start();
  }
}

// ---------------------------------------------------------------- hints

function refreshHint() {
  const s = game.state;
  let text = '';
  if (s.taps === 0) text = LABELS.hintTap;
  else if (game.colonySize() === 0 && s.fish >= 10) text = LABELS.hintBuy;
  if (text !== hintShown) {
    hintShown = text;
    fx.hint(text);
  }
}

// ---------------------------------------------------------------- events

let lastTapPoint = null;

function onFishGained(ev) {
  if (ev.source !== 'tap') return;
  const p = lastTapPoint || scene.heroClientPoint();
  const reduce = fx.reduceMotion();
  scene.tapFx(p.x, p.y, ev.golden, reduce);
  fx.floatNumber('+' + fmt(Math.max(1, Math.round(ev.amount))), p.x, p.y - 10, ev.golden ? 'gold' : '');
  if (ev.golden) {
    audio.playSfx('golden');
  } else {
    audio.playSfx('tap', { step: Math.min(9, Math.floor(game.state.combo / 5)) });
  }
}

function onMilestone(ev) {
  const def = MILESTONE_BY_ID[ev.id];
  if (!def) return;
  let desc = def.desc;
  if (ev.fish) desc += ' +' + fmt(ev.fish) + ' ' + LABELS.fish;
  if (def.reward.pearls) desc += ' +' + def.reward.pearls + ' ' + LABELS.pearls;
  if (def.reward.cosmetic) desc += ' · ' + cosmeticName(def.reward.cosmetic);
  fx.toast({ title: LABELS.milestone + ': ' + def.name, desc, icon: '<span class="ti">★</span>', kind: 'milestone' });
  audio.playSfx('milestone');
  if (ev.fish && ev.fish >= 100) scene.cheer();
}

function onEventSpawned(ev) {
  scene.showEvent(ev.id);
  audio.playSfx('eventSpawn');
  const key = 'event' + ev.id.charAt(0).toUpperCase() + ev.id.slice(1);
  fx.toast({ title: LABELS[key] || EVENT_BY_ID[ev.id].name, icon: '<span class="ti">✦</span>', kind: 'event', ms: 1600 });
}

function onEventResolved(ev) {
  const p = scene.eventClientPoint() || scene.heroClientPoint();
  scene.hideEvent();
  if (ev.fish) fx.floatNumber('+' + fmt(Math.round(ev.fish)), p.x, p.y, 'big');
  if (ev.id === 'seal') audio.playSfx('seal');
  else if (ev.id === 'egg') audio.playSfx('chick');
  else audio.playSfx('eventWin');
  if (ev.id === 'whale' || ev.id === 'swarm') scene.cheer();
}

function dispatch(events) {
  if (!events || events.length === 0) return;
  let shopDirty = false;
  let sceneDirty = false;
  for (const ev of events) {
    switch (ev.type) {
      case 'fishGained':
        onFishGained(ev);
        break;
      case 'bought':
        audio.playSfx('buy');
        shopDirty = true;
        sceneDirty = true;
        break;
      case 'speciesUnlocked':
        fx.banner(label('speciesUnlocked', { name: speciesName(ev.species) }));
        audio.playSfx('unlock');
        shopDirty = true;
        break;
      case 'milestone':
        onMilestone(ev);
        shopDirty = true;
        break;
      case 'comboTier':
        fx.banner(label('comboTier', { name: ev.tier.name, mult: ev.tier.mult }));
        audio.playSfx('comboTier');
        if (ev.tier.at >= 50) scene.cheer();
        break;
      case 'cosmetic':
        if (ev.source === 'gift') {
          fx.toast({ title: label('giftOpened', { what: cosmeticName(ev.id) }), icon: '<span class="ti">❀</span>', kind: 'event' });
        }
        sceneDirty = true;
        break;
      case 'cosmeticChanged':
        sceneDirty = true;
        break;
      case 'eventSpawned':
        onEventSpawned(ev);
        break;
      case 'eventResolved':
        onEventResolved(ev);
        sceneDirty = true;
        break;
      case 'eventExpired':
        scene.hideEvent();
        break;
      case 'boostStarted':
        if (ev.kind === 'welcome') {
          fx.toast({ title: LABELS.welcome, icon: '<span class="ti">☀</span>', kind: 'event' });
          audio.playSfx('welcome');
        }
        break;
      case 'boostEnded':
        break;
      case 'chickGrown':
        fx.toast({ title: LABELS.chickGrown, icon: '<span class="ti">♥</span>', kind: 'event' });
        audio.playSfx('chick');
        sceneDirty = true;
        shopDirty = true;
        break;
      case 'dayPhase':
        break;
      case 'migrated': {
        const biome = biomeAt(game.state.biome);
        scene.rebuild(game.state);
        applyPalette(true);
        fx.banner(label('newBiome', { name: biome.name }), biome.tagline);
        audio.playSfx('migrate');
        shopDirty = true;
        break;
      }
      case 'pearlBought':
        audio.playSfx('pearl');
        shopDirty = true;
        sceneDirty = true;
        break;
      case 'loaded':
        scene.rebuild(game.state);
        applyPalette(true);
        shopDirty = true;
        break;
      default:
        break;
    }
  }
  if (sceneDirty) scene.sync(game.state, true);
  if (shopDirty) ui.renderShop(game);
  ui.renderHud(game);
  ui.renderBoosts(game.state);
  refreshHint();
  dirty = true;
  const forced = events.some((e) => ['bought', 'migrated', 'milestone', 'pearlBought', 'eventResolved', 'cosmetic'].includes(e.type));
  persist(forced);
}

// ---------------------------------------------------------------- clock

function applyPalette(force) {
  const frac = game.state.dayMs / DAY_CYCLE_MS;
  scene.setPalette(game.state.biome, nightAmount(frac), frac);
  if (force) scene.setBiome(game.state.biome);
}

function step() {
  const t = now();
  if (document.hidden) {
    lastTick = t;
    return;
  }
  const elapsed = t - lastTick;
  lastTick = t;
  if (elapsed <= 0) return;
  const events = game.tick(elapsed);
  if (events.length) dispatch(events);
  else {
    ui.renderHud(game);
    ui.updateShop(game);
    ui.renderBoosts(game.state);
    dirty = true;
  }
  if (t - lastSecond >= 1000) {
    lastSecond = t;
    applyPalette(false);
    persist(false);
  }
}

// ---------------------------------------------------------------- settings

function applyReduceMotion() {
  const os = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('app').classList.toggle('reduce', !!settings.reduceMotion || !!os);
}

// Two-tap confirmation for anything destructive.
function armButton(button, labelText, action) {
  if (button.dataset.armed === '1') {
    clearTimeout(Number(button.dataset.timer));
    button.dataset.armed = '0';
    button.classList.remove('armed');
    button.textContent = labelText;
    action();
    return;
  }
  button.dataset.armed = '1';
  button.classList.add('armed');
  button.textContent = LABELS.confirmAgain;
  const timer = setTimeout(() => {
    button.dataset.armed = '0';
    button.classList.remove('armed');
    button.textContent = labelText;
  }, 2500);
  button.dataset.timer = String(timer);
}

// ---------------------------------------------------------------- callbacks

const callbacks = {
  onTap(x, y) {
    startAudio();
    lastTapPoint = { x, y };
    dispatch(game.tap());
  },
  onTapEvent(x, y) {
    startAudio();
    lastTapPoint = { x, y };
    dispatch(game.tapEvent());
  },
  onTapPenguin(key, x, y) {
    startAudio();
    const events = game.tapPenguin(key);
    if (events.length) {
      audio.playSfx('tab');
      dispatch(events);
    } else {
      // no cosmetics yet: the penguin simply counts as the water
      lastTapPoint = { x, y };
      dispatch(game.tap());
    }
  },
  onBuy(id, qty) {
    startAudio();
    const events = game.buy(id, qty);
    if (!events.length) {
      audio.playSfx('cantBuy');
      return;
    }
    dispatch(events);
  },
  onBuyPearl(id) {
    startAudio();
    const events = game.buyPearl(id);
    if (!events.length) { audio.playSfx('cantBuy'); return; }
    dispatch(events);
  },
  onTab(tab) {
    startAudio();
    audio.playSfx('tab');
    ui.setTab(tab);
    ui.renderShop(game);
  },
  onQty(q) {
    startAudio();
    audio.playSfx('tab');
    ui.setQty(q);
    ui.renderShop(game);
  },
  onOpenSettings() {
    startAudio();
    ui.renderSettings(settings, game);
    ui.showOverlay('overlay-settings');
    music.setDucked(true);
  },
  onCloseOverlay() {
    ui.hideOverlays();
    music.setDucked(false);
  },
  onMigrateOpen() {
    startAudio();
    if (!game.canMigrate()) return;
    ui.renderMigrate(game);
    ui.showOverlay('overlay-migrate');
    music.setDucked(true);
  },
  onMigrateConfirm() {
    ui.hideOverlays();
    music.setDucked(false);
    dispatch(game.migrate());
    ui.setTab('colony');
    ui.renderShop(game);
  },
  onSetting(key, value) {
    settings[key] = value;
    storage.saveSettings(settings);
    if (key === 'muted' || key === 'sfx' || key === 'music') {
      startAudio();
      audio.applySettings(settings);
      if (key === 'sfx') audio.playSfx('buy');
    }
    if (key === 'reduceMotion') applyReduceMotion();
  },
  onReset(button, alsoPearls) {
    armButton(button, LABELS.resetColony, () => {
      const old = game.state;
      persistDisabled = true;
      storage.clearRun();
      game = createGame({ rng: Math.random });
      const events = game.loadState(null);
      if (!alsoPearls) {
        game.state.pearls = old.pearls;
        game.state.pearlsEarned = old.pearlsEarned;
        game.state.pearlUpgrades = old.pearlUpgrades;
        game.state.unlockedCosmetics = old.unlockedCosmetics;
        game.state.migrations = old.migrations;
        game.state.biome = old.biome;
        game.state.seen.milestones = old.seen.milestones;
        game.state.totalFish = old.totalFish;
        game.state.taps = old.taps;
        game.recompute();
      }
      persistDisabled = false;
      ui.hideOverlays();
      music.setDucked(false);
      ui.setTab('colony');
      dispatch(events);
      persist(true);
    });
  },
};

// ---------------------------------------------------------------- boot

function boot() {
  fx.init();
  scene.init(document.getElementById('scene'));
  ui = createUi(callbacks);
  applyReduceMotion();
  audio.applySettings(settings);

  dispatch(game.loadState(storage.loadRun()));
  dispatch(game.welcome(Date.now()));
  ui.renderShop(game);

  lastTick = now();
  lastSecond = now();
  setInterval(step, TICK_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persist(true);
      music.setDucked(true);
    } else {
      lastTick = now();
      if (!ui.isOverlayOpen()) music.setDucked(false);
      dispatch(game.welcome(Date.now()));
    }
  });
  window.addEventListener('pagehide', () => persist(true));
  if (window.matchMedia) {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyReduceMotion);
  }

  // The worker is a cache-first precache, which would serve stale files during
  // development, so it is only installed on the deployed site.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !isLocal) {
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadWorker || updateReady) return;
      updateReady = true;
      // A fresh version lands quietly: save, then reload once nothing is open.
      persist(true);
      if (!ui.isOverlayOpen()) location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  } else if ('serviceWorker' in navigator && isLocal) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((reg) => reg.unregister()))
      .catch(() => {});
  }

  if (location.hash === '#debug') {
    window.ps = {
      get game() { return game; },
      get state() { return game.state; },
      get settings() { return settings; },
      give(n) { game.state.fish += n; game.state.lifetimeFish += n; ui.renderShop(game); },
      nextEvent(id) {
        const target = id || 'swarm';
        for (const key of Object.keys(game.state.eventTimers)) game.state.eventTimers[key] = 1e9;
        game.state.eventTimers[target] = 1;
        if (target === 'star') game.state.dayMs = DAY_CYCLE_MS * 0.8;
      },
      setDay(f) { game.state.dayMs = f * DAY_CYCLE_MS; applyPalette(true); },
      migrate() { game.state.lifetimeFish = Math.max(game.state.lifetimeFish, 100000); dispatch(game.migrate()); },
      cheer: () => scene.cheer(),
      buy: (id, qty) => callbacks.onBuy(id, qty || 1),
      buyPearl: (id) => callbacks.onBuyPearl(id),
      tap: () => callbacks.onTap(scene.heroClientPoint().x, scene.heroClientPoint().y),
      tapEvent: () => callbacks.onTapEvent(scene.heroClientPoint().x, scene.heroClientPoint().y),
      tick: (ms) => dispatch(game.tick(ms)),
      resetAll() { persistDisabled = true; storage.resetAll(); location.reload(); },
      ITEM_BY_ID,
    };
    console.log('Penguin Shore debug: window.ps');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
