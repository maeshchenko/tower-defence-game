# M1 — Asset Pipeline + Visual Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every primitive-shape entity (towers, enemies, hero, projectiles, solid decor, base) with real CC0 GLB models, keeping gameplay/maps/waves/balance identical.

**Architecture:** A new `AssetManager` preloads GLB files into Babylon `AssetContainer`s at startup (behind a loading overlay) and hands out cloned instances. Existing view classes (`TowerView`, `EnemyView`) and `main.ts` keep their `mesh`/`sync()`/`dispose()` contracts — only the mesh creation swaps from `MeshBuilder.Create*` to `assets.instance(key)`. Used models are copied into `public/models/**` by a build script; the source kits stay out of the bundle.

**Tech Stack:** Babylon.js 9 (`@babylonjs/core` + new `@babylonjs/loaders`), TypeScript, Vite, Vitest (node env), node copy script.

## Global Constraints

- Theme is **medieval/fantasy**. Kenney UFO enemies are NOT used.
- All assets are **CC0**: Kenney TD kit (`kenney_tower-defense-kit/Models/GLB format/`), KayKit Adventurers (`assets-src/adventurers/addons/kaykit_character_pack_adventures/Characters/gltf/`), KayKit Skeletons (`assets-src/skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf/`).
- **Kenney GLBs reference an external texture** `Textures/colormap.png` (relative to the `.glb`). It MUST be copied alongside every Kenney model under `public/`.
- KayKit GLBs are **self-contained** (embedded textures) — copy as-is.
- `@babylonjs/loaders` is **not installed** — add it; without `import '@babylonjs/loaders/glTF'` Babylon cannot load `.glb`.
- **No gameplay/balance/wave/input changes.** Visual-only milestone.
- Models live ONLY under `public/models/`; never import GLB paths from the source kits at runtime.
- Vitest runs in **node env** — no WebGL/DOM. Unit-test pure logic only; verify rendering by running `npm run dev` and observing (steps included per task).
- Test files: co-locate as `src/**/<name>.test.ts` (project has no tests yet; this is the convention we set).

---

## File Structure

- `scripts/copy-assets.mjs` — node script copying used GLBs + Kenney `Textures/colormap.png` into `public/models/{towers,enemies,hero,props,ammo}/`. Pure fs; testable by running it and asserting outputs.
- `src/rendering/models.ts` — pure data + math: the `MODELS` registry (logical key → path, target height, y-offset, optional yaw) and `normalizeScale()` helper. No Babylon imports → unit-testable in node.
- `src/rendering/AssetManager.ts` — Babylon-dependent: `preload`, `instance`, `playIdle`. Imports `models.ts`.
- `src/towers/TowerView.ts` — swap cylinder → model, keep ring + sync contract.
- `src/enemies/EnemyView.ts` — swap capsule → model + idle anim + ground y-offset.
- `src/main.ts` — async bootstrap + loading overlay; hero model; `buildProp` solid kinds; `spawnBall` model key; base marker.
- `package.json` — add `@babylonjs/loaders`, `assets` script.
- `.gitignore`, `README.md`.

---

### Task 1: Add glTF loader dependency

**Files:**
- Modify: `package.json` (dependencies + scripts)
- Modify: `src/main.ts:1` (add side-effect import)

**Interfaces:**
- Produces: a working Babylon glTF/GLB loader registered globally (consumed by `AssetManager.preload` in Task 3).

- [ ] **Step 1: Install the loaders package**

```bash
npm install @babylonjs/loaders@^9.13.0
```

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require.resolve('@babylonjs/loaders/glTF')" && echo OK`
Expected: prints `OK` (path resolves, no throw).

- [ ] **Step 3: Register the loader side-effect import in main.ts**

Add as the very first import line in `src/main.ts`:

```typescript
import '@babylonjs/loaders/glTF'
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes (exit 0), no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.ts
git commit -m "build: add @babylonjs/loaders for GLB import"
```

---

### Task 2: Asset copy script

**Files:**
- Create: `scripts/copy-assets.mjs`
- Create: `scripts/copy-assets.test.ts`  (run from project root via vitest)
- Modify: `package.json` (add `"assets"` script)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `public/models/{towers,enemies,hero,props,ammo}/*.glb` and `public/models/towers|props|ammo/Textures/colormap.png`. AssetManager (Task 3) loads from these paths.

- [ ] **Step 1: Write the copy script**

Create `scripts/copy-assets.mjs`:

```javascript
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KENNEY = join(root, 'kenney_tower-defense-kit/Models/GLB format')
const ADV = join(root, 'assets-src/adventurers/addons/kaykit_character_pack_adventures/Characters/gltf')
const SKEL = join(root, 'assets-src/skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf')
const OUT = join(root, 'public/models')

// Kenney models grouped by destination folder (texture copied per folder once)
const KENNEY_MODELS = {
  towers: [
    'tower-square-bottom-a', 'tower-square-middle-a',
    'tower-round-base', 'tower-round-middle-a', 'tower-round-roof-a', 'tower-round-crystals',
    'weapon-cannon', 'weapon-ballista',
  ],
  ammo: ['weapon-ammo-cannonball', 'weapon-ammo-arrow', 'weapon-ammo-bullet'],
  props: ['detail-tree', 'detail-tree-large', 'detail-rocks', 'detail-rocks-large',
          'wood-structure', 'wood-structure-high', 'wood-structure-part'],
}
const KAYKIT = {
  hero: [[ADV, 'Knight.glb']],
  enemies: [[SKEL, 'Skeleton_Warrior.glb'], [SKEL, 'Skeleton_Minion.glb'], [SKEL, 'Skeleton_Rogue.glb']],
}

function copyKenney(folder, names) {
  const dst = join(OUT, folder)
  mkdirSync(join(dst, 'Textures'), { recursive: true })
  cpSync(join(KENNEY, 'Textures/colormap.png'), join(dst, 'Textures/colormap.png'))
  for (const n of names) {
    const src = join(KENNEY, n + '.glb')
    if (!existsSync(src)) throw new Error('missing Kenney model: ' + src)
    cpSync(src, join(dst, n + '.glb'))
  }
}
function copyKaykit(folder, entries) {
  const dst = join(OUT, folder)
  mkdirSync(dst, { recursive: true })
  for (const [base, file] of entries) {
    const src = join(base, file)
    if (!existsSync(src)) throw new Error('missing KayKit model: ' + src)
    cpSync(src, join(dst, file))
  }
}

for (const [folder, names] of Object.entries(KENNEY_MODELS)) copyKenney(folder, names)
for (const [folder, entries] of Object.entries(KAYKIT)) copyKaykit(folder, entries)
console.log('assets copied to', OUT)
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, add:

```json
"assets": "node scripts/copy-assets.mjs"
```

- [ ] **Step 3: Write the failing test**

Create `scripts/copy-assets.test.ts`:

```typescript
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { test, expect } from 'vitest'

test('copy-assets produces models + Kenney external texture', () => {
  execSync('node scripts/copy-assets.mjs', { stdio: 'pipe' })
  expect(existsSync('public/models/towers/weapon-cannon.glb')).toBe(true)
  expect(existsSync('public/models/towers/Textures/colormap.png')).toBe(true)
  expect(existsSync('public/models/ammo/Textures/colormap.png')).toBe(true)
  expect(existsSync('public/models/hero/Knight.glb')).toBe(true)
  expect(existsSync('public/models/enemies/Skeleton_Warrior.glb')).toBe(true)
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run scripts/copy-assets.test.ts`
Expected: FAIL initially if script path wrong; if it passes immediately because the script works, that is acceptable (the script IS the implementation here). Confirm the assertions ran.

- [ ] **Step 5: Run the copy + test to verify pass**

Run: `npm run assets && npx vitest run scripts/copy-assets.test.ts`
Expected: PASS, console prints `assets copied to .../public/models`.

- [ ] **Step 6: Ignore generated + source-kit dirs**

Add to `.gitignore`:

```
public/models/
assets-src/
```

(Leave `kenney_tower-defense-kit/` tracked as before unless the user says otherwise.)

- [ ] **Step 7: Commit**

```bash
git add scripts/copy-assets.mjs scripts/copy-assets.test.ts package.json .gitignore
git commit -m "build: add asset copy script (used GLBs + Kenney colormap) into public/models"
```

---

### Task 3: Model registry + AssetManager

**Files:**
- Create: `src/rendering/models.ts`
- Create: `src/rendering/models.test.ts`
- Create: `src/rendering/AssetManager.ts`

**Interfaces:**
- Produces:
  - `models.ts`: `interface ModelDef { url: string; targetHeight: number; yaw?: number }`,
    `const MODELS: Record<string, ModelDef>`,
    `function normalizeScale(rawHeight: number, targetHeight: number): number`.
  - `AssetManager.ts`: class with
    `preload(scene: Scene): Promise<void>`,
    `instance(key: string): TransformNode`,
    `playIdle(root: TransformNode): void`.
- Consumes: `public/models/**` paths (Task 2), glTF loader (Task 1).

- [ ] **Step 1: Write the failing test for pure logic**

Create `src/rendering/models.test.ts`:

```typescript
import { test, expect } from 'vitest'
import { MODELS, normalizeScale } from './models'

test('normalizeScale maps raw model height to target game height', () => {
  expect(normalizeScale(0.44, 2.2)).toBeCloseTo(5.0, 2)
  expect(normalizeScale(2.0, 2.0)).toBeCloseTo(1.0, 2)
})

test('normalizeScale is safe for degenerate height', () => {
  expect(normalizeScale(0, 2)).toBe(1) // avoid divide-by-zero -> identity
})

test('registry has every logical key the views request', () => {
  for (const k of [
    'tower.cannon', 'tower.slow', 'tower.sniper',
    'enemy.normal', 'enemy.fast', 'enemy.tank',
    'hero.knight',
    'ammo.cannon', 'ammo.sniper', 'ammo.slow',
    'prop.tree', 'prop.rock', 'prop.wall', 'prop.crate',
    'base.keep',
  ]) {
    expect(MODELS[k], k).toBeDefined()
    expect(MODELS[k].url.startsWith('/models/'), k).toBe(true)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rendering/models.test.ts`
Expected: FAIL — `Cannot find module './models'`.

- [ ] **Step 3: Implement models.ts**

Create `src/rendering/models.ts`. Tower/base keys map to the FIRST part of an assembled stack; AssetManager assembles multi-part towers (Step 5). For single-mesh keys `url` is the only file.

```typescript
export interface ModelDef {
  url: string          // path under public/, e.g. '/models/hero/Knight.glb'
  targetHeight: number // desired height in game units after normalize
  yaw?: number         // extra Y rotation (radians) if model faces the wrong way
  parts?: string[]     // extra GLB urls stacked onto url (towers), bottom→top
}

// scale factor to bring a model of measured height `rawHeight` to `targetHeight`
export function normalizeScale(rawHeight: number, targetHeight: number): number {
  if (!(rawHeight > 0)) return 1
  return targetHeight / rawHeight
}

const T = '/models/towers/'
const A = '/models/ammo/'
const P = '/models/props/'
const E = '/models/enemies/'
const H = '/models/hero/'

export const MODELS: Record<string, ModelDef> = {
  'tower.cannon': { url: T + 'tower-square-bottom-a.glb', targetHeight: 2.4,
    parts: [T + 'tower-square-middle-a.glb', T + 'weapon-cannon.glb'] },
  'tower.slow':   { url: T + 'tower-round-base.glb', targetHeight: 2.4,
    parts: [T + 'tower-round-middle-a.glb', T + 'tower-round-crystals.glb'] },
  'tower.sniper': { url: T + 'tower-square-bottom-a.glb', targetHeight: 2.6,
    parts: [T + 'tower-square-middle-a.glb', T + 'weapon-ballista.glb'] },

  'enemy.normal': { url: E + 'Skeleton_Warrior.glb', targetHeight: 1.7 },
  'enemy.fast':   { url: E + 'Skeleton_Minion.glb',  targetHeight: 1.3 },
  'enemy.tank':   { url: E + 'Skeleton_Warrior.glb', targetHeight: 2.4 },

  'hero.knight':  { url: H + 'Knight.glb', targetHeight: 1.8 },

  'ammo.cannon':  { url: A + 'weapon-ammo-cannonball.glb', targetHeight: 0.5 },
  'ammo.sniper':  { url: A + 'weapon-ammo-arrow.glb',      targetHeight: 0.6 },
  'ammo.slow':    { url: A + 'weapon-ammo-bullet.glb',     targetHeight: 0.4 },

  'prop.tree':  { url: P + 'detail-tree-large.glb', targetHeight: 2.6 },
  'prop.rock':  { url: P + 'detail-rocks-large.glb', targetHeight: 1.4 },
  'prop.wall':  { url: P + 'wood-structure-high.glb', targetHeight: 1.7 },
  'prop.crate': { url: P + 'wood-structure-part.glb', targetHeight: 1.2 },

  'base.keep':  { url: T + 'tower-round-base.glb', targetHeight: 3.0,
    parts: [T + 'tower-round-middle-a.glb', T + 'tower-round-roof-a.glb'] },
}
```

- [ ] **Step 4: Run pure-logic test to verify pass**

Run: `npx vitest run src/rendering/models.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Implement AssetManager.ts**

Create `src/rendering/AssetManager.ts`:

```typescript
import {
  Scene, TransformNode, AssetContainer, LoadAssetContainerAsync,
  AnimationGroup, AbstractMesh,
} from '@babylonjs/core'
import { MODELS, normalizeScale } from './models'

// Loads each unique GLB once into an AssetContainer, then clones per request.
export class AssetManager {
  private containers = new Map<string, AssetContainer>()

  async preload(scene: Scene): Promise<void> {
    const urls = new Set<string>()
    for (const def of Object.values(MODELS)) {
      urls.add(def.url)
      for (const p of def.parts ?? []) urls.add(p)
    }
    await Promise.all([...urls].map(async (url) => {
      const c = await LoadAssetContainerAsync(url, scene)
      this.containers.set(url, c)
    }))
  }

  // Clone a model (and any stacked parts) under one root, normalized to height.
  instance(key: string): TransformNode {
    const def = MODELS[key]
    if (!def) throw new Error('unknown model key: ' + key)
    const root = new TransformNode('model:' + key, this.cloneInto(def.url).getScene())
    const urls = [def.url, ...(def.parts ?? [])]
    for (const url of urls) {
      const node = this.cloneInto(url)
      node.parent = root
    }
    const h = this.measureHeight(root)
    const s = normalizeScale(h, def.targetHeight)
    root.scaling.setAll(s)
    if (def.yaw) root.rotation.y = def.yaw
    return root
  }

  // Loop the 'Idle' animation group on a freshly-instanced root (M1: no T-pose).
  playIdle(root: TransformNode): void {
    const groups = (root.metadata?.animationGroups as AnimationGroup[] | undefined) ?? []
    const idle = groups.find((g) => /idle/i.test(g.name)) ?? groups[0]
    idle?.start(true)
  }

  private cloneInto(url: string): TransformNode {
    const c = this.containers.get(url)
    if (!c) throw new Error('not preloaded: ' + url)
    const entries = c.instantiateModelsToScene(undefined, false, { doNotInstantiate: true })
    const node = entries.rootNodes[0] as TransformNode
    // stash animation groups so playIdle can find them on the returned root
    node.metadata = { ...(node.metadata ?? {}), animationGroups: entries.animationGroups }
    return node
  }

  private measureHeight(root: TransformNode): number {
    let min = Infinity, max = -Infinity
    for (const m of root.getChildMeshes(false) as AbstractMesh[]) {
      const b = m.getBoundingInfo().boundingBox
      min = Math.min(min, b.minimumWorld.y)
      max = Math.max(max, b.maximumWorld.y)
    }
    return max > min ? max - min : 1
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: passes. If `LoadAssetContainerAsync` is not exported in this Babylon build, fall back to `SceneLoader.LoadAssetContainerAsync(url, '', scene)` — adjust import and call, re-run.

- [ ] **Step 7: Commit**

```bash
git add src/rendering/models.ts src/rendering/models.test.ts src/rendering/AssetManager.ts
git commit -m "feat: AssetManager + model registry (preload/instance/idle)"
```

---

### Task 4: Async bootstrap + loading overlay

**Files:**
- Modify: `src/main.ts` (wrap init; add overlay; expose `assets`)

**Interfaces:**
- Consumes: `AssetManager` (Task 3).
- Produces: a module-level `const assets = new AssetManager()` already preloaded before `loadMap(0)` runs — consumed by Tasks 5-10. View files import the singleton from `main.ts`? No — pass `assets` into view constructors (they already receive `scene`). Add `assets` as a second constructor arg.

- [ ] **Step 1: Add the AssetManager singleton + overlay helper**

Near the top of `src/main.ts` (after `const scene = new Scene(engine)` at line 24), add:

```typescript
import { AssetManager } from './rendering/AssetManager'
const assets = new AssetManager()

function showLoading(): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = 'Загрузка моделей…'
  el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#10141c;color:#ffd24d;font-family:monospace;font-size:22px;z-index:50'
  document.body.appendChild(el)
  return el
}
```

- [ ] **Step 2: Convert the bottom-of-file startup into an async bootstrap**

Replace the final three lines of `src/main.ts` (currently `loadMap(0)`, `engine.runRenderLoop(...)`, `addEventListener('resize', ...)` at lines 403-405, and `buildMenu.setVisible(true)` at 406) with:

```typescript
async function boot() {
  const overlay = showLoading()
  await assets.preload(scene)
  overlay.remove()
  loadMap(0)
  engine.runRenderLoop(() => scene.render())
  addEventListener('resize', () => engine.resize())
  buildMenu.setVisible(true)
}
boot()
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes (note: `assets` is unused until later tasks; if `noUnusedLocals` errors, proceed to Task 5 which uses it, or temporarily reference it — prefer doing Task 5 next).

- [ ] **Step 4: Manual smoke — overlay then render**

Run: `npm run assets && npm run dev`
Expected: browser opens, shows "Загрузка моделей…" briefly, then the existing primitive-based game renders (models not wired yet). No console errors about failed GLB loads (confirms all `public/models/**` paths resolve).

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: async bootstrap preloads models behind a loading overlay"
```

---

### Task 5: Enemy models

**Files:**
- Modify: `src/enemies/EnemyView.ts`
- Modify: `src/main.ts` (pass `assets` to `new EnemyView`)

**Interfaces:**
- Consumes: `assets.instance('enemy.'+kind)`, `assets.playIdle` (Task 3).
- Produces: `new EnemyView(scene, assets, enemy)` signature.

- [ ] **Step 1: Rewrite EnemyView to use the model**

Replace `src/enemies/EnemyView.ts` entirely:

```typescript
import { Scene, TransformNode } from '@babylonjs/core'
import { Enemy } from './Enemy'
import { AssetManager } from '../rendering/AssetManager'

export class EnemyView {
  readonly mesh: TransformNode
  constructor(scene: Scene, assets: AssetManager, private enemy: Enemy) {
    this.mesh = assets.instance('enemy.' + enemy.kind)
    assets.playIdle(this.mesh)
    this.sync()
  }
  sync() {
    const p = this.enemy.pos
    this.mesh.position.set(p.x, 0, p.z) // feet on the ground; model origin at base
    this.mesh.rotation.y = this.enemy.heading ?? this.mesh.rotation.y
  }
  dispose() { this.mesh.dispose(false, true) }
}
```

If `Enemy` has no `heading` property, drop that line (check `src/enemies/Enemy.ts`); facing is refined in M2.

- [ ] **Step 2: Pass `assets` at the EnemyView call site**

In `src/main.ts`, both places that construct an `EnemyView` (line ~354 in the wave loop: `views.set(e, new EnemyView(scene, e))`) become:

```typescript
views.set(e, new EnemyView(scene, assets, e))
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual verify — skeletons walk the path**

Run: `npm run dev`, press Enter to start a wave.
Expected: skeleton models (not capsules) spawn at the path start and move along it; they stand in an Idle animation (not a static T-pose); normal=warrior, fast=smaller minion, tank=large warrior. On death they disappear (death animation = M2). Gold increments on kills as before.

- [ ] **Step 5: Commit**

```bash
git add src/enemies/EnemyView.ts src/main.ts
git commit -m "feat: render enemies as KayKit skeleton models with idle anim"
```

---

### Task 6: Tower models

**Files:**
- Modify: `src/towers/TowerView.ts`
- Modify: `src/main.ts` (pass `assets` to `new TowerView`)

**Interfaces:**
- Consumes: `assets.instance('tower.'+kind)`.
- Produces: `new TowerView(scene, assets, tower)` signature; keeps `mesh`, `sync()`, `dispose()`.

- [ ] **Step 1: Swap the cylinder for the model, keep the range ring**

In `src/towers/TowerView.ts`, change the constructor and the `mesh` type. Replace lines 17-31 (`export class TowerView { ... this.sync() }`) with:

```typescript
export class TowerView {
  readonly mesh: TransformNode
  private ring: LinesMesh
  constructor(scene: Scene, assets: AssetManager, private tower: Tower) {
    this.mesh = assets.instance('tower.' + tower.kind)
    this.mesh.position.set(tower.pos.x, 0, tower.pos.z)
    this.ring = MeshBuilder.CreateDashedLines('range', { points: RING_POINTS, dashSize: 2, gapSize: 2, dashNb: 80 }, scene)
    this.ring.color = COLOR[tower.kind]
    this.ring.isPickable = false
    this.ring.position.set(tower.pos.x, 0.08, tower.pos.z)
    this.sync()
  }
```

Update imports at line 1 to include `TransformNode` and the AssetManager, and drop now-unused `StandardMaterial`/`Vector3`-only-for-mesh bits if the ring still needs `Vector3` keep it:

```typescript
import { Scene, MeshBuilder, Color3, Vector3, TransformNode, LinesMesh } from '@babylonjs/core'
import { Tower } from './Tower'
import { AssetManager } from '../rendering/AssetManager'
```

Update `sync()` (lines 32-37) to scale the model root by level on top of its normalized base scale — capture the base scale once:

```typescript
  sync() {
    const grow = 1 + this.tower.level * 0.15
    const base = (this.mesh.metadata?.baseScale as number) ?? this.mesh.scaling.x
    this.mesh.metadata = { ...(this.mesh.metadata ?? {}), baseScale: base }
    this.mesh.scaling.setAll(base * grow)
    const r = this.tower.stats.range
    this.ring.scaling.set(r, 1, r)
  }
  dispose() { this.mesh.dispose(false, true); this.ring.dispose() }
```

(The `COLOR` map and `RING_POINTS` at the top of the file stay unchanged. The picking in `main.ts` compares `v.mesh === pick.pickedMesh`; see Step 2.)

- [ ] **Step 2: Fix tower picking (model root vs picked submesh)**

In `src/main.ts` the upgrade click (line ~338) does
`[...towerViews].find(([, v]) => v.mesh === pick.pickedMesh)`. The picked mesh is now a child submesh of the model root, not the root itself. Change it to walk parents:

```typescript
  const clickedTower = [...towerViews].find(([, v]) => {
    let n = pick.pickedMesh as any
    while (n) { if (n === v.mesh) return true; n = n.parent }
    return false
  })
```

And update the build site (line ~345) `towerViews.set(t, new TowerView(scene, t))` to:

```typescript
  if (t) towerViews.set(t, new TowerView(scene, assets, t))
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual verify — towers are 3D, build + upgrade work**

Run: `npm run dev`. In top view (Tab), select cannon, click a build cell.
Expected: a 3D tower (square base + cannon) appears on the cell instead of a cylinder; slow = round tower with crystals; sniper = square base + ballista. The dashed range ring still shows. Clicking an existing tower upgrades it and it grows slightly. Gold deducts as before.

- [ ] **Step 5: Commit**

```bash
git add src/towers/TowerView.ts src/main.ts
git commit -m "feat: render towers as assembled Kenney GLB models; fix model-root picking"
```

---

### Task 7: Hero model

**Files:**
- Modify: `src/main.ts` (replace `heroBody`/`heroNose` capsule with Knight model)

**Interfaces:**
- Consumes: `assets.instance('hero.knight')`, `assets.playIdle`.

- [ ] **Step 1: Replace the hero capsule with the Knight model**

In `src/main.ts`, replace the hero body block (lines 79-84: `heroMat` through `heroNose...position.set`) with:

```typescript
const heroBody = assets.instance('hero.knight')
heroBody.getChildMeshes().forEach((m) => (m.isPickable = false))
assets.playIdle(heroBody)
```

Note: `assets` is preloaded in `boot()` (Task 4) which runs before any frame, but this hero instancing runs at module-eval time (before `boot`). Move the hero creation INTO `loadMap` or `boot` after preload. Simplest: wrap the three lines above in a `function makeHero()` and call it as the first line of `boot()` after `await assets.preload(scene)`. Keep the `let heroBody!: TransformNode` declaration at module scope so `syncHero` can reference it.

Concretely:
- At module scope: `let heroBody!: import('@babylonjs/core').TransformNode`
- In `boot()` after `overlay.remove()`: `heroBody = assets.instance('hero.knight'); heroBody.getChildMeshes().forEach(m => m.isPickable = false); assets.playIdle(heroBody)`

- [ ] **Step 2: Update syncHero to the model**

`syncHero` (lines 85-91) keeps its logic; `heroNose` no longer exists. Confirm it reads:

```typescript
function syncHero() {
  heroBody.position.set(heroCtrl.pos.x, 0, heroCtrl.pos.z)
  heroBody.rotation.y = heroCtrl.yaw
  heroBody.setEnabled(rig.mode !== 'hero' && heroState.alive)
  rig.syncHero(heroCtrl.pos)
}
```

(Remove the `heroNose` line. `setEnabled` on a `TransformNode` cascades to children.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual verify — knight hero**

Run: `npm run dev`. In top view, a Knight model stands at the base instead of a yellow capsule; WASD moves it; it faces the aim direction; switching to first-person (Tab) hides it. It plays an idle animation.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: render hero as KayKit Knight model"
```

---

### Task 8: Projectile models

**Files:**
- Modify: `src/main.ts` (`spawnBall` + fire functions take a model key)

**Interfaces:**
- Consumes: `assets.instance('ammo.*')`.

- [ ] **Step 1: Add a model-or-fallback spawner**

In `src/main.ts`, add next to `spawnBall` (line 201):

```typescript
function spawnModelShot(key: string, x: number, y: number, z: number): TransformNode {
  const node = assets.instance(key)
  node.position.set(x, y, z)
  node.getChildMeshes().forEach((m) => (m.isPickable = false))
  return node
}
```

`Projectile.mesh` is typed `Mesh`; widen it to `TransformNode` (line 197: change `mesh: Mesh` → `mesh: TransformNode`). All existing `.position`, `.dispose()` calls are valid on `TransformNode`. Add `TransformNode` to the import on line 1.

- [ ] **Step 2: Use ammo models for tower + hero shots**

In `fireTowerShot` (line 206) replace the `spawnBall(...)` line with:

```typescript
  const key = kind === 'cannon' ? 'ammo.cannon' : kind === 'sniper' ? 'ammo.sniper' : 'ammo.slow'
  const ball = spawnModelShot(key, from.x, 1.2, from.z)
```

In `fireHeroShot` (line 213) replace the `spawnBall(...)` line with:

```typescript
  const ball = spawnModelShot('ammo.sniper', from.x, from.y, from.z)
```

Leave `fireEnemyShot` using `spawnBall` with the emissive sphere (reads as a magic bolt).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual verify — model projectiles**

Run: `npm run dev`, start a wave with a built tower.
Expected: cannon fires a cannonball model, sniper/ballista fires an arrow, hero fires an arrow; they fly to targets and deal damage exactly as before (timing unchanged); enemy shots remain small glowing spheres. Projectiles still stop at walls.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: render tower/hero projectiles as Kenney ammo models"
```

---

### Task 9: Solid decor props

**Files:**
- Modify: `src/main.ts` (`buildProp` for `rock`/`crate`/`wall`/`tree`)

**Interfaces:**
- Consumes: `assets.instance('prop.*')`.

- [ ] **Step 1: Swap solid prop visuals; keep AABB obstacles untouched**

In `src/main.ts` `buildProp` (lines 129-155), replace the four solid branches (`wall`, `rock`, `crate`, `tree`) with model instances scaled to the prop footprint. Keep `bush`/`mound`/`patch` exactly as they are. The obstacle list is built in `generateDecor` from `Prop.w/d` and is NOT affected by visuals.

```typescript
function buildProp(p: Prop) {
  const add = (m: { isPickable: boolean }) => { m.isPickable = false }
  const SOLID_KEY: Record<string, string> = { wall: 'prop.wall', rock: 'prop.rock', crate: 'prop.crate', tree: 'prop.tree' }
  const key = SOLID_KEY[p.kind]
  if (key) {
    const node = assets.instance(key)
    node.position.set(p.x, 0, p.z)
    node.rotation.y = p.rot
    // stretch the normalized model to roughly match the footprint/height
    const base = node.scaling.x
    node.scaling.set(base * (p.w / 1.5), base * (p.h / 1.5), base * (p.d / 1.5))
    node.getChildMeshes().forEach((m) => { m.isPickable = false })
    envProps.push(node)
    return
  }
  // ... existing bush / mound / patch branches unchanged ...
}
```

Add a module-scope `let envProps: TransformNode[] = []` next to `envMeshes` (line 62), and in `loadMap` teardown (line 162 area) dispose them: `for (const n of envProps) n.dispose(false, true); envProps = []`. The remaining primitive props still push to `envMeshes` via `add(m)`; keep those `envMeshes.push` calls in the unchanged branches.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Manual verify — props are models, collisions intact**

Run: `npm run dev`.
Expected: trees, rocks, walls, crates render as Kenney models; the hero still cannot walk through them (obstacle AABBs unchanged) and projectiles still stop at them; bushes/mounds/patches remain simple primitives. Reload the page — layout is identical (seeded), no leftover meshes after a map change.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: render solid decor (tree/rock/wall/crate) as Kenney models"
```

---

### Task 10: Base keep model + final pass

**Files:**
- Modify: `src/main.ts` (base marker → keep model)
- Modify: `README.md`

**Interfaces:**
- Consumes: `assets.instance('base.keep')`.

- [ ] **Step 1: Replace the base box with a keep model**

In `src/main.ts` `buildEnvironment` (lines 117-119), replace the `baseMesh` box block with:

```typescript
  const keep = assets.instance('base.keep')
  keep.position.set(level.base.x, 0, level.base.z)
  keep.getChildMeshes().forEach((m) => (m.isPickable = false))
  envProps.push(keep)
```

(Uses `envProps` from Task 9 so it is disposed on map change.)

- [ ] **Step 2: Document the asset pipeline in README**

Add a section to `README.md`:

```markdown
## Assets

3D models are CC0 from the Kenney Tower Defense Kit and KayKit (Adventurers, Skeletons).
Source kits live in `kenney_tower-defense-kit/` and `assets-src/` (gitignored).
Run `npm run assets` once to copy the used models into `public/models/` before `npm run dev`.
```

- [ ] **Step 3: Full verification run**

Run: `npm run assets && npm run typecheck && npm test && npm run dev`
Expected:
- typecheck passes, vitest passes (models + copy-assets tests).
- Loading overlay → game renders fully with: skeleton enemies (idle anim) walking the path, knight hero, 3D towers on cells, model projectiles, model props, a keep at the base.
- Play a full wave: build/upgrade towers, kill enemies, hero shoots — gold/lives behave exactly as pre-M1.
- Clear map 0 → map 1 loads with models intact; check `scene.meshes.length` in console is stable across the transition (no leaks).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts README.md
git commit -m "feat: render defended base as a Kenney keep model; document asset pipeline"
```

---

### Task 11: Strip cloned git history from source kits

**Files:**
- Delete: `assets-src/adventurers/.git`, `assets-src/skeletons/.git`

- [ ] **Step 1: Remove the shallow-clone `.git` dirs (~270MB, not needed)**

```bash
rm -rf assets-src/adventurers/.git assets-src/skeletons/.git
du -sh assets-src
```
Expected: `assets-src` shrinks to the model files only (a few MB of GLB + textures).

- [ ] **Step 2: Confirm assets still copy**

Run: `npm run assets && npx vitest run scripts/copy-assets.test.ts`
Expected: PASS (the script reads the GLBs, not `.git`).

(No commit needed if `assets-src/` is gitignored per Task 2.)

---

## Self-Review

**Spec coverage:**
- AssetManager (preload/instance/playIdle) → Task 3. ✓
- Model registry + normalize → Task 3 (`models.ts`). ✓
- `@babylonjs/loaders` + side-effect import → Task 1. ✓
- Kenney external `colormap.png` copied alongside → Task 2. ✓
- Async bootstrap + loading overlay → Task 4. ✓
- Enemy/Tower/Hero/Projectile/Decor/Base swaps → Tasks 5-10. ✓
- Idle anim (no T-pose) → Tasks 3,5,7. ✓
- Obstacle AABB unchanged → Task 9 (explicit). ✓
- Out-of-scope kept primitive (ground/road/cells/bush/mound/patch) → respected (Tasks 9 keeps passable primitives; ground/road/cells untouched). ✓
- Strip KayKit `.git` → Task 11. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. Tank model resolved (Warrior scaled). ✓

**Type consistency:** View constructors uniformly `(scene, assets, entity)`. `mesh` widened to `TransformNode` in `TowerView`, `EnemyView`, and `Projectile`. `assets.instance` returns `TransformNode` everywhere. `dispose(false, true)` used consistently for model roots. ✓

**Known impl-time checks flagged inline:** `LoadAssetContainerAsync` export name (Task 3 Step 6 fallback), `Enemy.heading` existence (Task 5 Step 1), `noUnusedLocals` ordering for `assets` (Task 4 Step 3). These are verification branches, not placeholders.
