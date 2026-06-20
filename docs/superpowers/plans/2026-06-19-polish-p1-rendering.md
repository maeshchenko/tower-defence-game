# Polish P1 — Rendering & Lighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat single-light render with a stylized-toon look — directional sun + soft shadows, glow, post-processing (FXAA/bloom/ACES tonemap), sky + fog — switchable via low/med/high quality presets, without touching gameplay.

**Architecture:** Two new isolated modules. `Quality.ts` is pure logic (preset → config, persisted to `localStorage`) and is unit-tested. `Environment.ts` owns all Babylon render setup (sun, `ShadowGenerator`, `GlowLayer`, `SSAO2`, `DefaultRenderingPipeline`, fog) and exposes `addShadowCaster` / `applyQuality`. `main.ts` wires them in and registers meshes as shadow casters as they spawn. The simulation (enemies/towers/hero) is untouched.

**Tech Stack:** Babylon.js 9 (`@babylonjs/core`), TypeScript, Vite, Vitest.

## Global Constraints

- Babylon.js `^9.13.0`, `@babylonjs/core` only (no new deps).
- TypeScript strict; `npm run typecheck` (tsc --noEmit) must stay green.
- Vitest env is `node` (`vitest.config.ts`) — pure-logic tests only; no real `localStorage`, no real WebGL. Use Babylon `NullEngine` for headless render smoke tests; inject a fake storage for `Quality.ts`.
- Default quality preset: `med`. Persist key: `td.quality`.
- Do not modify gameplay/sim modules (`enemies/`, `towers/Tower*.ts`, `hero/`, `core/`, `world/`). Render wiring lives in `main.ts` and the two new `rendering/` files. Touching view files (`EnemyView`/`TowerView`) is NOT required — `main.ts` registers casters via their public `.mesh`.
- Readability over beauty: fog thin, bloom emissive-only, hp-bars/damage-numbers stay legible.

---

## File Structure

- Create: `src/rendering/Quality.ts` — pure preset→config + load/save.
- Create: `tests/rendering/Quality.test.ts` — unit tests for the above.
- Create: `src/rendering/Environment.ts` — Babylon render env (sun/shadows/glow/ssao/pipeline/fog).
- Create: `tests/rendering/Environment.test.ts` — `NullEngine` smoke test (constructs, mutates, disposes without throwing).
- Modify: `src/main.ts` — construct `Environment`, lower the hemi fill, set ground receiver, register casters at spawn sites, preset-cycle key.

---

### Task 1: Quality presets (pure logic)

**Files:**
- Create: `src/rendering/Quality.ts`
- Test: `tests/rendering/Quality.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type QualityPreset = 'low' | 'med' | 'high'`
  - `interface QualityConfig { preset: QualityPreset; fxaa: boolean; bloom: boolean; shadows: boolean; shadowMapSize: number; ssao: boolean; glow: boolean; fog: boolean }`
  - `const QUALITY_ORDER: QualityPreset[]` = `['low','med','high']`
  - `function resolveQuality(preset: QualityPreset): QualityConfig`
  - `function nextPreset(p: QualityPreset): QualityPreset` (wraps low→med→high→low)
  - `type MiniStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void }`
  - `function loadPreset(storage?: MiniStorage): QualityPreset` (missing/invalid/no-storage → `'med'`)
  - `function savePreset(p: QualityPreset, storage?: MiniStorage): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/rendering/Quality.test.ts
import { describe, it, expect } from 'vitest'
import { resolveQuality, nextPreset, loadPreset, savePreset, QUALITY_ORDER, MiniStorage } from '../../src/rendering/Quality'

function fakeStore(init: Record<string, string> = {}): MiniStorage {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) } }
}

describe('resolveQuality', () => {
  it('low: no shadows, no bloom, no ssao, fxaa+glow+fog on', () => {
    const c = resolveQuality('low')
    expect(c).toMatchObject({ preset: 'low', shadows: false, bloom: false, ssao: false, fxaa: true, glow: true, fog: true, shadowMapSize: 0 })
  })
  it('med: shadows@1024 + bloom, no ssao', () => {
    const c = resolveQuality('med')
    expect(c).toMatchObject({ preset: 'med', shadows: true, shadowMapSize: 1024, bloom: true, ssao: false })
  })
  it('high: shadows@2048 + bloom + ssao', () => {
    const c = resolveQuality('high')
    expect(c).toMatchObject({ preset: 'high', shadows: true, shadowMapSize: 2048, bloom: true, ssao: true })
  })
})

describe('nextPreset', () => {
  it('cycles low→med→high→low', () => {
    expect(nextPreset('low')).toBe('med')
    expect(nextPreset('med')).toBe('high')
    expect(nextPreset('high')).toBe('low')
  })
  it('order constant matches', () => {
    expect(QUALITY_ORDER).toEqual(['low', 'med', 'high'])
  })
})

describe('load/save', () => {
  it('round-trips a saved preset', () => {
    const s = fakeStore()
    savePreset('high', s)
    expect(loadPreset(s)).toBe('high')
  })
  it('defaults to med when missing', () => {
    expect(loadPreset(fakeStore())).toBe('med')
  })
  it('defaults to med on garbage', () => {
    expect(loadPreset(fakeStore({ 'td.quality': 'ultra' }))).toBe('med')
  })
  it('defaults to med with no storage', () => {
    expect(loadPreset(undefined)).toBe('med')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rendering/Quality.test.ts`
Expected: FAIL — cannot find module `src/rendering/Quality`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rendering/Quality.ts
export type QualityPreset = 'low' | 'med' | 'high'

export interface QualityConfig {
  preset: QualityPreset
  fxaa: boolean
  bloom: boolean
  shadows: boolean
  shadowMapSize: number // 0 when shadows off
  ssao: boolean
  glow: boolean
  fog: boolean
}

export type MiniStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const QUALITY_ORDER: QualityPreset[] = ['low', 'med', 'high']
const STORAGE_KEY = 'td.quality'

export function resolveQuality(preset: QualityPreset): QualityConfig {
  const base = { preset, fxaa: true, glow: true, fog: true }
  switch (preset) {
    case 'low': return { ...base, bloom: false, shadows: false, shadowMapSize: 0, ssao: false }
    case 'high': return { ...base, bloom: true, shadows: true, shadowMapSize: 2048, ssao: true }
    case 'med':
    default: return { ...base, preset: 'med', bloom: true, shadows: true, shadowMapSize: 1024, ssao: false }
  }
}

export function nextPreset(p: QualityPreset): QualityPreset {
  const i = QUALITY_ORDER.indexOf(p)
  return QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length]
}

function getStore(s?: MiniStorage): MiniStorage | undefined {
  if (s) return s
  try { return typeof localStorage !== 'undefined' ? localStorage : undefined } catch { return undefined }
}

export function loadPreset(storage?: MiniStorage): QualityPreset {
  const s = getStore(storage)
  const v = s?.getItem(STORAGE_KEY)
  return v === 'low' || v === 'med' || v === 'high' ? v : 'med'
}

export function savePreset(p: QualityPreset, storage?: MiniStorage): void {
  const s = getStore(storage)
  try { s?.setItem(STORAGE_KEY, p) } catch { /* storage unavailable — ignore */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rendering/Quality.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/rendering/Quality.ts tests/rendering/Quality.test.ts
git commit -m "feat(render): quality preset resolver (P1)"
```

---

### Task 2: Environment module (Babylon render env)

**Files:**
- Create: `src/rendering/Environment.ts`
- Test: `tests/rendering/Environment.test.ts`

**Interfaces:**
- Consumes: `QualityConfig` from Task 1.
- Produces:
  - `class Environment`
    - `constructor(scene: Scene, fill: HemisphericLight, cfg: QualityConfig)`
    - `readonly sun: DirectionalLight`
    - `setReceiver(mesh: AbstractMesh): void`
    - `addShadowCaster(node: TransformNode): void`
    - `applyQuality(cfg: QualityConfig): void`
    - `dispose(): void`

**Behavior notes:**
- Constructor creates: directional `sun`, a `DefaultRenderingPipeline` (HDR, over `scene.cameras`), a `GlowLayer`, sets `scene.clearColor`/fog, lowers/tints the passed `fill`. Shadows + SSAO are created by `applyQuality` so the same path handles runtime switching.
- `addShadowCaster` records the node in an internal list AND (if a shadow generator currently exists) adds each child mesh to it. `applyQuality` rebuilds the generator and re-adds all recorded casters, so registration order vs. preset changes doesn't matter.
- SSAO2 is guarded by `SSAO2RenderingPipeline.IsSupported`.

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/rendering/Environment.test.ts
import { describe, it, expect } from 'vitest'
import { NullEngine, Scene, HemisphericLight, ArcRotateCamera, Vector3, MeshBuilder, TransformNode } from '@babylonjs/core'
import { Environment } from '../../src/rendering/Environment'
import { resolveQuality } from '../../src/rendering/Quality'

function makeScene() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  // a camera so DefaultRenderingPipeline has a target
  new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
  const fill = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
  return { engine, scene, fill }
}

describe('Environment', () => {
  it('constructs, registers a caster, switches presets, and disposes without throwing', () => {
    const { scene, fill } = makeScene()
    const env = new Environment(scene, fill, resolveQuality('med'))
    const ground = MeshBuilder.CreateGround('g', { width: 4, height: 4 }, scene)
    env.setReceiver(ground)
    const node = new TransformNode('n', scene)
    MeshBuilder.CreateBox('b', { size: 1 }, scene).parent = node
    expect(() => env.addShadowCaster(node)).not.toThrow()
    expect(() => env.applyQuality(resolveQuality('high'))).not.toThrow()
    expect(() => env.applyQuality(resolveQuality('low'))).not.toThrow()
    expect(() => env.dispose()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rendering/Environment.test.ts`
Expected: FAIL — cannot find module `src/rendering/Environment`.

- [ ] **Step 3: Write the implementation**

```ts
// src/rendering/Environment.ts
import {
  Scene, DirectionalLight, HemisphericLight, ShadowGenerator, GlowLayer,
  DefaultRenderingPipeline, SSAO2RenderingPipeline, ImageProcessingConfiguration,
  Vector3, Color3, Color4, AbstractMesh, TransformNode,
} from '@babylonjs/core'
import { QualityConfig } from './Quality'

const SKY = new Color3(0.49, 0.67, 0.86) // toon sky blue; reused for clear + fog

export class Environment {
  readonly sun: DirectionalLight
  private pipeline: DefaultRenderingPipeline
  private glow: GlowLayer | null = null
  private shadowGen: ShadowGenerator | null = null
  private ssao: SSAO2RenderingPipeline | null = null
  private casters: TransformNode[] = []
  private receivers: AbstractMesh[] = []

  constructor(private scene: Scene, private fill: HemisphericLight, cfg: QualityConfig) {
    // warm directional sun (key light) — angled for short, readable shadows
    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.45), scene)
    this.sun.position = new Vector3(25, 45, 25)
    this.sun.intensity = 1.05
    this.sun.diffuse = new Color3(1, 0.96, 0.86)

    // hemi becomes cool ambient fill so shadows aren't pure black
    this.fill.intensity = 0.45
    this.fill.diffuse = new Color3(0.85, 0.9, 1)
    this.fill.groundColor = new Color3(0.35, 0.4, 0.3)
    this.fill.specular = new Color3(0, 0, 0)

    // sky + fog for depth
    scene.clearColor = new Color4(SKY.r, SKY.g, SKY.b, 1)
    scene.fogColor = SKY.clone()

    // post: HDR pipeline over all cameras (top + hero)
    this.pipeline = new DefaultRenderingPipeline('default', true, scene, scene.cameras)
    const ip = this.pipeline.imageProcessing
    ip.toneMappingEnabled = true
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    ip.exposure = 1.1
    ip.contrast = 1.15
    this.pipeline.bloomThreshold = 0.75
    this.pipeline.bloomWeight = 0.5
    this.pipeline.bloomScale = 0.5

    this.applyQuality(cfg)
  }

  setReceiver(mesh: AbstractMesh): void {
    mesh.receiveShadows = true
    if (!this.receivers.includes(mesh)) this.receivers.push(mesh)
  }

  addShadowCaster(node: TransformNode): void {
    if (!this.casters.includes(node)) this.casters.push(node)
    if (this.shadowGen) for (const m of node.getChildMeshes(false)) this.shadowGen.addShadowCaster(m, true)
  }

  applyQuality(cfg: QualityConfig): void {
    // post toggles
    this.pipeline.fxaaEnabled = cfg.fxaa
    this.pipeline.bloomEnabled = cfg.bloom

    // glow layer
    if (cfg.glow && !this.glow) { this.glow = new GlowLayer('glow', this.scene); this.glow.intensity = 0.7 }
    else if (!cfg.glow && this.glow) { this.glow.dispose(); this.glow = null }

    // shadows: rebuild generator at the requested size, then re-add every caster
    if (this.shadowGen) { this.shadowGen.dispose(); this.shadowGen = null }
    if (cfg.shadows) {
      const sg = new ShadowGenerator(cfg.shadowMapSize, this.sun)
      sg.usePercentageCloserFiltering = true
      sg.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
      sg.bias = 0.002
      this.shadowGen = sg
      for (const n of this.casters) for (const m of n.getChildMeshes(false)) sg.addShadowCaster(m, true)
    }

    // SSAO (high only, and only where supported)
    if (cfg.ssao && !this.ssao && SSAO2RenderingPipeline.IsSupported) {
      this.ssao = new SSAO2RenderingPipeline('ssao', this.scene, { ssaoRatio: 0.75, blurRatio: 1 }, this.scene.cameras)
    } else if (!cfg.ssao && this.ssao) {
      this.ssao.dispose(this.scene.cameras as any); this.ssao = null
    }

    // fog
    this.scene.fogMode = cfg.fog ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE
    this.scene.fogDensity = 0.011
  }

  dispose(): void {
    this.ssao?.dispose(this.scene.cameras as any)
    this.glow?.dispose()
    this.shadowGen?.dispose()
    this.pipeline.dispose()
    this.sun.dispose()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rendering/Environment.test.ts`
Expected: PASS (no throw across construct → caster → preset switches → dispose).
If `NullEngine` lacks SSAO support, `IsSupported` is false and that branch is skipped — test still passes.

- [ ] **Step 5: Full suite + typecheck + commit**

```bash
npm run typecheck && npx vitest run
git add src/rendering/Environment.ts tests/rendering/Environment.test.ts
git commit -m "feat(render): Environment — sun, shadows, glow, post-fx, fog (P1)"
```

---

### Task 3: Wire Environment into main.ts (lighting + post-fx, no casters yet)

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Environment` (Task 2), `resolveQuality`/`loadPreset`/`savePreset`/`nextPreset`/`QualityPreset` (Task 1).
- Produces: module-level `let env: Environment` available to later caster-registration code (Task 4).

This task makes the scene visibly post-processed and sky/fog-lit. Shadows will switch on but cast nothing until Task 4 registers casters — that's expected and independently reviewable (you should already see sky color, fog, tonemapping, and bloom on projectiles).

- [ ] **Step 1: Add imports**

At the top of `src/main.ts`, alongside the existing `@babylonjs/core` import, add the new module imports:

```ts
import { Environment } from './rendering/Environment'
import { loadPreset, savePreset, nextPreset, resolveQuality, QualityPreset } from './rendering/Quality'
```

- [ ] **Step 2: Construct Environment after the ground/walls block**

In `src/main.ts`, the hemi `light`, `ground`, and perimeter `wall` loop are created near the top (around lines 180-191). Immediately AFTER the wall loop and AFTER `ground` exists, add:

```ts
// stylized-toon render env (sun, soft shadows, glow, post-fx, fog) — quality-gated
let quality: QualityPreset = loadPreset()
const env = new Environment(scene, light, resolveQuality(quality))
env.setReceiver(ground)
```

(`light` is the existing `HemisphericLight`; `Environment` lowers/tints it.)

- [ ] **Step 3: Add a preset-cycle key**

Find the existing `addEventListener('keydown', ...)` handler (around line 583, where `Tab`/`Enter`/`m` are handled). Add a branch for `q`:

```ts
  if (e.key === 'q' || e.key === 'Q' || e.key === 'й') {
    quality = nextPreset(quality)
    env.applyQuality(resolveQuality(quality))
    savePreset(quality)
    flash(`Качество: ${quality}`)
  }
```

(`flash(msg)` already exists in `main.ts` as the toast helper.)

- [ ] **Step 4: Update the legend hint**

In the `legend.innerHTML = ...` block (around line 674), append a hint about the new key. Change the final line to include `· Q — качество`:

```ts
  `волны сами · Enter — сразу · Tab — сверху/сзади (3-е лицо) · Q — качество`
```

- [ ] **Step 5: Typecheck + manual browser verify**

```bash
npm run typecheck
npm run dev
```
Open the served URL. Expected:
- Sky is blue (not black/default), distant edges fade into matching fog.
- Colors look warmer/contrastier (ACES tonemap); projectiles/muzzle flashes glow (bloom).
- Pressing `Q` cycles `low → med → high` with a toast; reload keeps the last preset.
- Gameplay unchanged; framerate smooth on `med`.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(render): wire Environment into main — sky, fog, post-fx, preset key (P1)"
```

---

### Task 4: Register shadow casters at every spawn site

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `env` (Task 3), public `.mesh` on `EnemyView`/`TowerView`, `heroBody`, and the env-prop `TransformNode`s built in `buildEnvironment`/`buildProp`.
- Produces: nothing new; completes the shadow pipeline.

No view-class signatures change — `main.ts` registers each view's `.mesh` right after it constructs the view.

- [ ] **Step 1: Hero caster**

In `makeHero()` (around line 235), after `heroBody = assets.instance('hero.knight')` and the `getChildMeshes` line, add:

```ts
  env.addShadowCaster(heroBody)
```

- [ ] **Step 2: Enemy casters**

In the wave-spawn loop inside `onBeforeRenderObservable` (around line 619), the current line is:

```ts
      for (const e of wm.update(dt)) views.set(e, new EnemyView(scene, assets, e))
```

Replace it with:

```ts
      for (const e of wm.update(dt)) {
        const v = new EnemyView(scene, assets, e)
        env.addShadowCaster(v.mesh)
        views.set(e, v)
      }
```

- [ ] **Step 3: Tower casters**

In `scene.onPointerDown` (around line 609), the build branch is:

```ts
  if (t) { towerViews.set(t, new TowerView(scene, assets, t)); sfx.build() }
```

Replace with:

```ts
  if (t) { const tv = new TowerView(scene, assets, t); env.addShadowCaster(tv.mesh); towerViews.set(t, tv); sfx.build() }
```

- [ ] **Step 4: Base + solid-prop casters**

In `buildEnvironment()` (around line 303), after the base keep is created and parented:

```ts
  const keep = assets.instance('base.keep')
  keep.position.set(level.base.x, 0, level.base.z)
  keep.getChildMeshes().forEach((m) => (m.isPickable = false))
  env.addShadowCaster(keep)            // <-- add this line
  envProps.push(keep)
```

In `buildProp()` (around line 320), inside the `if (key) { ... }` solid-prop branch, after `node.getChildMeshes().forEach(...)` and before `envProps.push(node)`:

```ts
    env.addShadowCaster(node)
```

(Only the solid props — `wall`/`rock`/`crate`/`tree` — cast; the soft bush/mound/patch primitives below are left out on purpose.)

- [ ] **Step 5: Typecheck + manual browser verify**

```bash
npm run typecheck
npm run dev
```
Expected on `med`/`high`:
- Hero, enemies, towers, base, and solid props cast soft shadows onto the ground.
- New enemies spawning mid-wave also have shadows (dynamic registration works).
- Press `Q` to `low`: shadows vanish; back to `med`/`high`: they return.
- hp-bars and floating damage numbers still readable over the shadowed scene.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(render): register hero/enemy/tower/prop shadow casters (P1)"
```

---

### Task 5: Toon tuning pass — ground, color, fog balance

**Files:**
- Modify: `src/main.ts` (ground material near line 184), and tune constants in `src/rendering/Environment.ts`.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new — a values-only polish/readability pass.

This is the "make it sing without breaking readability" pass: dial exposure/contrast/bloom/fog so the scene is vibrant but enemies and UI stay legible. No new behavior.

- [ ] **Step 1: Warmer, less-flat ground**

In `src/main.ts`, the ground material (around line 184) is currently:

```ts
const gm = new StandardMaterial('g', scene); gm.diffuseColor = new Color3(0.2,0.45,0.2)
```

Make it a touch brighter/saturated so the sun reads on it, and kill specular glare:

```ts
const gm = new StandardMaterial('g', scene)
gm.diffuseColor = new Color3(0.26, 0.5, 0.24)
gm.specularColor = new Color3(0, 0, 0)
```

- [ ] **Step 2: Tune env constants for readability**

In `src/rendering/Environment.ts`, verify/adjust these so bloom only catches emissive FX and fog doesn't hide the field. Confirmed target values (keep unless browser check says otherwise):
- `ip.exposure = 1.1`, `ip.contrast = 1.15`
- `this.pipeline.bloomThreshold = 0.75` (raise toward 0.9 if non-emissive surfaces bloom)
- `this.scene.fogDensity = 0.011` (lower toward 0.007 if the far path is hard to read)
- `this.sun.intensity = 1.05`, `this.fill.intensity = 0.45` (raise fill if shadows look too dark)

- [ ] **Step 3: Manual browser verify (readability checklist)**

```bash
npm run dev
```
Walk the full checklist from the spec §8:
- Shadows present under hero/enemies/towers; not crawling/acne (raise `bias` if so).
- Bloom only on projectiles/flashes/base crystal — not on grass/walls.
- Fog adds depth but the whole path from spawn to base stays clearly visible.
- hp-bars + damage numbers legible in both top-down and third-person.
- `low`/`med`/`high` all look acceptable and switch cleanly; FPS fine on `med`.

- [ ] **Step 4: Full suite + typecheck + commit**

```bash
npm run typecheck && npx vitest run
git add src/main.ts src/rendering/Environment.ts
git commit -m "polish(render): toon tuning — ground, exposure, bloom, fog (P1)"
```

---

## Self-Review

**Spec coverage (P1 spec §1–§10):**
- Directional sun + soft shadows → Tasks 2, 4. ✓
- Hemi ambient fill retained/lowered → Task 2 (ctor), Task 3 (passes `light`). ✓
- Post-fx FXAA/bloom/ACES/exposure → Task 2 + Task 5 tuning. ✓
- GlowLayer on emissive → Task 2. ✓
- SSAO2 high-only + supported-guard → Task 2 (`applyQuality`). ✓
- Sky + exp2 fog → Task 2, balanced in Task 5. ✓
- Ground material upgrade → Task 5. ✓
- Quality presets low/med/high + localStorage persist → Task 1, switched in Task 3. ✓
- Caster registration at all spawn sites (§4, §7) → Task 4. ✓
- Readability guard (§2) → Task 5 checklist. ✓
- Testing (§8): pure unit on `Quality.ts` (Task 1), NullEngine smoke on `Environment` (Task 2), manual browser checklist (Tasks 3–5). ✓
- Risks (§9): dynamic casters (Task 4 step 2), SSAO×glow + perf (Task 2 guards, presets), tint compat (left untouched). ✓

**Placeholder scan:** none — every code/command step is concrete.

**Type consistency:** `addShadowCaster(node: TransformNode)`, `setReceiver(mesh: AbstractMesh)`, `applyQuality(cfg: QualityConfig)`, `resolveQuality`/`nextPreset`/`loadPreset`/`savePreset`/`QualityPreset` used identically across Tasks 1–4. `Environment(scene, fill, cfg)` ctor matches its call in Task 3. `.mesh` is the real public field on `EnemyView`/`TowerView`. ✓
