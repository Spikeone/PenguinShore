# Penguin Shore

A cozy penguin colony that grows with every tap. Built for a phone that sits
open on a desk all day, played with one finger: tap the shore to catch a fish,
spend fish on penguins and buildings, watch the colony fill up, and when it is
big enough, migrate to a new shore and start again with permanent boosts.

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
- **Tired flippers** — a tap is worth less the more you have tapped in the last
  hour: the first tap of a quiet hour pays 100%, the 250th and beyond pay 50%.
  The HUD shows "Taps 72%" while that is in effect. Tapping carries the first
  hour and stays useful, but the colony is what grows.
- **Warm welcome** — opening the app (at most once per ten minutes) gives a
  one-minute x2 boost. Coming back is rewarded, staying away is not.
- **Combo** — taps within a second of each other build a combo. At 20 the tap is
  worth x1.25, at 50 x1.5, at 100 x2. After the window passes the combo settles
  by one every 0.3 s; it is never dropped to zero in one go.
- **Golden fish** — 2% of taps (more with upgrades) catch a golden fish worth
  ten times as much.
- **The shop** — three tabs. *Colony* holds the eight penguin species, each with
  its own fish per second, unlocking at colony sizes 0, 5, 15, 30, 50, 80, 120
  and 200 (the last two also need a later shore). *Buildings* holds thirteen
  buildings that add to the tap, multiply production, or shape the events;
  seven are found on later shores. *Pearls* holds the migration card and the
  permanent upgrades. Cost is `base × growth ^ level`. x1, x10 and Max buy
  several at once. A card that cannot be afforded yet shows how long it will
  take at the current income.
- **Next goals** — the top of the Colony tab shows the three closest milestones
  with progress bars, so there is always something to aim at.
- **Mastery** — owning 25, 50, 100, 200, 400, 800 or 1,600 of a species makes
  every one of them catch half again as much, each tier again. The card shows
  the stars and the next tier; the badge above the species in the scene shows
  them too.
- **Golden penguins** — every penguin bought has a 1.5% chance of being a golden
  one, worth five ordinary ones. They stand at the front of their species.
- **The scene** — every penguin bought stands on the floe (at most ten per
  species and forty in all; a `×27` badge says how many more there are). Each
  building appears once bought and gains detail at levels 5 and 15. A ten
  minute day/night cycle changes the palette; at night the igloo glows and the
  lighthouse beam sweeps.
- **Events** — things that appear and want one tap: a fish swarm (x3 for 15 s
  plus a burst), a seal (burst), an egg in the snow nest (a chick that grows
  into a free Adelie), a shooting star at night (x2 for a minute), a gift crate
  (a cosmetic), a whale (a big burst). Missing one costs nothing.
- **Milestones** — 51 goals (colony sizes, fish totals, combos, first of each
  species, mastery, golden penguins, shores, visitors). Rewards are a fish
  burst, a cosmetic for a random penguin, or Pearls. Tapping a penguin cycles
  the accessory it wears.
- **Migration** — every shore asks for more fish than the last: 1M for the
  first, then five times as much each time. From that point the Pearls tab
  offers to migrate. Pearls earned = `4 × sqrt(fish this colony / target)`
  plus two per shore already seen, so staying longer earns more and later
  shores pay more. Fish, penguins and buildings reset; Pearls, Pearl upgrades,
  cosmetics, milestones and golden penguins found stay. Each migration opens
  the next of eight shores (Ice shelf, Rocky coast, Aurora night, Sunrise
  lagoon, Volcanic isle, Drift ice, Kelp bay, Crystal cove, then around again
  as "lap 2") and adds a flat +25% production. Pearls buy eleven permanent
  upgrades with up to ten levels each.
- **Collection** — the book icon shows every species, cosmetic, shore and
  visitor found so far, plus all milestones.
- **Settings** — effects and music volume, mute, reduce motion, the colony's
  numbers, and a two-tap *Start over* that keeps Pearls unless the checkbox
  says otherwise.

Deliberately absent: offline earnings, expiring timers, hunger meters, login
streaks, screen shake, forced tutorials.

### Pacing

`tools` has no balancing script, but the economy was tuned with a simulated
player who checks in every eight minutes for eight hours a day, taps a short
burst, and buys whatever pays back fastest. That player reaches the first
migration after about two play-hours, the fourth after thirteen, the sixth
after thirty, and each shore takes roughly half again as long as the one
before. A keener player is faster; the shape stays the same.

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
| `js/config.js` | every tunable number, the shop, species, shores, events, milestones, pearl tree, and the UI strings |
| `js/game.js` | pure game logic — no DOM, no timers; `tick(ms)` and the inputs return events |
| `js/format.js` | number formatting (1.23K, 45.6M) |
| `js/penguin.js` | the artwork: penguin, golden variant, accessory, building and event SVG as strings |
| `js/scene.js` | the SVG scene: layers, placement, palette, badges, tap effects |
| `js/ui.js`, `js/fx.js` | HUD, shop, goals, overlays, collection, input; floating numbers, toasts, banners |
| `js/main.js` | the 10 Hz clock, visibility gating, event dispatch, saving |
| `js/audio.js`, `js/music.js` | synthesized effects and a soft pentatonic loop |
| `js/storage.js` | guarded localStorage (`penguinshore.run`, `penguinshore.settings`) |
| `css/style.css`, `css/scene.css` | layout and chrome; everything that moves |
| `tools/make-icons.py` | renders the PWA icons with Pillow (run once, output committed) |

`game.js` never touches the DOM and takes its clock from `tick(elapsedMs)`, so
the whole game is testable in node. The save is versioned (`SAVE_VERSION`) and
`normalizeSave` cleans up whatever comes out of storage; older saves are
carried over with their penguins and buildings intact.

## Deploying to GitHub Pages

Live from <https://github.com/Spikeone/PenguinShore>. The repository root is the
site root, so there is no workflow and no build step. Every path in the page is
relative, so the project subpath works.

Enable it once, under **Settings › Pages › Build and deployment**: source
*Deploy from a branch*, branch `main`, folder `/ (root)`. The first build takes
about a minute. On the phone, open the URL and use *Add to home screen*. It
installs as a full-screen app and works offline.

### Release ritual

The service worker precaches everything, so **after every change bump both
`APP_VERSION` in `js/config.js` and `CACHE` in `sw.js` to the same next number**
before committing. `tests/game.test.mjs` fails if the two drift apart. The
version shows at the bottom of the settings screen.

## Credits

All artwork is drawn in code (SVG). Sound effects and music are synthesized at
runtime with the Web Audio API. No third-party assets.
