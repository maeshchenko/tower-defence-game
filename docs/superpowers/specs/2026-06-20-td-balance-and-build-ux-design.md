# TD Balance & Build-UX Redesign — Design

Date: 2026-06-20
Status: approved-pending-review · numbers sim-validated (see §Sim Validation)

## Context & North-Star

The game is a hero-FPS tower defense. A brainstorm pressure-tested an initial
balance proposal ("is this the best possible solution?"). The conclusion:

**Identity = tower-centric (Kingdom Rush model), not hero-centric.** Rationale
(user): maps are small and the hero has zero progression. So the hero stays a
mobile helper, not a carry. This decision **reorders** the whole plan and lets
us cut large amounts of speculative scope.

### What the brainstorm cut (YAGNI / adversarial pass)

- **Hero leveling / abilities / respawn cost** — out of scope. Identity is
  tower-centric.
- **Maximalist enemy mechanics** (separate armored type + shield/regen + flying
  + 5 per-tower ability unlocks) — cut. Small maps + few build cells already
  force specialization; we need *just enough* enemy variety to force 2-3 tower
  types, not a full counter-matrix.
- **Map / cell-placement redesign** — deferred to a later phase. Maps treated as
  fixed (the current 5).
- **Heavy economy rework** — downgraded. Few cells = natural scarcity, so gold
  cannot snowball into "build everything." Only light touches kept.

### What survived (the real levers)

1. **Build UX redesign** — fixes two concrete bugs the user hit.
2. **Tower rebalance** — kill the dominant strategy, sharpen each tower to one
   win-axis. This is the #1 balance lever for a tower-centric, few-cell game.
3. **Minimal enemy variety** — one new mechanic (armor on the tank) + per-enemy
   leak damage + sharpened existing roles.
4. **Targeting priority** — first/last/strongest/weakest. High engagement, cheap.
5. **Light economy** — per-enemy leak, flatter wave-clear bonus, higher sell.

All numbers below are **starting values to tune by playtest**, not final.

---

## 1. Build UX Redesign

### Bugs being fixed
- **Bug A — "not obvious anything is selected".** Armed build-kind is signalled
  only by a thin 2px yellow outline on a menu button plus a hover-only ghost
  range ring (`main.ts:722`). Empty build cells are invisible until hovered.
  Selection is sticky (`BuildMenu.ts:17`), so the player keeps building by
  accident.
- **Bug B — "focus stays on previous tower".** After `tm.build`
  (`main.ts:757-758`) the code builds the tower, makes its view, plays sfx — but
  never calls `selectTower(t)`. Arming a kind also calls `deselectTower()`
  (`main.ts:235`), so the old panel hides and the new one never opens.

### New build flow (best-practice: Kingdom Rush fixed-plot model)
1. **Build pads always faintly visible; brighten + valid cells glow when a kind
   is armed.** Player always knows where towers can go, and instantly sees that
   build-mode is on.
2. **Mode banner while armed:** `СТРОИМ: ПУШКА (50з) · клик по клетке · ПКМ/Esc отмена`.
3. **Click a pad → build AND auto-select the new tower** (`selectTower(t)`), so
   the upgrade/sell panel opens on what you just made (fixes Bug B).
4. **One-shot:** placing disarms the kind (re-click button to build another).
   **Shift-hold** keeps the kind armed for mass-building.
5. **Esc / right-click** cancels build mode at any time.

### Components touched
- `BuildMenu.ts` — one-shot select (clear `selected` after a successful build
  unless Shift held); expose current armed kind.
- `Level` / a new pad-highlight layer in `main.ts` — render all empty cells
  faintly; brighten valid cells while armed.
- `main.ts onPointerDown` — after `tm.build` success call `selectTower(t)` and
  disarm (`buildMenu` clears unless Shift). Add Esc/right-click cancel.
- A banner HUD element (reuse `flash`/HUD styles) shown while a kind is armed.

---

## 2. Tower Rebalance — one win-axis each

Design rule: **no tower has the best DPS-per-gold AND the best range AND the
best alpha.** Each tower wins exactly one axis and is weak somewhere obvious.

| Tower  | Win axis              | Deliberate weakness            |
|--------|-----------------------|--------------------------------|
| cannon | DPS-per-gold (cheap)  | short range, no special        |
| sniper | range + alpha + pierce| poor DPS/gold, overkills swarm |
| tesla  | anti-swarm (chain)    | short range, weak single-target|
| mortar | cluster AoE           | slow shell, whiffs lone fast   |
| slow   | crowd-control utility | ~0 damage                      |

### cannon — efficiency king, short range
```
L1 dmg 10  rate 1.5  range 6.0  cost 40
L2 dmg 17  rate 1.7  range 6.5  cost 45
L3 dmg 28  rate 1.9  range 7.0  cost 60
```
L3 ≈ 53 DPS for 145g cumulative (~0.37 DPS/g) — the efficiency baseline.

### sniper — reach + punch + armor-pierce (NOT efficient)
```
L1 dmg 50  rate 0.45 range 11   cost 80   pierce 4
L2 dmg 80  rate 0.50 range 12.5 cost 75   pierce 8
L3 dmg 130 rate 0.55 range 14   cost 110  pierce ∞ (ignores armor)
```
L3 ≈ 72 DPS for 265g (~0.27 DPS/g) — **below cannon**. Pays for reach (2× cannon),
alpha 130, and armor-pierce. Slow fire = overkill/waste on swarms.
**Range capped at 14 (not 20):** maps are ~30 units across, and a long-range
tower "solves coverage AND DPS" (Doucet) — range 20 would blanket the whole small
map and stay dominant by coverage even with the DPS/gold nerf. Range 14 keeps it
the clear longest-reach tower without seeing the entire path from one cell.

### tesla — anti-swarm, short range, weak single
```
L1 dmg 6   rate 2.2  range 5.5  cost 60   chain 2  chainRange 3.0
L2 dmg 9   rate 2.5  range 6.0  cost 55   chain 3  chainRange 3.2
L3 dmg 12  rate 2.8  range 6.5  cost 80   chain 4  chainRange 3.5
```
Chain stays at 60% damage per jump. Range kept **below cannon's L3 (7.0)** so it
must be positioned into the lane. Great vs clusters, poor vs lone tanks/armor.

### mortar — cluster AoE, slow shell
```
L1 dmg 14  rate 0.6  range 7.0  splash 2.4  cost 75
L2 dmg 20  rate 0.7  range 7.5  splash 2.8  cost 70
L3 dmg 30  rate 0.8  range 8.0  splash 3.2  cost 95
```
Keeps the lobbed/arc shell (already implemented) — travel time means lone fast
enemies slip the blast. Excellent vs bunched waves.

### slow — pure CC utility, persistent aura
The current slow tower is dead weight (2 DPS, 1.5s non-stacking single-target
slow). Redesign to a **persistent slow aura**: every enemy inside the radius is
slowed while present (genre standard — Bloons ice). This is the one non-trivial
tower *behavior* change in scope.
```
L1 radius 3.5 slowFactor 0.55  dmg 1  cost 35
L2 radius 4.5 slowFactor 0.45  dmg 2  cost 35
L3 radius 5  slowFactor 0.35  dmg 3  cost 45   (= 65% slow)
```
Radius kept **small (3.5–5)** on purpose: best-practice (Doucet) is a slow tower
with small AOE used to "paint" enemies at chokepoints, not a map-blanketing field
that trivializes pacing. Implementation: each tick, apply
`applySlow(slowFactor, shortDuration)` to all alive enemies within radius
(re-apply keeps them slowed while inside). Near-zero damage; its value is letting
cannon/tesla/mortar land more shots.

---

## 3. Enemy Variety — minimal (one new mechanic)

No new enemy *types* (keep the roster at 7 — fewer types is better design).
Add the **armor** mechanic to the existing tank, and give every enemy a
**per-enemy leak value** so a boss breach actually hurts.

`takeDamage(n)` becomes `takeDamage(n, pierce=0)`:
`effective = max(1, n - max(0, armor - pierce))`. Splash/chain hits also respect
armor, so tesla's low per-jump damage is heavily taxed — but cannon, sniper,
mortar and the hero all retain a usable answer (see below).

```
kind     hp    spd   bounty  leak   armor
normal   30    2.0   4       1      0
fast     16    4.5   5       1      0
rogue    10    6.0   3       1      0     (swarm)
tank     130   1.0   16      3      6     ← armor: punishes low-per-hit spam
brute    260   1.3   22      3      0     ← raw hp wall; sustained DPS answer
healer   60    1.8   20      2      0
boss     1600  0.9   140     8      6
```
**Armor is NOT lock-and-key.** Best-practice (Doucet) warns against
one-enemy-one-tower. Because armor subtracts a *flat* amount per hit, it punishes
**low-per-hit attackers** (tesla 12→6, rogue-clearing chip damage) but leaves
**many** viable answers: cannon L3 (28→22) still hits hard, sniper pierces it,
mortar's big shells absorb it, and the hero's 25/shot shrugs it off. The player
picks among several counters, not exactly one.

Forcing functions on a small map with few cells:
- **tank (armor 6)** makes tesla/swarm-chip inefficient → reward high-alpha
  (cannon/sniper/mortar/hero), any of which works.
- **rogue swarm** overwhelms single-target → rewards tesla/mortar AoE.
- **brute (raw hp)** rewards sustained DPS / focus fire.
- **healer** must be killed first → motivates targeting priority (§4).

**Total information (Doucet):** surface the exact armor value on enemies (e.g. a
small "🛡6" tag / in an inspect tooltip) and show sniper's pierce in `TowerPanel`,
so countering is a test of thinking, not memorization.

Waves (`mapWaves`) keep their current structure for now (maps are fixed); only
the enemy stats/leak above change. Per-wave "personalities" deferred with maps.

---

## 4. Targeting Priority

Each tower gets a target-selection mode, cycled from `TowerPanel`:
- **first** (closest to base — default), **last** (closest to spawn),
  **strongest** (max current hp), **weakest** (min current hp).

`Tower.update` selects its target by mode instead of `enemies.find(...)`
(which currently just grabs the oldest-spawned in range). `TowerPanel` gains a
small cycle button; the mode is stored per `Tower`.

---

## 5. Economy — light touch

- **Per-enemy leak** (table §3) replaces flat `damageBase(1)`. `main.ts:781`
  passes `e.leak` instead of `1`. Boss breach = 8 of 20 lives.
- **Wave-clear bonus** `20 + wave*5` → `15 + wave*3` (`main.ts:824`). Bounties
  become the primary income; clears stop snowballing.
- **Sell refund** 50% → 60% (`TowerManager.sellValue`/`sell`) — on a tight cell
  budget, encourage repositioning experiments.
- Start gold 100 / 20 lives / early-start 1g/s — unchanged.

---

## Sim Validation & Tuned Numbers (2026-06-20)

A headless 2-D combat sim (`src/sim/`) was built to pre-tune the numbers instead
of guessing. It reuses the real map geometry (`Level.maps`) and runs a faithful
tower-vs-wave loop (no rendering, no hero = tower-centric worst case). It probes:
a **dominance table** (DPS-per-gold per tower) and **map outcomes** for `mono-X`
(only one tower kind — detects a dominant tower) vs `mixed` (skilled play).
Run: `npx vitest run src/sim/report.test.ts --disableConsoleIntercept`.

### What the sim found (real issues, not guesses)
1. **The base keep was a hidden dominant "tower."** At range 12 / 8 dmg it covered
   nearly a whole ~30-unit map and out-carried real towers (even a 0-damage
   slow-only build won flawlessly). → **Nerf the keep to range 6 / 5 dmg** (short
   last-ditch line). *This is a new change beyond the original spec.*
2. **Slow-aura must deal exactly 0 damage.** Any chip damage, spammed across ~24
   cells, blanket-kills everything over the long crawl (degenerate). Slow = pure
   utility.
3. **Implementation note (DoT floor):** the flat-armor formula
   `max(1, raw - armor)` floors at 1 for a *discrete hit* — correct for shots, but
   it must NOT be applied to continuous/aura damage (0 dmg would become 1/tick =
   a huge blanket). Apply the min-1 floor to shots only.
4. **Difficulty was too low** → enemy HP raised ~1.5× (table below).

### Tuned numbers (these supersede the tables above; `src/sim/config.ts` is the
source of truth until written into the game):
```
BASE KEEP:  range 6   damage 5   rate 1.0      (was range 12 / dmg 8)
SLOW dmg:   0 at all levels (pure utility aura)
SNIPER cost: L1 90  L2 85  L3 130             (was 80/75/110 — fewer fielded)
ENEMY HP:   normal 45  fast 24  rogue 15  tank 200
            brute 400  healer 90  boss 2600
```
Everything else (tower dmg/rate/range/pierce, armor 6, leaks, economy) held up.

### Outcome landscape (after tuning)
- `mono-slow` LOSES every map (0-dmg utility can't solo). ✓
- `mono-tesla` / `mono-mortar` LOSE on later maps (specialists can't solo
  armor + boss). ✓
- `mono-cannon` wins but bleeds lives (generalist backbone, suboptimal). ✓
- `mixed` wins all maps losing a few lives (skilled play rewarded). ✓
- Dominance table: cannon most gold-efficient (0.367), sniper pays for
  range+pierce (0.234) — **old sniper dominance is gone.** ✓

### Honest limitation
`mono-cannon` and `mono-sniper` still solo all 5 maps (bleeding lives). On maps
this small with these wave *counts*, any strong damage tower spammed wins —
that's a **map/wave-size** ceiling, not a stat problem, and the fix (bigger
swarms, simultaneous armor+swarm pressure, choke geometry) lives in the deferred
**map redesign** phase. Per best-practice (Doucet / Crush Link), final values
come from **playtest**; these are validated *starting points*, not final.

## Out of Scope (explicit)

- Hero leveling, hero abilities, respawn cost.
- New enemy types; shield/regen; flying/air targeting.
- Per-tower ability unlocks at L3.
- Map geometry / cell-placement redesign; per-wave personalities.

These may become later phases once the tower-centric core is tuned.

---

## Testing

- **Unit:** armor formula (`max(1, n - max(0, armor - pierce))`), per-enemy
  leak applied to `damageBase`, sell refund 60%, slow-aura applies to all
  in-radius enemies, targeting modes pick the correct enemy.
- **Behavioral / playtest:** no single tower clears all of map 1-5 alone;
  tank waves force a sniper; rogue waves force AoE; the build flow (arm → pads
  glow → click → auto-select → disarm) reads clearly. Numbers tuned from here.
- Existing smoke/CameraPresets/Sky tests must stay green.
