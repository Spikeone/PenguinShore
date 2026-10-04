# Penguin Shore

A cozy penguin colony that grows with every tap. Built for a phone, played with
one finger: tap the shore to catch a fish, spend fish on penguins and buildings,
watch the colony fill up, and when it is big enough, migrate to a new shore and
start again with permanent boosts.

Everything is vanilla ES modules, no build step, no dependencies, no framework,
no image files (the penguins are SVG drawn in code). It is a static site, so
GitHub Pages serves it as is.

## How it plays

- **The tap** — tap anywhere on the scene. The hero penguin dives, a fish flies
  to your finger, and the count goes up. Space or Enter does the same on a
  keyboard. Tapping buttons is the only other input.
- **Fish** — the colony's currency. Penguins catch fish per second while the app
  is open and on screen. Nothing accrues while the app is closed or hidden: a
  single economy tick never credits more than a quarter second, and the clock
  simply does not run while the tab is hidden.
- **Warm welcome** — opening the app (at most once per ten minutes) gives a
  one-minute x2 boost. Coming back is rewarded, staying away is not.
- **Combo** — taps within 1.2 s of each other build a combo. At 10 the tap is
  worth x1.5, at 25 x2, at 50 x3. After the window passes the combo settles by
  one every half second; it is never dropped to zero in one go.
- **Golden fish** — 2% of taps (more with upgrades) catch a golden fish worth
  ten times as much.
- **The shop** — three tabs. *Colony* holds the seven penguin species, each
  with its own fish per second, unlocking at colony sizes 0, 5, 15, 30, 50, 80
  and 120. *Buildings* holds the seven buildings that add to the tap, multiply
  production, or shape the events. *Pearls* holds the migration card and the
  permanent upgrades. Cost is `base × growth ^ level`. x1, x10 and Max buy
  several at once. A card that cannot be afforded yet shows how long it will
  take at the current income.
- **The scene** — every penguin bought stands on the floe (at most ten per
  species and forty in all; a `×27` badge says how many more there are). Each
  building appears once bought and gains detail at levels 5 and 15. A ten
  minute day/night cycle changes the palette; at night the igloo glows and the
  lighthouse beam sweeps.
- **Events** — things that appear and want one tap: a fish swarm (x3 for 15 s
  plus a burst), a seal (burst), an egg in the snow nest (a chick that grows
  into a free Adelie), a shooting star at night (x2 for a minute), a gift crate
  (a cosmetic), a whale (a big burst). Missing one costs nothing.
- **Milestones** — 28 small goals (colony sizes, fish totals, combos, first of
  each species, events). Rewards are a fish burst, a cosmetic for a random
  penguin, or a Pearl. Tapping a penguin cycles the accessory it wears.
- **Migration** — from 100K fish in the current colony the Pearls tab offers to
  migrate. Pearls earned = `floor(sqrt(fish this colony / 20,000))`: 2 at 100K,
  7 at 1M, 22 at 10M. Fish, penguins and buildings reset; Pearls, Pearl
  upgrades, cosmetics and milestones stay. Each migration opens the next shore
  (Ice shelf, Rocky coast, Aurora night, Sunrise lagoon, then around again) and
  adds a flat +25% production. Pearls buy eight permanent upgrades.
- **Settings** — effects and music volume, mute, reduce motion, a view of the
  colony's numbers and milestones, and a two-tap *Start over* that keeps Pearls
  unless the checkbox says otherwise.

Deliberately absent: offline earnings, expiring timers, hunger meters, login
streaks, screen shake, forced tutorials.

## Development

```bash
python serve.py
```

Serves the project at <http://localhost:8082> with `Cache-Control: no-store`,
so edits show up on reload. The same command is wired into
`.claude/launch.json` as `penguinshore-static`. The service worker deliberately
does not install on localhost.

Run the tests (no dependencies, plain `node`):

```bash
node tests/game.test.mjs
```

```bash
node tests/format.test.mjs
```

Append `#debug` to the URL to get `window.ps` in the console: `ps.state`,
`ps.give(n)`, `ps.buy(id, qty)`, `ps.buyPearl(id)`, `ps.nextEvent('swarm')`
(also `seal`, `egg`, `star`, `gift`, `whale`), `ps.setDay(0.8)` for night,
`ps.migrate()`, `ps.cheer()`, `ps.resetAll()`.

### Layout of the code

| File | Responsibility |
|---|---|
| `js/config.js` | every tunable number, the shop, species, biomes, events, milestones, pearl tree, and the UI strings |
| `js/game.js` | pure game logic — no DOM, no timers; `tick(ms)` and the inputs return events |
| `js/format.js` | number formatting (1.23K, 45.6M) |
| `js/penguin.js` | the artwork: penguin, accessory, building and event SVG as strings |
| `js/scene.js` | the SVG scene: layers, placement, palette, tap effects |
| `js/ui.js`, `js/fx.js` | HUD, shop, overlays, input; floating numbers, toasts, banners |
| `js/main.js` | the 10 Hz clock, visibility gating, event dispatch, saving |
| `js/audio.js`, `js/music.js` | synthesized effects and a soft pentatonic loop |
| `js/storage.js` | guarded localStorage (`penguinshore.run`, `penguinshore.settings`) |
| `css/style.css`, `css/scene.css` | layout and chrome; everything that moves |
| `tools/make-icons.py` | renders the PWA icons with Pillow (run once, output committed) |

`game.js` never touches the DOM and takes its clock from `tick(elapsedMs)`, so
the whole game is testable in node. The save is versioned (`SAVE_VERSION`) and
`normalizeSave` cleans up whatever comes out of storage.

## Deploying to GitHub Pages

Not set up yet. When it is time:

1. `git init`, commit, push to a new repository.
2. Under **Settings › Pages › Build and deployment** choose *Deploy from a
   branch*, branch `main`, folder `/ (root)`. Every path in the page is
   relative, so the project subpath works. `.nojekyll` is already there.
3. On the phone, open the URL and use *Add to home screen*. It installs as a
   full-screen app and works offline.

### Release ritual

The service worker precaches everything, so **after every change bump both
`APP_VERSION` in `js/config.js` and `CACHE` in `sw.js` to the same next number**
before committing. `tests/game.test.mjs` fails if the two drift apart. The
version shows at the bottom of the settings screen.

## Credits

All artwork is drawn in code (SVG). Sound effects and music are synthesized at
runtime with the Web Audio API. No third-party assets.
