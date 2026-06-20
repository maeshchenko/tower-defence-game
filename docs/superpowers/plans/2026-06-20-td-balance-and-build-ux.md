# TD Balance & Build-UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the sim-validated balance numbers and the new build-UX into the live game: sharpened tower niches, armor + per-enemy leak, slow-as-aura, targeting priority, a nerfed keep, light economy, and a clear arm→pads→click→auto-select build flow.

**Architecture:** Data-driven balance lives in `TowerTypes.ts` / `EnemyTypes.ts`; the combat math (flat-armor with pierce, slow aura) lives in `Enemy.ts` and `Tower.ts`; `main.ts` wires the new effects, the keep nerf, economy, and the build-UX/HUD. The sim-validated values in `src/sim/config.ts` are the source of truth for every number.

**Tech Stack:** TypeScript, Babylon.js, Vitest. ESM. Run tests with `npx vitest run`.

## Global Constraints

- All balance numbers MUST match `src/sim/config.ts` verbatim (sim-validated). Do not re-invent values.
- Flat-armor model: `effectiveDamage = max(1, raw - max(0, armor - pierce))`. The `max(1, …)` floor applies to **discrete hits only** — never to continuous/aura damage (slow aura deals exactly 0).
- Keep existing FX/sfx call sites working; this plan changes numbers and adds effects, it does not remove juice.
- Russian UI copy stays Russian (match existing strings).
- Do not commit unless the user asks (project rule). Steps end at "verify", not "commit", except where a commit step is explicitly listed — leave those for the user to run.

---

## File Structure

- `src/towers/TowerTypes.ts` — extend `TowerLevel` (`pierce?`, `aura?`), rewrite `TOWER_DEFS` numbers.
- `src/enemies/EnemyTypes.ts` — extend `EnemyDef` (`armor`, `leak`), rewrite `ENEMY_DEFS`.
- `src/enemies/Enemy.ts` — armor in `takeDamage(n, pierce)`, expose `armor`/`leak`/`traveled`.
- `src/towers/Tower.ts` — `pierce` in `ShotResult`, slow-aura branch, targeting modes.
- `src/towers/TowerManager.ts` — sell refund 60%.
- `src/main.ts` — pierce through `damageEnemy`/`applyHit`, slow-aura application, keep nerf, per-enemy leak, wave-clear bonus, build-UX (pads/banner/one-shot/auto-select/cancel), targeting wire-up.
- `src/ui/BuildMenu.ts` — one-shot select, expose armed kind, Shift-hold.
- `src/ui/TowerPanel.ts` — targeting-mode cycle button, show pierce.
- `src/ui/HUD.ts` — build-mode banner.
- Tests: `src/enemies/Enemy.test.ts`, `src/towers/Tower.test.ts` (new).

---

## PHASE A — Balance data & combat model

### Task A1: Enemy armor + leak data

**Files:**
- Modify: `src/enemies/EnemyTypes.ts`

**Interfaces:**
- Produces: `EnemyDef` gains `armor: number` and `leak: number`; `ENEMY_DEFS` updated.

- [ ] **Step 1: Extend the interface and rewrite defs**

Replace the `EnemyDef` interface and `ENEMY_DEFS` in `src/enemies/EnemyTypes.ts` with:

```ts
export interface EnemyDef {
  kind: EnemyKind; hp: number; speed: number; bounty: number
  atk: number; atkRange: number; atkRate: number
  armor: number   // flat damage reduction per hit
  leak: number    // lives lost if this enemy reaches the base
  heal?: { amount: number; range: number; rate: number }
}
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 45, speed: 2.0, bounty: 4, atk: 5, atkRange: 14, atkRate: 0.5, armor: 0, leak: 1 },
  fast: { kind: 'fast', hp: 24, speed: 4.5, bounty: 5, atk: 3, atkRange: 12, atkRate: 0.8, armor: 0, leak: 1 },
  tank: { kind: 'tank', hp: 200, speed: 1.0, bounty: 16, atk: 12, atkRange: 16, atkRate: 0.3, armor: 6, leak: 3 },
  rogue: { kind: 'rogue', hp: 15, speed: 6.0, bounty: 3, atk: 4, atkRange: 10, atkRate: 1.0, armor: 0, leak: 1 },
  brute: { kind: 'brute', hp: 400, speed: 1.3, bounty: 22, atk: 16, atkRange: 14, atkRate: 0.4, armor: 0, leak: 3 },
  healer: { kind: 'healer', hp: 90, speed: 1.8, bounty: 20, atk: 0, atkRange: 0, atkRate: 0, armor: 0, leak: 2, heal: { amount: 8, range: 5, rate: 0.5 } },
  boss: { kind: 'boss', hp: 2600, speed: 0.9, bounty: 140, atk: 25, atkRange: 18, atkRate: 0.4, armor: 6, leak: 8 },
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (a follow-up error in `Enemy.ts` about missing `armor`/`leak` usage is fine until A2; if `tsc` errors only inside `Enemy.ts`/`main.ts` consuming new fields, continue — those are fixed in A2/A5).

### Task A2: Armor in Enemy.takeDamage + expose fields

**Files:**
- Modify: `src/enemies/Enemy.ts`
- Test: `src/enemies/Enemy.test.ts` (create)

**Interfaces:**
- Consumes: `EnemyDef.armor`, `EnemyDef.leak` (Task A1).
- Produces: `Enemy.takeDamage(n: number, pierce?: number)`, getters `armor`, `leak`, `traveled`.

- [ ] **Step 1: Write the failing test**

Create `src/enemies/Enemy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Enemy } from './Enemy'
import { ENEMY_DEFS } from './EnemyTypes'

const path = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]

describe('Enemy armor', () => {
  it('tank (armor 6) takes raw minus armor, floored at 1', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path)
    e.takeDamage(10)            // 10 - 6 = 4
    expect(e.hp).toBe(200 - 4)
    e.takeDamage(2)             // 2 - 6 -> floor 1
    expect(e.hp).toBe(200 - 4 - 1)
  })
  it('pierce ignores armor up to its value', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path)
    e.takeDamage(50, 8)        // pierce 8 > armor 6 -> full 50
    expect(e.hp).toBe(200 - 50)
  })
  it('exposes leak and armor', () => {
    const e = new Enemy(ENEMY_DEFS.boss, path)
    expect(e.leak).toBe(8)
    expect(e.armor).toBe(6)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/enemies/Enemy.test.ts`
Expected: FAIL (takeDamage ignores armor / no `leak` getter).

- [ ] **Step 3: Implement**

In `src/enemies/Enemy.ts`:
- Add fields after `readonly kind`:

```ts
  readonly armor: number
  readonly leak: number
  private _traveled = 0
```
- In the constructor, after the `this.hp = …` line, add:

```ts
    this.armor = def.armor; this.leak = def.leak
```
- Replace `takeDamage`:

```ts
  takeDamage(n: number, pierce = 0) {
    const eff = Math.max(1, n - Math.max(0, this.armor - pierce))
    this.hp = Math.max(0, this.hp - eff)
  }
```
- In `update(dt)`, replace the `this.follower.advance(dt * eff)` line with travel tracking:

```ts
    const before = this.follower.pos
    this.follower.advance(dt * eff)
    this._traveled += Math.hypot(this.follower.pos.x - before.x, this.follower.pos.z - before.z)
```
- Add a getter near the other getters:

```ts
  get traveled(): number { return this._traveled }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/enemies/Enemy.test.ts`
Expected: PASS (3 tests).

### Task A3: Tower numbers + pierce + aura fields

**Files:**
- Modify: `src/towers/TowerTypes.ts`

**Interfaces:**
- Produces: `TowerLevel` gains `pierce?`, `aura?`; `TOWER_DEFS` updated.

- [ ] **Step 1: Rewrite the interface and defs**

Replace `TowerLevel` and `TOWER_DEFS` in `src/towers/TowerTypes.ts`:

```ts
export interface TowerLevel {
  range: number; fireRate: number; damage: number; slow?: number; cost: number
  splashRadius?: number
  chainCount?: number
  chainRange?: number
  pierce?: number   // sniper: ignores this much enemy armor
  aura?: boolean    // slow: persistent field (no projectile, 0 damage)
}
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6.0, fireRate: 1.5, damage: 10, cost: 40 },
    { range: 6.5, fireRate: 1.7, damage: 17, cost: 45 },
    { range: 7.0, fireRate: 1.9, damage: 28, cost: 60 },
  ],
  slow: [
    { range: 3.5, fireRate: 1.0, damage: 0, slow: 0.55, aura: true, cost: 35 },
    { range: 4.5, fireRate: 1.0, damage: 0, slow: 0.45, aura: true, cost: 35 },
    { range: 5.0, fireRate: 1.0, damage: 0, slow: 0.35, aura: true, cost: 45 },
  ],
  sniper: [
    { range: 11.0, fireRate: 0.45, damage: 50, cost: 90, pierce: 4 },
    { range: 12.5, fireRate: 0.50, damage: 80, cost: 85, pierce: 8 },
    { range: 14.0, fireRate: 0.55, damage: 130, cost: 130, pierce: 999 },
  ],
  mortar: [
    { range: 7.0, fireRate: 0.6, damage: 14, splashRadius: 2.4, cost: 75 },
    { range: 7.5, fireRate: 0.7, damage: 20, splashRadius: 2.8, cost: 70 },
    { range: 8.0, fireRate: 0.8, damage: 30, splashRadius: 3.2, cost: 95 },
  ],
  tesla: [
    { range: 5.5, fireRate: 2.2, damage: 6, chainCount: 2, chainRange: 3.0, cost: 60 },
    { range: 6.0, fireRate: 2.5, damage: 9, chainCount: 3, chainRange: 3.2, cost: 55 },
    { range: 6.5, fireRate: 2.8, damage: 12, chainCount: 4, chainRange: 3.5, cost: 80 },
  ],
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS for this file (consumers updated in later tasks).

### Task A4: Slow-as-aura + pierce in Tower

**Files:**
- Modify: `src/towers/Tower.ts`
- Test: `src/towers/Tower.test.ts` (create)

**Interfaces:**
- Consumes: `TowerLevel.aura`, `TowerLevel.pierce` (A3).
- Produces: `ShotResult` gains `pierce?: number` and `aura?: { slow: number; range: number }`. When a tower is an aura tower, `Tower.update` returns `{ aura: { slow, range }, from }` with no projectile fields.

- [ ] **Step 1: Write the failing test**

Create `src/towers/Tower.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Tower } from './Tower'
import { Enemy } from '../enemies/Enemy'
import { ENEMY_DEFS } from '../enemies/EnemyTypes'

const path = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }]
function enemyAt(x: number, kind: keyof typeof ENEMY_DEFS = 'normal') {
  const e = new Enemy(ENEMY_DEFS[kind], path)
  ;(e as any).follower.pos = { x, y: 0, z: 0 }
  return e
}

describe('Tower aura (slow)', () => {
  it('returns an aura effect, not a projectile shot', () => {
    const t = new Tower('slow', { x: 0, y: 0, z: 0 })
    const r = t.update(0.1, [enemyAt(2)])
    expect(r?.aura).toBeTruthy()
    expect(r?.aura?.slow).toBe(0.55)
    expect(r?.damage).toBeUndefined()
  })
})

describe('Tower pierce', () => {
  it('sniper shot carries its pierce value', () => {
    const t = new Tower('sniper', { x: 0, y: 0, z: 0 })
    let r = t.update(10, [enemyAt(3)]) // big dt to clear cooldown + aim
    // may need a second tick once aimed:
    if (!r) r = t.update(10, [enemyAt(3)])
    expect(r?.pierce).toBe(4)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/towers/Tower.test.ts`
Expected: FAIL (`aura`/`pierce` not on `ShotResult`).

- [ ] **Step 3: Implement**

In `src/towers/Tower.ts`:
- Extend `ShotResult`:

```ts
export interface ShotResult {
  target?: Enemy; damage?: number; slow?: number; from: Vec3
  splashRadius?: number; chainCount?: number; chainRange?: number
  pierce?: number
  aura?: { slow: number; range: number }
}
```
- At the very top of `update(dt, enemies)`, before the cooldown logic, add the aura branch:

```ts
  update(dt: number, enemies: Enemy[]): ShotResult | null {
    const s = this.stats
    if (s.aura) { // slow field: no projectile, no aim, applied by the caller each tick
      return { aura: { slow: s.slow ?? 0, range: s.range }, from: this.pos }
    }
    this.cooldown -= dt
    // … existing targeting/aim/fire below …
```
- In the returned shot object at the end of `update`, add `pierce: s.pierce`:

```ts
    return { target, damage: s.damage, slow: s.slow, from: this.pos, splashRadius: s.splashRadius, chainCount: s.chainCount, chainRange: s.chainRange, pierce: s.pierce }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/towers/Tower.test.ts`
Expected: PASS.

### Task A5: Wire pierce + slow-aura + keep nerf + economy in main.ts

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `ShotResult.pierce`/`.aura` (A4), `Enemy.leak`/`takeDamage(n,pierce)` (A2).

- [ ] **Step 1: Thread pierce through damage**

In `src/main.ts`, change `damageEnemy` and `applyHit` signatures to carry pierce:

```ts
function damageEnemy(target: Enemy, damage: number, slow?: number, pierce = 0) {
  if (!views.has(target)) return
  target.takeDamage(damage, pierce)
  // … rest unchanged …
```
Update its splash/chain callers inside `applyHit` to pass pierce:

```ts
function applyHit(target: Enemy, damage: number, slow?: number, aoe?: { splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number }) {
  if (!views.has(target)) return
  sfx.hit()
  const cx = target.pos.x, cz = target.pos.z
  damageEnemy(target, damage, slow, aoe?.pierce)
  if (aoe?.splashRadius) {
    const r2 = aoe.splashRadius * aoe.splashRadius
    burst(scene, 'death', cx, 0.8, cz, new Color3(1, 0.5, 0.2))
    for (const e of [...views.keys()]) {
      if (e === target) continue
      const dx = e.pos.x - cx, dz = e.pos.z - cz
      if (dx * dx + dz * dz <= r2) damageEnemy(e, damage, undefined, aoe.pierce)
    }
  }
  if (aoe?.chainCount && aoe.chainRange) {
    const near = [...views.keys()]
      .filter((e) => e !== target && e.alive)
      .map((e) => ({ e, d: Math.hypot(e.pos.x - cx, e.pos.z - cz) }))
      .filter((x) => x.d <= aoe.chainRange!)
      .sort((a, b) => a.d - b.d)
      .slice(0, aoe.chainCount)
    for (const { e } of near) { burst(scene, 'impact', e.pos.x, 1.0, e.pos.z, new Color3(0.7, 0.5, 1)); damageEnemy(e, Math.round(damage * 0.6), undefined, aoe.pierce) }
  }
}
```
Find `fireTowerShot` (the projectile spawner) and where it ultimately calls `applyHit` (lines ~593 and ~605): include `pierce` in the `aoe` object it passes, e.g. `applyHit(p.target, p.damage, p.slow, { splashRadius: p.splashRadius, pierce: p.pierce })`. Add `pierce?: number` to the `Projectile` interface (line ~405) and to `fireTowerShot`'s params, threading `shot.pierce` from the call sites at lines ~805/807.

- [ ] **Step 2: Apply slow auras + handle pierce in the tower-shot loop**

In the `for (const shot of tm.update(dt, wm.active))` loop (line ~792), handle aura shots first and pass pierce to the cannon/sniper branch:

```ts
    for (const shot of tm.update(dt, wm.active)) {
      if (shot.aura) { // slow field: slow every enemy in range this tick, no projectile
        for (const e of wm.active) {
          if (e.alive && Math.hypot(e.pos.x - shot.from.x, e.pos.z - shot.from.z) <= shot.aura.range) e.applySlow(shot.aura.slow, 0.3)
        }
        continue
      }
      const firing = [...towerViews.keys()].find((t) => t.pos === shot.from)
      const kind = firing?.kind ?? 'cannon'
      if (kind === 'tesla') {
        sfx.shoot()
        zap(shot.from, shot.target!.pos, SHOT_FX.tesla, 1.4)
        damageEnemy(shot.target!, shot.damage!)
        let prev = { x: shot.target!.pos.x, z: shot.target!.pos.z }
        for (const e of chainTargets(shot.target!.pos, shot.chainCount ?? 0, shot.chainRange ?? 0, shot.target!)) {
          zap(prev, e.pos, SHOT_FX.tesla, 1.2); damageEnemy(e, Math.round(shot.damage! * 0.6)); prev = { x: e.pos.x, z: e.pos.z }
        }
      } else if (kind === 'mortar') {
        fireTowerShot(shot.from, shot.target!, kind, shot.damage!, shot.slow, shot.splashRadius, undefined, undefined, true, shot.pierce)
      } else {
        fireTowerShot(shot.from, shot.target!, kind, shot.damage!, shot.slow, shot.splashRadius, shot.chainCount, shot.chainRange, false, shot.pierce)
      }
      if (firing) towerViews.get(firing)?.kickback()
    }
```
(Add a trailing `pierce?: number` parameter to `fireTowerShot`; store it on the spawned projectile so the eventual `applyHit` passes it.)

> NOTE: the slow tower no longer produces a projectile/`TowerView` barrel rotation. Its existing `TowerView` is fine (static). No aim needed.

- [ ] **Step 3: Nerf the keep + per-enemy leak + wave-clear bonus**

- Change the keep constants (line ~667):

```ts
const BASE_RANGE = 6, BASE_DMG = 5, BASE_RATE = 1 // keep: short last-ditch line (was 12/8)
```
- Per-enemy leak (line ~781): replace `state.damageBase(1)` with `state.damageBase(e.leak)`:

```ts
      if (e.reachedBase) { state.damageBase(e.leak); shake.addTrauma(0.5); hitstop.trigger(80); removeHealthBar(e); const rv = views.get(e); if (rv) { env.removeShadowCaster(rv.mesh); rv.dispose() } views.delete(e); wm.remove(e); continue }
```
- Wave-clear bonus (line ~824): replace `20 + state.wave * 5` with `15 + state.wave * 3`:

```ts
      state.addGold(15 + state.wave * 3); state.endWave()
```

- [ ] **Step 4: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. tsc clean; all tests green.

- [ ] **Step 5: Manual smoke (run the app)**

Run: `npm run dev`, open the game. Verify: a slow tower visibly slows enemies in a radius (no projectiles from it); a sniper damages a tank for ~full (pierce); enemies that leak remove the expected lives (boss = 8); the keep only fires at very close range.

### Task A6: Sell refund 60%

**Files:**
- Modify: `src/towers/TowerManager.ts`

- [ ] **Step 1: Change the refund factor**

In `src/towers/TowerManager.ts`, replace both `* 0.5` occurrences (in `sellValue` and `sell`) with `* 0.6`:

```ts
  sellValue(t: Tower): number { return Math.floor((this.spent.get(t) ?? 0) * 0.6) }
  sell(t: Tower): void {
    const refund = Math.floor((this.spent.get(t) ?? 0) * 0.6)
    // … rest unchanged …
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

---

## PHASE B — Targeting priority

### Task B1: Target modes in Tower

**Files:**
- Modify: `src/towers/Tower.ts`
- Test: `src/towers/Tower.test.ts` (extend)

**Interfaces:**
- Consumes: `Enemy.traveled`, `Enemy.hp` (A2).
- Produces: `Tower.targetMode: TargetMode`, `Tower.cycleTargetMode()`, type `TargetMode = 'first' | 'last' | 'strong' | 'weak'`. Default `'first'`.

- [ ] **Step 1: Write the failing test**

Append to `src/towers/Tower.test.ts`:

```ts
import { Tower as T2 } from './Tower'
describe('Tower targeting modes', () => {
  function inRange(x: number, hp: number, traveled: number) {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    ;(e as any).follower.pos = { x, y: 0, z: 0 }
    ;(e as any)._traveled = traveled
    ;(e as any).hp = hp
    return e
  }
  it('first = furthest along the path', () => {
    const t = new T2('cannon', { x: 0, y: 0, z: 0 })
    const a = inRange(1, 30, 5), b = inRange(2, 30, 9)
    const r = t.update(10, [a, b]) ?? t.update(10, [a, b])
    expect(r?.target).toBe(b)
  })
  it('weak = lowest hp', () => {
    const t = new T2('cannon', { x: 0, y: 0, z: 0 })
    t.targetMode = 'weak'
    const a = inRange(1, 30, 5), b = inRange(2, 8, 9)
    const r = t.update(10, [a, b]) ?? t.update(10, [a, b])
    expect(r?.target).toBe(b)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/towers/Tower.test.ts`
Expected: FAIL (no `targetMode`; targeting currently `enemies.find`).

- [ ] **Step 3: Implement**

In `src/towers/Tower.ts`:
- Add the type near the top: `export type TargetMode = 'first' | 'last' | 'strong' | 'weak'`
- Add field + cycle on the class:

```ts
  targetMode: TargetMode = 'first'
  cycleTargetMode() {
    const order: TargetMode[] = ['first', 'last', 'strong', 'weak']
    this.targetMode = order[(order.indexOf(this.targetMode) + 1) % order.length]
  }
```
- Replace the target selection line (`const target = enemies.find(...)`) with a mode-aware pick:

```ts
    const inRange = enemies.filter((e) => e.alive && dist(e.pos, this.pos) <= s.range)
    let target: Enemy | undefined
    for (const e of inRange) {
      if (!target) { target = e; continue }
      const better =
        this.targetMode === 'first' ? e.traveled > target.traveled :
        this.targetMode === 'last' ? e.traveled < target.traveled :
        this.targetMode === 'strong' ? e.hp > target.hp :
        e.hp < target.hp
      if (better) target = e
    }
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/towers/Tower.test.ts`
Expected: PASS.

### Task B2: Targeting cycle button in TowerPanel + wire-up

**Files:**
- Modify: `src/ui/TowerPanel.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `Tower.targetMode`, `Tower.cycleTargetMode()` (B1).
- Produces: `TowerPanel.show(info, onUpgrade, onSell, onCycleTarget)`; `TowerInfo` gains `targetMode: string`.

- [ ] **Step 1: Add the field + button to TowerPanel**

In `src/ui/TowerPanel.ts`:
- Add `targetMode: string` to the `TowerInfo` interface.
- Add a member `private targetBtn!: HTMLButtonElement` and `private onCycle: (() => void) | null = null`.
- In `mount()`, after building the up/sell row, add a full-width targeting button:

```ts
    this.targetBtn = this.mkBtn('Цель: —', '#1b2733', '#9cf')
    this.targetBtn.style.width = '100%'; this.targetBtn.style.marginTop = '6px'
    this.targetBtn.onclick = () => this.onCycle?.()
    this.root.appendChild(this.targetBtn)
```
- Change `show(...)` signature to `show(info: TowerInfo, onUpgrade, onSell, onCycleTarget: () => void)`, set `this.onCycle = onCycleTarget`, and render the label. Map mode → Russian:

```ts
    const MODE: Record<string, string> = { first: 'первый', last: 'последний', strong: 'сильный', weak: 'слабый' }
    this.targetBtn.textContent = `Цель: ${MODE[info.targetMode] ?? info.targetMode}`
```
- In `hide()`, also `this.onCycle = null`.

- [ ] **Step 2: Wire it in main.ts**

In `src/main.ts` `refreshTowerPanel()` (line ~700), pass `targetMode` in the info object and add the cycle callback that flips the mode and re-renders:

```ts
  towerPanel.show(
    { kind: t.kind, level: t.level, maxLevel: t.maxLevel, damage: s.damage, range: s.range, fireRate: s.fireRate, slow: s.slow, upgradeCost, sellValue: tm.sellValue(t), targetMode: t.targetMode },
    /* onUpgrade */ () => { /* existing upgrade body */ },
    /* onSell */ () => { /* existing sell body */ },
    /* onCycleTarget */ () => { t.cycleTargetMode(); refreshTowerPanel() },
  )
```
(Keep the existing onUpgrade/onSell bodies; only add the 4th argument and the `targetMode` field.)

- [ ] **Step 3: Typecheck + suite + manual**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.
Manual: `npm run dev` → select a tower → "Цель:" button cycles первый→последний→сильный→слабый and the tower visibly retargets.

---

## PHASE C — Build UX

### Task C1: One-shot build select + expose armed kind

**Files:**
- Modify: `src/ui/BuildMenu.ts`

**Interfaces:**
- Produces: `BuildMenu.armed: TowerKind | null`; `BuildMenu.disarm(): void`; constructor unchanged. `onSelect` still fires on click.

- [ ] **Step 1: Add armed getter + disarm + keep render**

In `src/ui/BuildMenu.ts`:
- Add a public getter and a disarm method:

```ts
  get armed(): TowerKind | null { return this.selected }
  disarm() { this.selected = null; this.onSelect(null); this.render() }
```
(The button `onclick` toggle stays as is — clicking the same button still un-arms.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task C2: Build pads always-visible + glow when armed

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `level.cells`, `BuildMenu.armed`.
- Produces: `updatePadVisuals()` called when the armed kind changes and after build/sell.

- [ ] **Step 1: Create a faint pad disc per empty cell**

In `src/main.ts`, after the level/towers are created, add a pad layer. Use thin Babylon discs (or reuse the existing ground-decal/ring helper if one exists). Minimal version with `MeshBuilder.CreateDisc`:

```ts
// build pads: a faint disc on every cell; brightens when a build kind is armed
const padMat = new StandardMaterial('padMat', scene)
padMat.emissiveColor = new Color3(0.25, 0.5, 0.7); padMat.alpha = 0.18; padMat.disableLighting = true
const padMatArmed = padMat.clone('padMatArmed'); padMatArmed.alpha = 0.5; padMatArmed.emissiveColor = new Color3(0.4, 0.85, 1)
const pads = new Map<string, Mesh>()
for (const c of level.cells) {
  const d = MeshBuilder.CreateDisc(`pad-${c.id}`, { radius: 1.1, tessellation: 24 }, scene)
  d.rotation.x = Math.PI / 2; d.position.set(c.pos.x, 0.06, c.pos.z); d.isPickable = false; d.material = padMat
  pads.set(c.id, d)
}
function updatePadVisuals() {
  const armed = buildMenu.armed != null
  for (const c of level.cells) {
    const m = pads.get(c.id); if (!m) continue
    m.setEnabled(!c.occupied)               // hide a pad once a tower sits on it
    m.material = armed ? padMatArmed : padMat
  }
}
updatePadVisuals()
```
(Use the existing imports for `MeshBuilder`, `StandardMaterial`, `Color3`, `Mesh`; add any missing to the top-of-file Babylon import.)

- [ ] **Step 2: Refresh pads when the armed kind changes**

In the `BuildMenu` construction callback (line ~235), call `updatePadVisuals()`:

```ts
const buildMenu = new BuildMenu((k) => { selectedKind = k; deselectTower(); updatePadVisuals() }, { /* costs unchanged */ })
```

- [ ] **Step 3: Manual verify**

Run: `npm run dev` → in top-down build view, faint discs sit on every empty cell; arming a tower brightens them; occupied cells show no disc.

### Task C3: Build flow — auto-select new tower, one-shot disarm, cancel

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `selectTower`, `tm.build`, `buildMenu.disarm()` (C1), `updatePadVisuals` (C2).

- [ ] **Step 1: Auto-select + one-shot in onPointerDown**

In `src/main.ts` `scene.onPointerDown` (line ~748), update the build branch to select the new tower and disarm (unless Shift is held):

```ts
scene.onPointerDown = (evt, pick) => {
  if (rig.mode !== 'top' || over) return
  if (!pick?.pickedPoint) return
  const clicked = towerAt(pick)
  if (clicked) { selectTower(clicked); return }
  if (selectedKind) {
    const cell = level.cellAt(pick.pickedPoint.x, pick.pickedPoint.z, 2)
    if (!cell) { deselectTower(); return }
    if (cell.occupied) { flash('Клетка занята'); sfx.deny(); return }
    const t = tm.build(selectedKind, cell)
    if (t) {
      towerViews.set(t, new TowerView(scene, assets, t, towerHooks)); sfx.build()
      selectTower(t)                         // focus jumps to the new tower (fixes the old bug)
      if (!(evt as PointerEvent)?.shiftKey) { selectedKind = null; buildMenu.disarm() } // one-shot
      updatePadVisuals()
    } else { flash('Не хватает золота'); sfx.deny() }
    return
  }
  if (selectedTower) { deselectTower(); return }
  heroCtrl.triggerFire()
}
```
(If `evt` is not already the first param, rename the existing `_evt` to `evt`.)

- [ ] **Step 2: Esc / right-click cancels build mode**

In the existing `keydown` handler (line ~680) add an Escape branch:

```ts
  if (e.key === 'Escape') { selectedKind = null; buildMenu.disarm(); deselectTower(); updatePadVisuals() }
```
And cancel on right-click — add near `onPointerDown` setup:

```ts
scene.onPointerObservable.add((info) => {
  if (info.type === PointerEventTypes.POINTERDOWN && (info.event as PointerEvent).button === 2 && selectedKind) {
    selectedKind = null; buildMenu.disarm(); updatePadVisuals()
  }
})
```
(Import `PointerEventTypes` from `@babylonjs/core` if not present. Also ensure `updatePadVisuals()` is called inside `tm.sell` flow / `deselectTower` where cells free up — add a call after a sell completes.)

- [ ] **Step 3: Typecheck + manual**

Run: `npx tsc --noEmit`
Expected: PASS.
Manual: arm cannon → click pad → tower appears, panel opens on it, build-mode disarms (pads dim). Shift-click keeps arming. Esc/right-click cancels.

### Task C4: Build-mode banner in HUD

**Files:**
- Modify: `src/ui/HUD.ts`, `src/main.ts`

**Interfaces:**
- Produces: `HUD.setBuildBanner(text: string | null): void`.

- [ ] **Step 1: Add the banner element + setter to HUD**

In `src/ui/HUD.ts`:
- Add `private buildBanner!: HTMLDivElement`.
- In `mount()`, create it (top-center, under the preview):

```ts
    this.buildBanner = document.createElement('div')
    this.buildBanner.style.cssText = 'position:fixed;top:104px;left:50%;transform:translateX(-50%);' +
      'font-family:monospace;font-size:14px;color:#cfe;z-index:6;display:none;' + PANEL + 'padding:7px 14px;text-align:center'
    document.body.appendChild(this.buildBanner)
```
- Add the setter:

```ts
  setBuildBanner(text: string | null) {
    if (!text) { this.buildBanner.style.display = 'none'; return }
    this.buildBanner.style.display = 'block'
    this.buildBanner.innerHTML = text
  }
```

- [ ] **Step 2: Drive the banner from main.ts**

In `src/main.ts`, build a helper and call it wherever the armed kind changes (the `BuildMenu` callback, after build, on cancel):

```ts
const BUILD_COSTS: Record<TowerKind, number> = { cannon: TOWER_DEFS.cannon[0].cost, slow: TOWER_DEFS.slow[0].cost, sniper: TOWER_DEFS.sniper[0].cost, mortar: TOWER_DEFS.mortar[0].cost, tesla: TOWER_DEFS.tesla[0].cost }
function refreshBuildBanner() {
  const k = buildMenu.armed
  hud.setBuildBanner(k ? `СТРОИМ: ${k.toUpperCase()} (${BUILD_COSTS[k]}з) · клик по клетке · ПКМ/Esc отмена · Shift — подряд` : null)
}
```
Call `refreshBuildBanner()` immediately after every `updatePadVisuals()` call added in C2/C3 (arm change, build, cancel).

- [ ] **Step 3: Typecheck + manual**

Run: `npx tsc --noEmit`
Expected: PASS.
Manual: arming a tower shows the banner with its cost; placing/canceling hides it.

---

## PHASE D — Total information (armor readout)

### Task D1: Show enemy armor + sniper pierce

**Files:**
- Modify: `src/main.ts` (enemy health-bar label), `src/ui/TowerPanel.ts`

**Interfaces:**
- Consumes: `Enemy.armor` (A2), `TowerLevel.pierce` (A3).

- [ ] **Step 1: Tag armored enemies**

In `src/main.ts` `updateHealthBar` (around line 478-497), append a small shield tag when `e.armor > 0`. Find where the bar/text is composed and add:

```ts
  // armored enemies show their armor value (total information)
  if (e.armor > 0) label += ` 🛡${e.armor}`
```
(Adapt `label` to the actual variable used in that function; if the health bar is a pure `<div>` width, add a tiny `🛡N` span next to it.)

- [ ] **Step 2: Show pierce in TowerPanel**

In `src/ui/TowerPanel.ts` `show()`, add a pierce line when the kind is sniper (pierce ignores armor). Extend `TowerInfo` with `pierce?: number`, pass it from `main.ts refreshTowerPanel` as `pierce: s.pierce`, and render:

```ts
    const pierce = info.pierce ? `<div>Пробитие брони: <b>${info.pierce >= 999 ? '∞' : info.pierce}</b></div>` : ''
```
Insert `pierce` into the `this.body.innerHTML` template alongside the other stat lines.

- [ ] **Step 3: Typecheck + suite + manual**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.
Manual: tanks/boss show `🛡6`; selecting a sniper shows "Пробитие брони: ∞" at L3.

---

## Final verification

- [ ] **Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (Enemy, Tower, sim, smoke, existing).

- [ ] **Play a full map**

Run: `npm run dev`. Play map 1 end-to-end. Confirm: build flow reads clearly (pads/banner/auto-select/one-shot/cancel), slow towers slow without shooting, snipers shred armor, tesla/mortar feel like swarm tools, the keep no longer carries, leaks cost per-enemy lives, targeting button works.

- [ ] **Optional: re-run the balance sim** (numbers already match config)

Run: `npx vitest run src/sim/report.test.ts --disableConsoleIntercept`
Expected: the documented landscape (mono-slow/tesla/mortar fail late; mixed wins; sniper not most gold-efficient).
