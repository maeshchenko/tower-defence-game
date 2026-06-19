# Tower Defence + FPS-герой — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Браузерный 3D tower defence на Babylon.js, где игрок ставит башни сверху и по Tab вселяется в FPS-героя, чтобы помогать отстреливать врагов; защищает базу через 10 волн.

**Architecture:** Одна Babylon-сцена, две камеры (top-down и FPS) переключаются по Tab. Чистая игровая логика (путь, башни, враги, экономика, оружие) отделена от рендера и покрыта Vitest; Babylon-меши — тонкая обёртка над логикой. Враги и башни не знают про камеру/героя — герой для них просто источник урона.

**Tech Stack:** TypeScript, Vite, Babylon.js, Vitest.

## Global Constraints

- Платформа: браузер, полный 3D. Без серверной части.
- Язык: TypeScript (strict). Сборка — Vite. Тесты — Vitest.
- Геометрия — только примитивы Babylon в коде (box, cylinder, capsule, sphere). Внешние 3D-модели запрещены в MVP.
- Babylon — одна сцена `scene`, один движок `engine`. Камеры: top-down + FPS (`UniversalCamera`).
- Чистая логика (`core`, `world/PathFollower`, `towers` targeting, `enemies`, `hero/HeroWeapon` damage-расчёты, экономика) НЕ импортирует Babylon — тестируется без рендера. Координаты в чистой логике — простой тип `Vec3 = { x: number; y: number; z: number }`.
- Враги/башни не ссылаются на камеру. Симуляция всегда реалтайм, тик в одном месте.
- Вне MVP (НЕ реализовывать): мультиплеер, сохранения, звук, A*-pathfinding, несколько карт, утилити-способности героя, мобильное управление, Havok-физика.
- Числовые балансы (HP, урон, золото) — в data-файлах `*Types.ts`, не разбросаны по коду.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html
src/
  main.ts              — bootstrap движка/сцены, регистрация систем, игровой цикл, фазы, win/lose
  core/
    Vec3.ts            — тип Vec3 + чистые хелперы (add, sub, len, dist, lerp, normalize, scale)
    EventBus.ts        — типизированная шина событий
    GameState.ts       — золото, жизни базы, номер волны, фаза; мутаторы + события
  world/
    Level.ts           — данные карты: waypoints пути, список валидных клеток постройки, позиция базы/спавна
    PathFollower.ts     — чистое продвижение точки по waypoints с заданной скоростью
  enemies/
    EnemyTypes.ts      — данные normal/fast/tank (hp, speed, bounty)
    Enemy.ts           — логика одного врага (hp, позиция через PathFollower, урон, смерть)
    EnemyView.ts       — Babylon-меш врага, синк с Enemy
    WaveManager.ts     — расписание 10 волн, спавн по таймеру, проверка «зачищено»
  towers/
    TowerTypes.ts      — данные cannon/slow/sniper + таблица апгрейдов
    Tower.ts           — логика башни: выбор цели в радиусе, кулдаун, выстрел
    Projectile.ts      — логика снаряда/хитскана и нанесения урона
    TowerView.ts       — Babylon-меши башни/снаряда
    TowerManager.ts    — постройка/апгрейд/продажа, валидация клеток, связь с GameState
  hero/
    HeroWeapon.ts      — чистый расчёт урона/кулдауна выстрела (без raycast-рендера)
    HeroState.ts       — hp героя, смерть, респавн-таймер
    HeroController.ts  — FPS-ввод (WASD) + коллизии (Babylon)
  camera/
    CameraRig.ts       — две камеры, Tab-переключение, pointer-lock
  ui/
    HUD.ts             — золото/жизни/волна/hp героя/прицел (DOM overlay)
    BuildMenu.ts       — выбор башни + постановка в top-down
tests/
  ... зеркалит src для чистой логики
```

---

### Task 1: Project scaffold + рендерится пустая сцена

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: рабочие команды `npm run dev`, `npm run build`, `npm test`. Глобальные `engine`/`scene` создаются в `main.ts` (не экспортируются — системы получают `scene` параметром).

- [ ] **Step 1: Init package + deps**

Run:
```bash
npm init -y
npm install @babylonjs/core
npm install -D typescript vite vitest
```

- [ ] **Step 2: Write configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
export default defineConfig({ server: { open: true } })
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true, environment: 'node' } })
```

`index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Tower Defence</title>
    <style>html,body{margin:0;height:100%;overflow:hidden}#app{width:100vw;height:100vh;display:block}</style>
  </head>
  <body><canvas id="app"></canvas><script type="module" src="/src/main.ts"></script></body>
</html>
```

Add to `package.json` scripts:
```json
"scripts": { "dev": "vite", "build": "vite build", "test": "vitest run" }
```

- [ ] **Step 3: Write smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('toolchain', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Write minimal main.ts (engine + scene + ground + render loop)**

`src/main.ts`:
```ts
import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial } from '@babylonjs/core'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)

const cam = new ArcRotateCamera('top', -Math.PI / 2, 0.9, 40, Vector3.Zero(), scene)
cam.attachControl(canvas, true)
new HemisphericLight('light', new Vector3(0, 1, 0), scene)

const ground = MeshBuilder.CreateGround('ground', { width: 30, height: 30 }, scene)
const mat = new StandardMaterial('g', scene)
mat.diffuseColor = new Color3(0.2, 0.5, 0.2)
ground.material = mat

engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
```

- [ ] **Step 6: Verify dev server renders**

Run: `npm run dev`
Expected: браузер открывает зелёную плоскость, камера вращается мышью. Консоль без ошибок.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+TS+Babylon+Vitest, render empty scene"
```

---

### Task 2: Vec3 — чистая математика

**Files:**
- Create: `src/core/Vec3.ts`, `tests/core/Vec3.test.ts`

**Interfaces:**
- Produces:
  - `type Vec3 = { x: number; y: number; z: number }`
  - `add(a: Vec3, b: Vec3): Vec3`
  - `sub(a: Vec3, b: Vec3): Vec3`
  - `scale(a: Vec3, s: number): Vec3`
  - `len(a: Vec3): number`
  - `dist(a: Vec3, b: Vec3): number`
  - `normalize(a: Vec3): Vec3` (нулевой вектор -> {0,0,0})
  - `lerp(a: Vec3, b: Vec3, t: number): Vec3`

- [ ] **Step 1: Write failing tests**

`tests/core/Vec3.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { add, sub, scale, len, dist, normalize, lerp } from '../../src/core/Vec3'

describe('Vec3', () => {
  it('adds and subtracts', () => {
    expect(add({x:1,y:2,z:3},{x:1,y:1,z:1})).toEqual({x:2,y:3,z:4})
    expect(sub({x:1,y:2,z:3},{x:1,y:1,z:1})).toEqual({x:0,y:1,z:2})
  })
  it('scales and measures length', () => {
    expect(scale({x:1,y:0,z:0}, 5)).toEqual({x:5,y:0,z:0})
    expect(len({x:3,y:4,z:0})).toBe(5)
    expect(dist({x:0,y:0,z:0},{x:3,y:4,z:0})).toBe(5)
  })
  it('normalizes, zero stays zero', () => {
    expect(normalize({x:0,y:0,z:0})).toEqual({x:0,y:0,z:0})
    const n = normalize({x:0,y:0,z:2})
    expect(n).toEqual({x:0,y:0,z:1})
  })
  it('lerps', () => {
    expect(lerp({x:0,y:0,z:0},{x:10,y:0,z:0}, 0.5)).toEqual({x:5,y:0,z:0})
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — Run: `npm test` — Expected: cannot find module `Vec3`.

- [ ] **Step 3: Implement**

`src/core/Vec3.ts`:
```ts
export type Vec3 = { x: number; y: number; z: number }
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z })
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z })
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x*s, y: a.y*s, z: a.z*s })
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b))
export const normalize = (a: Vec3): Vec3 => { const l = len(a); return l === 0 ? {x:0,y:0,z:0} : scale(a, 1/l) }
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))
```

- [ ] **Step 4: Run, expect PASS** — Run: `npm test`

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: Vec3 pure math helpers"`

---

### Task 3: EventBus

**Files:**
- Create: `src/core/EventBus.ts`, `tests/core/EventBus.test.ts`

**Interfaces:**
- Produces:
  - `type GameEvents = { enemyKilled: { bounty: number }; baseHit: { remaining: number }; waveCleared: { wave: number }; heroDied: {}; gameOver: { victory: boolean } }`
  - `class EventBus` with `on<K extends keyof GameEvents>(k: K, cb: (p: GameEvents[K]) => void): () => void` (returns unsubscribe) and `emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void`

- [ ] **Step 1: Write failing test**

`tests/core/EventBus.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'

describe('EventBus', () => {
  it('calls subscribers with payload', () => {
    const bus = new EventBus()
    const cb = vi.fn()
    bus.on('enemyKilled', cb)
    bus.emit('enemyKilled', { bounty: 10 })
    expect(cb).toHaveBeenCalledWith({ bounty: 10 })
  })
  it('unsubscribe stops calls', () => {
    const bus = new EventBus()
    const cb = vi.fn()
    const off = bus.on('baseHit', cb)
    off()
    bus.emit('baseHit', { remaining: 5 })
    expect(cb).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/core/EventBus.ts`:
```ts
export type GameEvents = {
  enemyKilled: { bounty: number }
  baseHit: { remaining: number }
  waveCleared: { wave: number }
  heroDied: {}
  gameOver: { victory: boolean }
}
type Handler<K extends keyof GameEvents> = (p: GameEvents[K]) => void

export class EventBus {
  private map: { [K in keyof GameEvents]?: Set<Handler<K>> } = {}
  on<K extends keyof GameEvents>(k: K, cb: Handler<K>): () => void {
    const set = (this.map[k] ??= new Set()) as Set<Handler<K>>
    set.add(cb)
    return () => set.delete(cb)
  }
  emit<K extends keyof GameEvents>(k: K, p: GameEvents[K]): void {
    (this.map[k] as Set<Handler<K>> | undefined)?.forEach((cb) => cb(p))
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: typed EventBus"`

---

### Task 4: GameState — экономика, жизни, фазы

**Files:**
- Create: `src/core/GameState.ts`, `tests/core/GameState.test.ts`

**Interfaces:**
- Consumes: `EventBus`, `GameEvents`.
- Produces:
  - `type Phase = 'build' | 'wave' | 'gameover'`
  - `class GameState` ctor `(bus: EventBus, opts?: { gold?: number; lives?: number; totalWaves?: number })` defaults gold 100, lives 20, totalWaves 10.
  - props (readonly getters): `gold`, `lives`, `wave`, `phase`, `totalWaves`
  - `addGold(n: number): void`
  - `spendGold(n: number): boolean` (false если не хватает, золото не списывается)
  - `damageBase(n: number): void` (clamp >=0; при 0 -> phase 'gameover', emit gameOver{victory:false})
  - `startWave(): void` (phase 'build' -> 'wave', wave += 1)
  - `endWave(): void` (phase 'wave' -> 'build'; если wave >= totalWaves -> phase 'gameover', emit gameOver{victory:true})

- [ ] **Step 1: Write failing tests**

`tests/core/GameState.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { GameState } from '../../src/core/GameState'

const make = (o?: any) => new GameState(new EventBus(), o)

describe('GameState', () => {
  it('defaults', () => {
    const g = make()
    expect(g.gold).toBe(100); expect(g.lives).toBe(20)
    expect(g.wave).toBe(0); expect(g.phase).toBe('build'); expect(g.totalWaves).toBe(10)
  })
  it('spendGold respects balance', () => {
    const g = make({ gold: 50 })
    expect(g.spendGold(60)).toBe(false); expect(g.gold).toBe(50)
    expect(g.spendGold(30)).toBe(true); expect(g.gold).toBe(20)
  })
  it('addGold', () => { const g = make({ gold: 0 }); g.addGold(15); expect(g.gold).toBe(15) })
  it('damageBase to zero ends game as loss', () => {
    const bus = new EventBus(); const over = vi.fn(); bus.on('gameOver', over)
    const g = new GameState(bus, { lives: 1 })
    g.damageBase(5)
    expect(g.lives).toBe(0); expect(g.phase).toBe('gameover')
    expect(over).toHaveBeenCalledWith({ victory: false })
  })
  it('startWave increments wave and sets phase', () => {
    const g = make(); g.startWave()
    expect(g.wave).toBe(1); expect(g.phase).toBe('wave')
  })
  it('endWave on last wave wins', () => {
    const bus = new EventBus(); const over = vi.fn(); bus.on('gameOver', over)
    const g = new GameState(bus, { totalWaves: 1 })
    g.startWave(); g.endWave()
    expect(g.phase).toBe('gameover'); expect(over).toHaveBeenCalledWith({ victory: true })
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/core/GameState.ts`:
```ts
import { EventBus } from './EventBus'
export type Phase = 'build' | 'wave' | 'gameover'

export class GameState {
  private _gold: number
  private _lives: number
  private _wave = 0
  private _phase: Phase = 'build'
  readonly totalWaves: number
  constructor(private bus: EventBus, opts?: { gold?: number; lives?: number; totalWaves?: number }) {
    this._gold = opts?.gold ?? 100
    this._lives = opts?.lives ?? 20
    this.totalWaves = opts?.totalWaves ?? 10
  }
  get gold() { return this._gold }
  get lives() { return this._lives }
  get wave() { return this._wave }
  get phase() { return this._phase }
  addGold(n: number) { this._gold += n }
  spendGold(n: number): boolean {
    if (n > this._gold) return false
    this._gold -= n; return true
  }
  damageBase(n: number) {
    this._lives = Math.max(0, this._lives - n)
    this.bus.emit('baseHit', { remaining: this._lives })
    if (this._lives === 0) { this._phase = 'gameover'; this.bus.emit('gameOver', { victory: false }) }
  }
  startWave() { if (this._phase !== 'gameover') { this._phase = 'wave'; this._wave += 1 } }
  endWave() {
    if (this._phase === 'gameover') return
    if (this._wave >= this.totalWaves) { this._phase = 'gameover'; this.bus.emit('gameOver', { victory: true }) }
    else this._phase = 'build'
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: GameState economy/lives/phases"`

---

### Task 5: Level — путь и клетки

**Files:**
- Create: `src/world/Level.ts`, `tests/world/Level.test.ts`

**Interfaces:**
- Consumes: `Vec3`.
- Produces:
  - `interface BuildCell { id: string; pos: Vec3; occupied: boolean }`
  - `class Level` with `readonly path: Vec3[]` (waypoints, [0]=spawn, [last]=base), `readonly spawn: Vec3`, `readonly base: Vec3`, `readonly cells: BuildCell[]`
  - `cellAt(x: number, z: number, radius?: number): BuildCell | undefined` (ближайшая клетка в пределах radius, default 1.0)
  - `static demo(): Level` — захардкоженный уровень: L-образный путь, ~8 клеток вдоль дороги.

- [ ] **Step 1: Write failing tests**

`tests/world/Level.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { Level } from '../../src/world/Level'

describe('Level.demo', () => {
  const lvl = Level.demo()
  it('path starts at spawn ends at base', () => {
    expect(lvl.path[0]).toEqual(lvl.spawn)
    expect(lvl.path[lvl.path.length - 1]).toEqual(lvl.base)
    expect(lvl.path.length).toBeGreaterThanOrEqual(3)
  })
  it('has build cells, none occupied initially', () => {
    expect(lvl.cells.length).toBeGreaterThanOrEqual(6)
    expect(lvl.cells.every(c => !c.occupied)).toBe(true)
  })
  it('cellAt finds nearest within radius', () => {
    const c = lvl.cells[0]
    expect(lvl.cellAt(c.pos.x, c.pos.z)?.id).toBe(c.id)
    expect(lvl.cellAt(999, 999)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/world/Level.ts`:
```ts
import { Vec3, dist } from '../core/Vec3'

export interface BuildCell { id: string; pos: Vec3; occupied: boolean }

export class Level {
  constructor(
    readonly path: Vec3[],
    readonly cells: BuildCell[],
  ) {}
  get spawn(): Vec3 { return this.path[0] }
  get base(): Vec3 { return this.path[this.path.length - 1] }

  cellAt(x: number, z: number, radius = 1.0): BuildCell | undefined {
    let best: BuildCell | undefined
    let bestD = radius
    for (const c of this.cells) {
      const d = dist(c.pos, { x, y: 0, z })
      if (d <= bestD) { bestD = d; best = c }
    }
    return best
  }

  static demo(): Level {
    const y = 0
    const path: Vec3[] = [
      { x: -12, y, z: -12 }, { x: -12, y, z: 6 },
      { x: 6, y, z: 6 }, { x: 6, y, z: 12 },
    ]
    const cellPos: Vec3[] = [
      { x: -9, y, z: -8 }, { x: -15, y, z: -2 }, { x: -9, y, z: 2 },
      { x: -8, y, z: 9 }, { x: 2, y, z: 3 }, { x: 9, y, z: 3 },
      { x: 3, y, z: 9 }, { x: 9, y, z: 9 },
    ]
    const cells = cellPos.map((pos, i) => ({ id: `c${i}`, pos, occupied: false }))
    return new Level(path, cells)
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: Level path + build cells with demo map"`

---

### Task 6: PathFollower — движение по waypoints

**Files:**
- Create: `src/world/PathFollower.ts`, `tests/world/PathFollower.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `dist`, `sub`, `normalize`, `scale`, `add`.
- Produces:
  - `class PathFollower` ctor `(path: Vec3[], speed: number)`
  - `pos: Vec3` (текущая, начинается в path[0])
  - `done: boolean`
  - `advance(dt: number): void` — двигается на speed*dt к следующему waypoint; перескакивает остаток на следующий сегмент; на конце ставит done=true и pos=last.

- [ ] **Step 1: Write failing tests**

`tests/world/PathFollower.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { PathFollower } from '../../src/world/PathFollower'

const straight = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('PathFollower', () => {
  it('moves toward next waypoint', () => {
    const f = new PathFollower(straight, 2)
    f.advance(1) // 2 units
    expect(f.pos.x).toBeCloseTo(2); expect(f.done).toBe(false)
  })
  it('reaches end and clamps', () => {
    const f = new PathFollower(straight, 5)
    f.advance(3) // would be 15 > 10
    expect(f.pos).toEqual({x:10,y:0,z:0}); expect(f.done).toBe(true)
  })
  it('carries remainder across corners', () => {
    const corner = [{x:0,y:0,z:0},{x:0,y:0,z:4},{x:4,y:0,z:4}]
    const f = new PathFollower(corner, 1)
    f.advance(6) // 4 up + 2 right
    expect(f.pos.x).toBeCloseTo(2); expect(f.pos.z).toBeCloseTo(4)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/world/PathFollower.ts`:
```ts
import { Vec3, dist, sub, normalize, scale, add } from '../core/Vec3'

export class PathFollower {
  pos: Vec3
  done = false
  private target = 1
  constructor(private path: Vec3[], private speed: number) {
    this.pos = { ...path[0] }
    if (path.length < 2) this.done = true
  }
  advance(dt: number) {
    if (this.done) return
    let budget = this.speed * dt
    while (budget > 0 && !this.done) {
      const tgt = this.path[this.target]
      const d = dist(this.pos, tgt)
      if (d <= budget) {
        this.pos = { ...tgt }
        budget -= d
        this.target += 1
        if (this.target >= this.path.length) { this.done = true; this.target = this.path.length - 1 }
      } else {
        const dir = normalize(sub(tgt, this.pos))
        this.pos = add(this.pos, scale(dir, budget))
        budget = 0
      }
    }
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: PathFollower waypoint movement"`

---

### Task 7: EnemyTypes + Enemy

**Files:**
- Create: `src/enemies/EnemyTypes.ts`, `src/enemies/Enemy.ts`, `tests/enemies/Enemy.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `PathFollower`.
- Produces:
  - `type EnemyKind = 'normal' | 'fast' | 'tank'`
  - `interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number }`
  - `const ENEMY_DEFS: Record<EnemyKind, EnemyDef>` — normal{hp:30,speed:2,bounty:5}, fast{hp:15,speed:4,bounty:5}, tank{hp:120,speed:1,bounty:15}
  - `class Enemy` ctor `(def: EnemyDef, path: Vec3[])`
    - `hp: number`, `readonly bounty: number`, `readonly kind`, `get pos(): Vec3`, `get alive(): boolean`, `get reachedBase(): boolean`
    - `update(dt: number): void` (двигается по пути)
    - `takeDamage(n: number): void` (clamp hp >= 0)

- [ ] **Step 1: Write failing tests**

`tests/enemies/Enemy.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ENEMY_DEFS } from '../../src/enemies/EnemyTypes'
import { Enemy } from '../../src/enemies/Enemy'

const path = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('Enemy', () => {
  it('starts alive at spawn with def hp', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    expect(e.alive).toBe(true); expect(e.hp).toBe(30); expect(e.pos.x).toBe(0)
  })
  it('moves along path on update', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    e.update(1) // speed 2
    expect(e.pos.x).toBeCloseTo(2)
  })
  it('reaches base at path end', () => {
    const e = new Enemy(ENEMY_DEFS.fast, path) // speed 4
    e.update(3) // 12 > 10
    expect(e.reachedBase).toBe(true)
  })
  it('dies when hp depleted', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    e.takeDamage(30)
    expect(e.hp).toBe(0); expect(e.alive).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/enemies/EnemyTypes.ts`:
```ts
export type EnemyKind = 'normal' | 'fast' | 'tank'
export interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number }
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 30, speed: 2, bounty: 5 },
  fast: { kind: 'fast', hp: 15, speed: 4, bounty: 5 },
  tank: { kind: 'tank', hp: 120, speed: 1, bounty: 15 },
}
```

`src/enemies/Enemy.ts`:
```ts
import { Vec3 } from '../core/Vec3'
import { PathFollower } from '../world/PathFollower'
import { EnemyDef, EnemyKind } from './EnemyTypes'

export class Enemy {
  hp: number
  readonly bounty: number
  readonly kind: EnemyKind
  private follower: PathFollower
  private baseSpeed: number
  constructor(def: EnemyDef, path: Vec3[]) {
    this.hp = def.hp; this.bounty = def.bounty; this.kind = def.kind
    this.baseSpeed = def.speed
    this.follower = new PathFollower(path, def.speed)
  }
  get pos(): Vec3 { return this.follower.pos }
  get alive(): boolean { return this.hp > 0 && !this.follower.done }
  get reachedBase(): boolean { return this.follower.done && this.hp > 0 }
  update(dt: number) { if (this.hp > 0) this.follower.advance(dt) }
  takeDamage(n: number) { this.hp = Math.max(0, this.hp - n) }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: Enemy + enemy defs"`

---

### Task 8: TowerTypes + Tower targeting

**Files:**
- Create: `src/towers/TowerTypes.ts`, `src/towers/Tower.ts`, `tests/towers/Tower.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `dist`, `Enemy`.
- Produces:
  - `type TowerKind = 'cannon' | 'slow' | 'sniper'`
  - `interface TowerLevel { range: number; fireRate: number; damage: number; slow?: number; cost: number }` (fireRate = выстрелов/сек; slow = множитель скорости 0..1; cost = цена постройки этого уровня / апгрейда до него)
  - `const TOWER_DEFS: Record<TowerKind, TowerLevel[]>` (индекс 0 = базовый, до 3 уровней)
  - `interface ShotResult { target: Enemy; damage: number; slow?: number }`
  - `class Tower` ctor `(kind: TowerKind, pos: Vec3)`
    - `get level(): number` (0-based), `get stats(): TowerLevel`, `readonly kind`, `readonly pos`
    - `upgrade(): boolean` (повышает level, false если уже макс)
    - `update(dt: number, enemies: Enemy[]): ShotResult | null` — копит кулдаун; если готов и есть живой враг в range (берёт ближайшего к концу пути = первого в массиве в range), возвращает ShotResult и сбрасывает кулдаун; иначе null.

Targeting rule MVP: из живых врагов в радиусе выбирается первый по порядку в переданном массиве (массив отсортирован по прогрессу пути в WaveManager-слое; для теста — порядок входа).

- [ ] **Step 1: Write failing tests**

`tests/towers/Tower.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { Tower } from '../../src/towers/Tower'
import { Enemy } from '../../src/enemies/Enemy'
import { ENEMY_DEFS } from '../../src/enemies/EnemyTypes'

const at = (x: number) => new Enemy(ENEMY_DEFS.normal, [{x,y:0,z:0},{x:x+100,y:0,z:0}])

describe('Tower', () => {
  it('does not fire before cooldown elapses', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const e = at(1)
    // fireRate of cannon lvl0 assumed 1/sec -> needs dt>=1 from cold start? define: fires immediately when ready
    const first = t.update(0.001, [e])
    expect(first).toBeNull()
  })
  it('fires at in-range enemy when ready', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const e = at(1)
    const shot = t.update(10, [e]) // plenty of time
    expect(shot?.target).toBe(e)
    expect(shot?.damage).toBeGreaterThan(0)
  })
  it('ignores out-of-range enemies', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const far = at(999)
    expect(t.update(10, [far])).toBeNull()
  })
  it('upgrade raises level until max', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const maxIdx = 2
    expect(t.level).toBe(0)
    expect(t.upgrade()).toBe(true)
    while (t.level < maxIdx) t.upgrade()
    expect(t.upgrade()).toBe(false)
  })
  it('slow tower reports slow factor', () => {
    const t = new Tower('slow', {x:0,y:0,z:0})
    const e = at(1)
    const shot = t.update(10, [e])
    expect(shot?.slow).toBeGreaterThan(0)
    expect(shot?.slow).toBeLessThan(1)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/towers/TowerTypes.ts`:
```ts
export type TowerKind = 'cannon' | 'slow' | 'sniper'
export interface TowerLevel { range: number; fireRate: number; damage: number; slow?: number; cost: number }
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6, fireRate: 1.5, damage: 10, cost: 50 },
    { range: 7, fireRate: 1.8, damage: 16, cost: 40 },
    { range: 8, fireRate: 2.0, damage: 24, cost: 60 },
  ],
  slow: [
    { range: 5, fireRate: 1.0, damage: 2, slow: 0.5, cost: 40 },
    { range: 6, fireRate: 1.0, damage: 3, slow: 0.4, cost: 35 },
    { range: 7, fireRate: 1.0, damage: 4, slow: 0.3, cost: 50 },
  ],
  sniper: [
    { range: 14, fireRate: 0.4, damage: 60, cost: 70 },
    { range: 16, fireRate: 0.5, damage: 90, cost: 60 },
    { range: 18, fireRate: 0.6, damage: 130, cost: 90 },
  ],
}
```

`src/towers/Tower.ts`:
```ts
import { Vec3, dist } from '../core/Vec3'
import { Enemy } from '../enemies/Enemy'
import { TowerKind, TowerLevel, TOWER_DEFS } from './TowerTypes'

export interface ShotResult { target: Enemy; damage: number; slow?: number }

export class Tower {
  private lvl = 0
  private cooldown = 0
  constructor(readonly kind: TowerKind, readonly pos: Vec3) {}
  get level() { return this.lvl }
  get stats(): TowerLevel { return TOWER_DEFS[this.kind][this.lvl] }
  get maxLevel() { return TOWER_DEFS[this.kind].length - 1 }
  upgrade(): boolean {
    if (this.lvl >= this.maxLevel) return false
    this.lvl += 1; return true
  }
  update(dt: number, enemies: Enemy[]): ShotResult | null {
    this.cooldown -= dt
    if (this.cooldown > 0) return null
    const s = this.stats
    const target = enemies.find((e) => e.alive && dist(e.pos, this.pos) <= s.range)
    if (!target) return null
    this.cooldown = 1 / s.fireRate
    return { target, damage: s.damage, slow: s.slow }
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: Tower targeting + tower defs"`

---

### Task 9: HeroWeapon — расчёт стрельбы

**Files:**
- Create: `src/hero/HeroWeapon.ts`, `tests/hero/HeroWeapon.test.ts`

**Interfaces:**
- Produces:
  - `class HeroWeapon` ctor `(opts?: { damage?: number; fireRate?: number })` defaults damage 25, fireRate 4 (shots/sec).
  - `tick(dt: number): void` (уменьшает кулдаун)
  - `canFire(): boolean`
  - `fire(): number | null` — если готов: ставит кулдаун, возвращает damage; иначе null. (Куда попал — решает raycast в HeroController; здесь только урон/темп.)

- [ ] **Step 1: Write failing tests**

`tests/hero/HeroWeapon.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { HeroWeapon } from '../../src/hero/HeroWeapon'

describe('HeroWeapon', () => {
  it('fires then needs cooldown', () => {
    const w = new HeroWeapon({ damage: 25, fireRate: 4 })
    expect(w.fire()).toBe(25)
    expect(w.canFire()).toBe(false)
    expect(w.fire()).toBeNull()
  })
  it('recovers after enough time', () => {
    const w = new HeroWeapon({ fireRate: 4 }) // 0.25s cd
    w.fire(); w.tick(0.3)
    expect(w.canFire()).toBe(true)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/hero/HeroWeapon.ts`:
```ts
export class HeroWeapon {
  private damage: number
  private cd: number
  private cooldown = 0
  constructor(opts?: { damage?: number; fireRate?: number }) {
    this.damage = opts?.damage ?? 25
    this.cd = 1 / (opts?.fireRate ?? 4)
  }
  tick(dt: number) { this.cooldown = Math.max(0, this.cooldown - dt) }
  canFire(): boolean { return this.cooldown <= 0 }
  fire(): number | null {
    if (!this.canFire()) return null
    this.cooldown = this.cd
    return this.damage
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: HeroWeapon damage/cooldown"`

---

### Task 10: HeroState — hp, смерть, респавн

**Files:**
- Create: `src/hero/HeroState.ts`, `tests/hero/HeroState.test.ts`

**Interfaces:**
- Consumes: `EventBus`.
- Produces:
  - `class HeroState` ctor `(bus: EventBus, opts?: { maxHp?: number; respawn?: number })` defaults maxHp 100, respawn 5 (sec).
  - `hp`, `get alive(): boolean`, `get respawning(): boolean`
  - `takeDamage(n: number): void` (clamp 0; при 0 -> alive=false, запускает таймер, emit heroDied)
  - `tick(dt: number): void` (если мёртв — крутит таймер; по истечении — respawn: hp=maxHp, alive=true)

- [ ] **Step 1: Write failing tests**

`tests/hero/HeroState.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { HeroState } from '../../src/hero/HeroState'

describe('HeroState', () => {
  it('takes damage and dies, emits heroDied', () => {
    const bus = new EventBus(); const died = vi.fn(); bus.on('heroDied', died)
    const h = new HeroState(bus, { maxHp: 50 })
    h.takeDamage(50)
    expect(h.alive).toBe(false); expect(h.respawning).toBe(true)
    expect(died).toHaveBeenCalled()
  })
  it('respawns after timer', () => {
    const h = new HeroState(new EventBus(), { maxHp: 50, respawn: 3 })
    h.takeDamage(50)
    h.tick(3)
    expect(h.alive).toBe(true); expect(h.hp).toBe(50)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/hero/HeroState.ts`:
```ts
import { EventBus } from '../core/EventBus'
export class HeroState {
  hp: number
  private maxHp: number
  private respawn: number
  private _alive = true
  private timer = 0
  constructor(private bus: EventBus, opts?: { maxHp?: number; respawn?: number }) {
    this.maxHp = opts?.maxHp ?? 100
    this.respawn = opts?.respawn ?? 5
    this.hp = this.maxHp
  }
  get alive() { return this._alive }
  get respawning() { return !this._alive }
  takeDamage(n: number) {
    if (!this._alive) return
    this.hp = Math.max(0, this.hp - n)
    if (this.hp === 0) { this._alive = false; this.timer = this.respawn; this.bus.emit('heroDied', {}) }
  }
  tick(dt: number) {
    if (this._alive) return
    this.timer -= dt
    if (this.timer <= 0) { this._alive = true; this.hp = this.maxHp }
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: HeroState hp/death/respawn"`

---

### Task 11: WaveManager — спавн волн и проверка зачистки

**Files:**
- Create: `src/enemies/WaveManager.ts`, `tests/enemies/WaveManager.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `Enemy`, `ENEMY_DEFS`, `EnemyKind`.
- Produces:
  - `interface WaveEntry { kind: EnemyKind; count: number; interval: number }` (interval — сек между спавнами внутри группы)
  - `class WaveManager` ctor `(path: Vec3[], waves: WaveEntry[][])` (внешний массив = волны; внутренний = группы в волне)
  - `get active(): Enemy[]`
  - `startWave(index: number): void` (заряжает очередь спавна для волны index)
  - `update(dt: number): Enemy[]` — продвигает таймер спавна, добавляет новых врагов в active, возвращает массив только что заспавненных
  - `get spawning(): boolean` (ещё есть в очереди на спавн)
  - `cleared(): boolean` (не spawning И все active мертвы/ушли — но удаление мёртвых делает внешний слой; здесь: !spawning && active.length === 0)
  - `remove(e: Enemy): void` (убрать из active)
  - `static demoWaves(): WaveEntry[][]` — 10 волн нарастающей силы.

- [ ] **Step 1: Write failing tests**

`tests/enemies/WaveManager.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { WaveManager } from '../../src/enemies/WaveManager'

const path = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('WaveManager', () => {
  it('spawns enemies over time', () => {
    const wm = new WaveManager(path, [[{ kind: 'normal', count: 2, interval: 1 }]])
    wm.startWave(0)
    let spawned = wm.update(0.01) // first spawns immediately
    expect(spawned.length).toBe(1)
    expect(wm.active.length).toBe(1)
    wm.update(0.5) // not yet
    expect(wm.active.length).toBe(1)
    wm.update(0.6) // crosses interval
    expect(wm.active.length).toBe(2)
    expect(wm.spawning).toBe(false)
  })
  it('cleared only after spawning done and active empty', () => {
    const wm = new WaveManager(path, [[{ kind: 'normal', count: 1, interval: 1 }]])
    wm.startWave(0)
    wm.update(0.01)
    expect(wm.cleared()).toBe(false)
    wm.remove(wm.active[0])
    expect(wm.cleared()).toBe(true)
  })
  it('demoWaves has 10 waves', () => {
    expect(WaveManager.demoWaves().length).toBe(10)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/enemies/WaveManager.ts`:
```ts
import { Vec3 } from '../core/Vec3'
import { Enemy } from './Enemy'
import { ENEMY_DEFS, EnemyKind } from './EnemyTypes'

export interface WaveEntry { kind: EnemyKind; count: number; interval: number }
interface Pending { kind: EnemyKind; interval: number; remaining: number; timer: number }

export class WaveManager {
  private _active: Enemy[] = []
  private queue: Pending[] = []
  constructor(private path: Vec3[], private waves: WaveEntry[][]) {}
  get active() { return this._active }
  get spawning() { return this.queue.length > 0 }

  startWave(index: number) {
    const w = this.waves[index] ?? []
    this.queue = w.map((g) => ({ kind: g.kind, interval: g.interval, remaining: g.count, timer: 0 }))
  }
  update(dt: number): Enemy[] {
    const spawned: Enemy[] = []
    for (const g of this.queue) {
      g.timer -= dt
      while (g.remaining > 0 && g.timer <= 0) {
        const e = new Enemy(ENEMY_DEFS[g.kind], this.path)
        this._active.push(e); spawned.push(e)
        g.remaining -= 1
        g.timer += g.interval
      }
    }
    this.queue = this.queue.filter((g) => g.remaining > 0)
    return spawned
  }
  remove(e: Enemy) { this._active = this._active.filter((x) => x !== e) }
  cleared(): boolean { return !this.spawning && this._active.length === 0 }

  static demoWaves(): WaveEntry[][] {
    const w: WaveEntry[][] = []
    for (let i = 0; i < 10; i++) {
      const groups: WaveEntry[] = [{ kind: 'normal', count: 4 + i * 2, interval: 0.8 }]
      if (i >= 2) groups.push({ kind: 'fast', count: 2 + i, interval: 0.5 })
      if (i >= 4) groups.push({ kind: 'tank', count: Math.floor(i / 2), interval: 1.5 })
      w.push(groups)
    }
    return w
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: WaveManager spawn + demo waves"`

---

### Task 12: TowerManager — постройка/апгрейд/продажа

**Files:**
- Create: `src/towers/TowerManager.ts`, `tests/towers/TowerManager.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Level`, `BuildCell`, `Tower`, `TowerKind`, `TOWER_DEFS`, `Enemy`, `ShotResult`.
- Produces:
  - `class TowerManager` ctor `(state: GameState, level: Level)`
  - `get towers(): Tower[]`
  - `build(kind: TowerKind, cell: BuildCell): Tower | null` — проверяет !occupied и хватает ли золота (cost уровня 0); списывает, помечает cell.occupied=true, создаёт Tower на cell.pos; иначе null.
  - `upgrade(t: Tower): boolean` — следующий уровень существует и хватает золота (cost след. уровня); списывает, апгрейдит; иначе false.
  - `sell(t: Tower): void` — возврат 50% суммарной стоимости, удаляет башню, освобождает клетку.
  - `update(dt: number, enemies: Enemy[]): ShotResult[]` — тикает все башни, собирает выстрелы (без применения урона — это делает main, чтобы знать про золото/смерти).

- [ ] **Step 1: Write failing tests**

`tests/towers/TowerManager.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { GameState } from '../../src/core/GameState'
import { Level } from '../../src/world/Level'
import { TowerManager } from '../../src/towers/TowerManager'

const setup = (gold = 200) => {
  const state = new GameState(new EventBus(), { gold })
  const level = Level.demo()
  return { state, level, tm: new TowerManager(state, level) }
}

describe('TowerManager', () => {
  it('builds on free cell, spends gold, occupies cell', () => {
    const { state, level, tm } = setup()
    const cell = level.cells[0]
    const t = tm.build('cannon', cell)
    expect(t).not.toBeNull()
    expect(cell.occupied).toBe(true)
    expect(state.gold).toBe(150) // 200 - 50
    expect(tm.towers.length).toBe(1)
  })
  it('refuses build on occupied cell', () => {
    const { level, tm } = setup()
    const cell = level.cells[0]
    tm.build('cannon', cell)
    expect(tm.build('sniper', cell)).toBeNull()
  })
  it('refuses build without gold', () => {
    const { level, tm } = setup(10)
    expect(tm.build('cannon', level.cells[0])).toBeNull()
  })
  it('upgrade spends next-level cost', () => {
    const { state, level, tm } = setup()
    const t = tm.build('cannon', level.cells[0])!
    const before = state.gold
    expect(tm.upgrade(t)).toBe(true)
    expect(t.level).toBe(1)
    expect(state.gold).toBe(before - 40)
  })
  it('sell refunds and frees cell', () => {
    const { state, level, tm } = setup()
    const cell = level.cells[0]
    const t = tm.build('cannon', cell)!
    const goldAfterBuild = state.gold
    tm.sell(t)
    expect(cell.occupied).toBe(false)
    expect(tm.towers.length).toBe(0)
    expect(state.gold).toBe(goldAfterBuild + 25) // 50% of 50
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

`src/towers/TowerManager.ts`:
```ts
import { GameState } from '../core/GameState'
import { Level, BuildCell } from '../world/Level'
import { Enemy } from '../enemies/Enemy'
import { Tower, ShotResult } from './Tower'
import { TowerKind, TOWER_DEFS } from './TowerTypes'

export class TowerManager {
  private _towers: Tower[] = []
  private cellOf = new Map<Tower, BuildCell>()
  private spent = new Map<Tower, number>()
  constructor(private state: GameState, private level: Level) {}
  get towers() { return this._towers }

  build(kind: TowerKind, cell: BuildCell): Tower | null {
    if (cell.occupied) return null
    const cost = TOWER_DEFS[kind][0].cost
    if (!this.state.spendGold(cost)) return null
    const t = new Tower(kind, cell.pos)
    cell.occupied = true
    this._towers.push(t)
    this.cellOf.set(t, cell)
    this.spent.set(t, cost)
    return t
  }
  upgrade(t: Tower): boolean {
    const defs = TOWER_DEFS[t.kind]
    const next = t.level + 1
    if (next >= defs.length) return false
    const cost = defs[next].cost
    if (!this.state.spendGold(cost)) return false
    t.upgrade()
    this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
    return true
  }
  sell(t: Tower): void {
    const refund = Math.floor((this.spent.get(t) ?? 0) * 0.5)
    this.state.addGold(refund)
    const cell = this.cellOf.get(t)
    if (cell) cell.occupied = false
    this._towers = this._towers.filter((x) => x !== t)
    this.cellOf.delete(t); this.spent.delete(t)
  }
  update(dt: number, enemies: Enemy[]): ShotResult[] {
    const shots: ShotResult[] = []
    for (const t of this._towers) {
      const s = t.update(dt, enemies)
      if (s) shots.push(s)
    }
    return shots
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat: TowerManager build/upgrade/sell"`

---

### Task 13: EnemyView + TowerView — Babylon-меши (ручная проверка)

**Files:**
- Create: `src/enemies/EnemyView.ts`, `src/towers/TowerView.ts`

**Interfaces:**
- Consumes: `Scene`, `Enemy`, `Tower`, `Vec3`.
- Produces:
  - `class EnemyView` ctor `(scene: Scene, enemy: Enemy)` — создаёт меш по kind (normal=капсула серая, fast=мелкая капсула жёлтая, tank=большой бокс красный). `sync(): void` ставит mesh.position из enemy.pos и масштаб hp-бара (опц). `dispose(): void`.
  - `class TowerView` ctor `(scene: Scene, tower: Tower)` — цилиндр+«дуло» по kind (cannon серый, slow синий, sniper тёмный длинный). `sync(): void` (для апгрейда — поднять/раскрасить). `dispose(): void`.

Чистой логики нет — тестируется в Task 18 визуально. Меши только читают логику.

- [ ] **Step 1: Implement EnemyView**

`src/enemies/EnemyView.ts`:
```ts
import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import { Enemy } from './Enemy'

const STYLE = {
  normal: { color: new Color3(0.7,0.7,0.7), h: 1.6, d: 0.8 },
  fast: { color: new Color3(0.9,0.85,0.2), h: 1.1, d: 0.6 },
  tank: { color: new Color3(0.8,0.2,0.2), h: 1.8, d: 1.4 },
}

export class EnemyView {
  readonly mesh: Mesh
  constructor(scene: Scene, private enemy: Enemy) {
    const s = STYLE[enemy.kind]
    this.mesh = MeshBuilder.CreateCapsule('enemy', { height: s.h, radius: s.d/2 }, scene)
    const m = new StandardMaterial('em', scene); m.diffuseColor = s.color
    this.mesh.material = m
    this.sync()
  }
  sync() {
    const p = this.enemy.pos
    this.mesh.position.set(p.x, this.mesh.getBoundingInfo().boundingBox.extendSize.y, p.z)
  }
  dispose() { this.mesh.dispose() }
}
```

`src/towers/TowerView.ts`:
```ts
import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import { Tower } from './Tower'

const COLOR = {
  cannon: new Color3(0.5,0.5,0.55),
  slow: new Color3(0.25,0.45,0.9),
  sniper: new Color3(0.15,0.15,0.2),
}

export class TowerView {
  readonly mesh: Mesh
  constructor(scene: Scene, private tower: Tower) {
    this.mesh = MeshBuilder.CreateCylinder('tower', { height: 1.5, diameter: 1.2 }, scene)
    const m = new StandardMaterial('tm', scene); m.diffuseColor = COLOR[tower.kind]
    this.mesh.material = m
    this.mesh.position.set(tower.pos.x, 0.75, tower.pos.z)
    this.sync()
  }
  sync() { this.mesh.scaling.y = 1 + this.tower.level * 0.25 }
  dispose() { this.mesh.dispose() }
}
```

- [ ] **Step 2: Commit** — `git commit -am "feat: EnemyView + TowerView meshes"` (визуальная проверка в Task 18)

---

### Task 14: CameraRig — две камеры + Tab + pointer-lock (ручная проверка)

**Files:**
- Create: `src/camera/CameraRig.ts`

**Interfaces:**
- Consumes: `Scene`, `Vector3`, `Vec3`.
- Produces:
  - `type ViewMode = 'top' | 'hero'`
  - `class CameraRig` ctor `(scene: Scene, canvas: HTMLCanvasElement, heroStart: Vec3)`
    - `mode: ViewMode` (старт 'top')
    - `topCam`, `heroCam` (UniversalCamera)
    - `toggle(): void` — меняет активную камеру сцены; в 'hero' включает pointer-lock и collisions, в 'top' — снимает lock.
    - `setHeroPosition(p: Vec3): void`
    - `get heroPosition(): Vec3`

Heroкамера: `checkCollisions = true`, `applyGravity = false`, `ellipsoid` задан; WASD-движение делает HeroController (Task 15), не камера.

- [ ] **Step 1: Implement**

`src/camera/CameraRig.ts`:
```ts
import { Scene, UniversalCamera, ArcRotateCamera, Vector3 } from '@babylonjs/core'
import { Vec3 } from '../core/Vec3'

export type ViewMode = 'top' | 'hero'

export class CameraRig {
  mode: ViewMode = 'top'
  readonly topCam: ArcRotateCamera
  readonly heroCam: UniversalCamera
  constructor(private scene: Scene, private canvas: HTMLCanvasElement, heroStart: Vec3) {
    this.topCam = new ArcRotateCamera('top', -Math.PI/2, 0.6, 45, Vector3.Zero(), scene)
    this.topCam.attachControl(canvas, true)
    this.heroCam = new UniversalCamera('hero', new Vector3(heroStart.x, 1.7, heroStart.z), scene)
    this.heroCam.checkCollisions = true
    this.heroCam.applyGravity = false
    this.heroCam.ellipsoid = new Vector3(0.5, 0.85, 0.5)
    this.heroCam.minZ = 0.1
    scene.activeCamera = this.topCam
  }
  toggle() {
    if (this.mode === 'top') {
      this.mode = 'hero'
      this.topCam.detachControl()
      this.scene.activeCamera = this.heroCam
      this.heroCam.attachControl(this.canvas, true)
      this.canvas.requestPointerLock?.()
    } else {
      this.mode = 'top'
      this.heroCam.detachControl()
      document.exitPointerLock?.()
      this.scene.activeCamera = this.topCam
      this.topCam.attachControl(this.canvas, true)
    }
  }
  setHeroPosition(p: Vec3) { this.heroCam.position.set(p.x, 1.7, p.z) }
  get heroPosition(): Vec3 { const v = this.heroCam.position; return { x: v.x, y: v.y, z: v.z } }
}
```

- [ ] **Step 2: Commit** — `git commit -am "feat: CameraRig top/hero toggle + pointer-lock"`

---

### Task 15: HeroController — WASD-движение + стрельба raycast (ручная проверка)

**Files:**
- Create: `src/hero/HeroController.ts`

**Interfaces:**
- Consumes: `Scene`, `CameraRig`, `HeroWeapon`, `Enemy`, `EnemyView`, `Vec3`.
- Produces:
  - `class HeroController` ctor `(scene: Scene, rig: CameraRig, weapon: HeroWeapon)`
    - внутренне слушает keydown/keyup (WASD), pointer down (стрельба).
    - `update(dt: number, enemies: { enemy: Enemy; view: EnemyView }[]): { hit: Enemy; damage: number } | null` — двигает heroCam по вводу (только в mode 'hero'); если был выстрел и raycast по mesh попал во врага — возвращает {hit, damage}; иначе null.
    - стрельба: на pointerdown ставит флаг; в update, если flag и mode==='hero' и weapon.fire() вернул урон — делает `scene.pick(center)` по mesh врагов, сопоставляет pickedMesh с view.mesh.

Движение: брать forward/right из `heroCam.getDirection`, обнулять y, нормировать, двигать `heroCam.position` с учётом collisions через `heroCam.cameraDirection` или `moveWithCollisions`. Скорость ~6 ед/сек.

- [ ] **Step 1: Implement**

`src/hero/HeroController.ts`:
```ts
import { Scene, Vector3 } from '@babylonjs/core'
import { CameraRig } from '../camera/CameraRig'
import { HeroWeapon } from './HeroWeapon'
import { Enemy } from '../enemies/Enemy'
import { EnemyView } from '../enemies/EnemyView'

const SPEED = 6

export class HeroController {
  private keys = new Set<string>()
  private wantFire = false
  constructor(private scene: Scene, private rig: CameraRig, private weapon: HeroWeapon) {
    addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()))
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    addEventListener('pointerdown', () => { if (this.rig.mode === 'hero') this.wantFire = true })
  }
  update(dt: number, enemies: { enemy: Enemy; view: EnemyView }[]): { hit: Enemy; damage: number } | null {
    this.weapon.tick(dt)
    if (this.rig.mode !== 'hero') { this.wantFire = false; return null }
    const cam = this.rig.heroCam
    const fwd = cam.getDirection(Vector3.Forward()); fwd.y = 0; fwd.normalize()
    const right = cam.getDirection(Vector3.Right()); right.y = 0; right.normalize()
    let move = Vector3.Zero()
    if (this.keys.has('w')) move.addInPlace(fwd)
    if (this.keys.has('s')) move.subtractInPlace(fwd)
    if (this.keys.has('d')) move.addInPlace(right)
    if (this.keys.has('a')) move.subtractInPlace(right)
    if (move.length() > 0) { move.normalize().scaleInPlace(SPEED * dt); cam.cameraDirection.addInPlace(move) }

    if (this.wantFire) {
      this.wantFire = false
      const dmg = this.weapon.fire()
      if (dmg != null) {
        const pick = this.scene.pick(this.scene.getEngine().getRenderWidth()/2, this.scene.getEngine().getRenderHeight()/2)
        if (pick?.hit && pick.pickedMesh) {
          const found = enemies.find((e) => e.view.mesh === pick.pickedMesh)
          if (found) return { hit: found.enemy, damage: dmg }
        }
      }
    }
    return null
  }
}
```

- [ ] **Step 2: Commit** — `git commit -am "feat: HeroController WASD + raycast shooting"`

---

### Task 16: HUD + BuildMenu (DOM overlay, ручная проверка)

**Files:**
- Create: `src/ui/HUD.ts`, `src/ui/BuildMenu.ts`, modify `index.html` (добавить overlay-контейнеры)

**Interfaces:**
- Produces:
  - `class HUD` ctor `(state: GameState, hero: HeroState)` + `mount(): void` + `update(): void` — рисует золото/жизни/волну/HP героя; крестик-прицел показывается только в hero-mode (метод `setCrosshair(visible: boolean)`); `showEnd(victory: boolean): void`.
  - `class BuildMenu` ctor `(onSelect: (k: TowerKind | null) => void)` + `mount()` — кнопки cannon/slow/sniper, подсветка выбранной; `setVisible(v: boolean)` (видно только в top-mode).

- [ ] **Step 1: Add overlay container to index.html**

В `index.html` перед `<script>` добавить:
```html
<div id="hud" style="position:fixed;top:8px;left:8px;color:#fff;font-family:monospace;font-size:16px;text-shadow:0 0 3px #000;pointer-events:none"></div>
<div id="crosshair" style="position:fixed;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid #fff;border-radius:50%;display:none;pointer-events:none"></div>
<div id="buildmenu" style="position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px"></div>
<div id="endscreen" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);color:#fff;font-family:monospace;font-size:32px"></div>
```

- [ ] **Step 2: Implement HUD**

`src/ui/HUD.ts`:
```ts
import { GameState } from '../core/GameState'
import { HeroState } from '../hero/HeroState'

export class HUD {
  private el!: HTMLElement
  private cross!: HTMLElement
  private end!: HTMLElement
  constructor(private state: GameState, private hero: HeroState) {}
  mount() {
    this.el = document.getElementById('hud')!
    this.cross = document.getElementById('crosshair')!
    this.end = document.getElementById('endscreen')!
  }
  setCrosshair(v: boolean) { this.cross.style.display = v ? 'block' : 'none' }
  update() {
    this.el.innerHTML =
      `Gold: ${this.state.gold}<br>Lives: ${this.state.lives}<br>` +
      `Wave: ${this.state.wave}/${this.state.totalWaves}<br>` +
      `Hero HP: ${this.hero.alive ? this.hero.hp : 'respawning...'}`
  }
  showEnd(victory: boolean) {
    this.end.style.display = 'flex'
    this.end.textContent = victory ? 'VICTORY' : 'GAME OVER'
  }
}
```

- [ ] **Step 3: Implement BuildMenu**

`src/ui/BuildMenu.ts`:
```ts
import { TowerKind } from '../towers/TowerTypes'

export class BuildMenu {
  private root!: HTMLElement
  private selected: TowerKind | null = null
  constructor(private onSelect: (k: TowerKind | null) => void) {}
  mount() {
    this.root = document.getElementById('buildmenu')!
    const kinds: TowerKind[] = ['cannon', 'slow', 'sniper']
    for (const k of kinds) {
      const b = document.createElement('button')
      b.textContent = k
      b.style.cssText = 'padding:8px 12px;font-family:monospace;cursor:pointer'
      b.onclick = () => {
        this.selected = this.selected === k ? null : k
        this.onSelect(this.selected)
        this.render()
      }
      b.dataset.kind = k
      this.root.appendChild(b)
    }
  }
  private render() {
    for (const b of Array.from(this.root.children) as HTMLButtonElement[]) {
      b.style.outline = b.dataset.kind === this.selected ? '2px solid #ff0' : 'none'
    }
  }
  setVisible(v: boolean) { this.root.style.display = v ? 'flex' : 'none' }
}
```

- [ ] **Step 4: Commit** — `git commit -am "feat: HUD + BuildMenu DOM overlay"`

---

### Task 17: main.ts — сборка систем, игровой цикл, win/lose

**Files:**
- Modify: `src/main.ts` (полностью переписать поверх Task 1)

**Interfaces:**
- Consumes: всё выше.
- Produces: рабочая игра. Логика тика:
  1. построить scene/ground/light, Level.demo, GameState, EventBus, CameraRig (heroStart = level.base), HeroState, HeroWeapon, HeroController, WaveManager(demoWaves), TowerManager, HUD, BuildMenu.
  2. ground.checkCollisions=true; невидимые стены по периметру (checkCollisions) чтобы герой не убегал.
  3. Tab -> rig.toggle + HUD.setCrosshair(hero mode) + BuildMenu.setVisible(top mode).
  4. В top-mode клик по ground -> level.cellAt -> если выбрана башня в BuildMenu и build успешен -> new TowerView; клик по существующей TowerView без выбранной башни -> upgrade (или простое контекстное действие).
  5. Кнопка/клавиша Enter в build-фазе -> state.startWave + wave.startWave(state.wave-1).
  6. onBeforeRender(dt): если phase!=='wave' пропустить симуляцию врагов; иначе wm.update -> создать EnemyView для новых; для каждого enemy: update(dt); если reachedBase -> state.damageBase(1) + удалить view + wm.remove; sync views. tm.update(dt, activeEnemies) -> применить ShotResult: target.takeDamage, slow (умножить speed), если !alive -> state.addGold(bounty)+emit enemyKilled+убрать view+wm.remove. hero.tick; heroCtrl.update -> применить hit. Если wm.cleared() -> state.endWave().
  7. on gameOver event -> HUD.showEnd(victory), стоп симуляции.
- Enemy slow: добавить в `Enemy` метод `applySlow(factor, duration)` — ВНИМАНИЕ: это новый метод, добавить в Task 7? Нет — добавляется здесь как доп. шаг с тестом ниже.

- [ ] **Step 1: Add slow support to Enemy (TDD)**

Добавить тест в `tests/enemies/Enemy.test.ts`:
```ts
it('applySlow reduces effective speed temporarily', () => {
  const e = new Enemy(ENEMY_DEFS.normal, [{x:0,y:0,z:0},{x:100,y:0,z:0}])
  e.applySlow(0.5, 1)
  e.update(1) // speed 2 * 0.5 = 1
  expect(e.pos.x).toBeCloseTo(1)
  e.update(1) // slow expired -> full speed 2
  expect(e.pos.x).toBeCloseTo(3)
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Extend Enemy**

В `src/enemies/Enemy.ts` добавить поля и методы:
```ts
// add fields
private slowFactor = 1
private slowTimer = 0
// modify update:
update(dt: number) {
  if (this.hp <= 0) return
  if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1 }
  this.follower.advance(dt * this.slowFactor)
}
applySlow(factor: number, duration: number) {
  this.slowFactor = Math.min(this.slowFactor, factor)
  this.slowTimer = Math.max(this.slowTimer, duration)
}
```
(`advance` принимает «эффективное dt»; baseSpeed остаётся в follower.)

- [ ] **Step 4: Run, expect PASS** — `npm test`

- [ ] **Step 5: Write main.ts integration**

`src/main.ts` (переписать целиком):
```ts
import { Engine, Scene, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial } from '@babylonjs/core'
import { EventBus } from './core/EventBus'
import { GameState } from './core/GameState'
import { Level } from './world/Level'
import { CameraRig } from './camera/CameraRig'
import { HeroState } from './hero/HeroState'
import { HeroWeapon } from './hero/HeroWeapon'
import { HeroController } from './hero/HeroController'
import { WaveManager } from './enemies/WaveManager'
import { EnemyView } from './enemies/EnemyView'
import { Enemy } from './enemies/Enemy'
import { TowerManager } from './towers/TowerManager'
import { TowerView } from './towers/TowerView'
import { Tower } from './towers/Tower'
import { TowerKind } from './towers/TowerTypes'
import { HUD } from './ui/HUD'
import { BuildMenu } from './ui/BuildMenu'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
new HemisphericLight('l', new Vector3(0,1,0), scene)

const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene)
const gm = new StandardMaterial('g', scene); gm.diffuseColor = new Color3(0.2,0.45,0.2)
ground.material = gm; ground.checkCollisions = true

// perimeter walls (invisible) so hero can't leave
for (const [x,z,w,d] of [[0,20,40,1],[0,-20,40,1],[20,0,1,40],[-20,0,1,40]] as const) {
  const wall = MeshBuilder.CreateBox('wall', { width: w, height: 4, depth: d }, scene)
  wall.position.set(x, 2, z); wall.checkCollisions = true; wall.isVisible = false
}

const bus = new EventBus()
const state = new GameState(bus)
const level = Level.demo()

// draw path as a strip of dark boxes (visual aid)
for (const p of level.path) {
  const m = MeshBuilder.CreateBox('node', { size: 1.5 }, scene)
  m.position.set(p.x, 0.05, p.z); m.scaling.y = 0.05
  const mat = new StandardMaterial('pm', scene); mat.diffuseColor = new Color3(0.35,0.3,0.25); m.material = mat
}
// base marker
const baseMesh = MeshBuilder.CreateBox('base', { size: 2 }, scene)
baseMesh.position.set(level.base.x, 1, level.base.z)
const bmat = new StandardMaterial('bm', scene); bmat.diffuseColor = new Color3(0.2,0.4,0.9); baseMesh.material = bmat

const rig = new CameraRig(scene, canvas, { x: level.base.x, y: 0, z: level.base.z - 3 })
const heroState = new HeroState(bus)
const heroWeapon = new HeroWeapon()
const heroCtrl = new HeroController(scene, rig, heroWeapon)
const wm = new WaveManager(level.path, WaveManager.demoWaves())
const tm = new TowerManager(state, level)
const hud = new HUD(state, heroState); hud.mount()

let selectedKind: TowerKind | null = null
const buildMenu = new BuildMenu((k) => { selectedKind = k }); buildMenu.mount()

const views = new Map<Enemy, EnemyView>()
const towerViews = new Map<Tower, TowerView>()
let over = false
bus.on('gameOver', ({ victory }) => { over = true; hud.showEnd(victory) })

// input: Tab toggle, Enter start wave
addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault(); rig.toggle()
    hud.setCrosshair(rig.mode === 'hero'); buildMenu.setVisible(rig.mode === 'top')
  }
  if (e.key === 'Enter' && state.phase === 'build') {
    state.startWave(); wm.startWave(state.wave - 1)
  }
})

// build / upgrade on click in top mode
scene.onPointerDown = (_evt, pick) => {
  if (rig.mode !== 'top' || over) return
  if (!pick?.pickedPoint) return
  // upgrade if clicked an existing tower
  const clickedTower = [...towerViews].find(([, v]) => v.mesh === pick.pickedMesh)
  if (clickedTower) { if (tm.upgrade(clickedTower[0])) clickedTower[1].sync(); return }
  if (!selectedKind) return
  const cell = level.cellAt(pick.pickedPoint.x, pick.pickedPoint.z, 2)
  if (!cell) return
  const t = tm.build(selectedKind, cell)
  if (t) towerViews.set(t, new TowerView(scene, t))
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000
  heroState.tick(dt)
  if (!over && state.phase === 'wave') {
    for (const e of wm.update(dt)) views.set(e, new EnemyView(scene, e))
    for (const e of [...wm.active]) {
      e.update(dt)
      if (e.reachedBase) { state.damageBase(1); views.get(e)?.dispose(); views.delete(e); wm.remove(e); continue }
      views.get(e)?.sync()
    }
    for (const shot of tm.update(dt, wm.active)) {
      shot.target.takeDamage(shot.damage)
      if (shot.slow) shot.target.applySlow(shot.slow, 1.5)
      if (!shot.target.alive && !shot.target.reachedBase) {
        state.addGold(shot.target.bounty); bus.emit('enemyKilled', { bounty: shot.target.bounty })
        views.get(shot.target)?.dispose(); views.delete(shot.target); wm.remove(shot.target)
      }
    }
    const hit = heroCtrl.update(dt, [...views].map(([enemy, view]) => ({ enemy, view })))
    if (hit) {
      hit.hit.takeDamage(hit.damage)
      if (!hit.hit.alive) {
        state.addGold(hit.hit.bounty); bus.emit('enemyKilled', { bounty: hit.hit.bounty })
        views.get(hit.hit)?.dispose(); views.delete(hit.hit); wm.remove(hit.hit)
      }
    }
    if (wm.cleared()) state.endWave()
  } else {
    heroCtrl.update(dt, [])
  }
  hud.update()
})

engine.runRenderLoop(() => scene.render())
addEventListener('resize', () => engine.resize())
buildMenu.setVisible(true)
```

- [ ] **Step 6: Run full test suite** — Run: `npm test` — Expected: все unit-тесты зелёные.

- [ ] **Step 7: Manual playtest** — Run: `npm run dev`. Проверить чеклист:
  - Зелёное поле, путь, синяя база видны сверху.
  - Выбор башни в меню + клик у дороги -> башня ставится, золото падает.
  - Enter -> волна стартует, враги идут по пути.
  - Башни стреляют, враги умирают, золото растёт.
  - Tab -> вид от первого лица у базы, WASD ходит, мышь крутит, прицел виден, ЛКМ убивает врага.
  - Враг дошёл до базы -> Lives −1.
  - Все 10 волн пройдены -> VICTORY; Lives=0 -> GAME OVER.

- [ ] **Step 8: Commit** — `git commit -am "feat: wire game loop, waves, build, hero, win/lose"`

---

## Self-Review

**Spec coverage:**
- Концепция/две камеры/Tab — Task 14, 17. ✓
- Babylon+TS+Vite+Vitest — Task 1. ✓
- Примитивы — Task 13, 17. ✓
- Чистая логика без Babylon — Tasks 2-12 (тесты в node-env). ✓
- Фикс-путь/waypoints — Task 5, 6. ✓
- Башни cannon/slow/sniper + апгрейд 3 ур. — Task 8, 12. ✓
- Враги normal/fast/tank — Task 7. ✓
- 10 волн — Task 11. ✓
- Экономика (золото за килл + бонус волны) — Task 4, 17. **GAP залатан ниже.**
- Жизни базы N=20, проигрыш на 0 — Task 4, 17. ✓
- Герой смертен + респавн — Task 10. ✓
- Герой только стрельба, raycast — Task 9, 15. ✓
- Slow-эффект на врага — Task 17 step 1-4. ✓
- Win/lose экран — Task 16, 17. ✓

**GAP найден:** «бонус золота за волну» из спека не реализован явно. **Фикс:** в Task 17 step 5, в ветке `if (wm.cleared()) state.endWave()` добавить перед `endWave()`: `state.addGold(20 + state.wave * 5)`. Внести это в код main.ts при реализации (строка с `wm.cleared()`):
```ts
if (wm.cleared()) { state.addGold(20 + state.wave * 5); state.endWave() }
```

**Placeholder scan:** код приведён полностью в каждом шаге, без TODO. ✓

**Type consistency:** `ShotResult` (Task 8) используется в TowerManager (Task 12) и main (Task 17) одинаково; `applySlow(factor,duration)` объявлен в Task 17 и вызван там же; `EnemyView.mesh`/`TowerView.mesh` публичны и так используются в HeroController/main. ✓

---

## Execution note

Tasks 2-12 — чистый TDD (быстрая обратная связь). Tasks 13-17 — Babylon/DOM, проверяются вручную в браузере (юнит-тестам не поддаются без headless-WebGL, что вне MVP).
