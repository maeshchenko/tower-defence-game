# Production Look «Парящий остров» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить визуал TD-игры из «сырой демки» (квадрат в синей пустоте, свободная орбита-камера, программерские примитивы) в цельный коммерческий «парящий остров над морем облаков», читаемый и сверху, и от третьего лица.

**Architecture:** Чисто презентационный слой поверх существующего Babylon.js рендера. Камера переписывается в фикс-изо с 4 пресет-углами. Плоская земля дополняется парящим островом-мезой + skybox-куполом + дальним горизонтом. Программерские примитивы (синие клетки, сферы-кусты, плоские патчи) заменяются ассетами Kenney. Поверх — грейдинг, виньетка, опц. DOF, дрейф облаков. Геймплей/волны/башни-логика/аудио не трогаются.

**Tech Stack:** TypeScript, Babylon.js (`@babylonjs/core`), Vite, Vitest. Ассеты: Kenney tower-defense kit (GLB), KayKit.

## Global Constraints

- **Babylon API:** только `@babylonjs/core` (+ `@babylonjs/loaders` уже подключён). Никаких новых npm-пакетов без явного согласования (исключает `@babylonjs/materials` GradientMaterial — градиент делаем через `DynamicTexture`).
- **Игровые границы поля не двигать:** невидимые стены 40×40 (`main.ts:97-100`) и `checkCollisions` остаются. Остров/скирт — чисто визуальные, строятся вокруг этой границы.
- **Перф через Quality-пресеты:** любая новая тяжёлая графика (DOF, облака-кол-во, дальние острова) гейтится через `QualityConfig` (`src/rendering/Quality.ts`) — `low` не должен получить тяжести.
- **Atlas mis-sample:** новые Kenney GLB могут рендериться фиолетовыми под Babylon-лоадером — красить плоским `tint` (см. `models.ts:9-12`), как уже сделано для тайлов/башен.
- **Ассеты:** приоритет — существующий кит (`kenney_tower-defense-kit/Models/GLB format`). Новые модели добавляются в `scripts/copy-assets.mjs` и копируются `npm run assets`. Скачивание новых CC0-ассетов разрешено только если кита не хватает (облака/skybox — делаем процедурно, скачивание не требуется).
- **Коммиты — на усмотрение пользователя.** План НЕ инструктирует коммитить; вместо коммит-шагов — «Checkpoint» (typecheck + визуальная проверка). Пользователь сам решает, когда фиксировать в git.
- **Спек:** `docs/superpowers/specs/2026-06-20-production-look-sky-island-design.md`.

## Verification model

Рендер-код плохо покрывается юнит-тестами. Поэтому:
- **Чистая логика** (preset-углы камеры, дрейф облаков, параметры геометрии) выносится в pure-модули и покрывается **Vitest** (`*.test.ts` рядом, как `src/rendering/models.test.ts`).
- **Визуал** проверяется в браузере: dev-сервер уже запущен на `http://localhost:5177/` (если нет — `npm run dev`). Проверка через chrome-devtools MCP: `new_page` → клик «Играть» (`evaluate_script`) → `take_screenshot` → глазами сверить критерий. Критерии приёмки в каждой визуальной задаче конкретны.

## File Structure

- **Create** `src/camera/CameraPresets.ts` — pure: массив пресет-альф, выбор ближайшего/следующего, eased lerp угла. Тестируемо.
- **Create** `src/camera/CameraPresets.test.ts` — тесты пресет-логики.
- **Modify** `src/camera/CameraRig.ts` — топ-камера: фикс-изо, отключить орбиту/пан, оставить зум, 4 пресета, плавный `update(dt)`.
- **Create** `src/rendering/Sky.ts` — skybox-купол (DynamicTexture-градиент), дальние острова-силуэты, облака-биллборды + их дрейф. Гейт по Quality.
- **Create** `src/rendering/Sky.test.ts` — тест дрейфа/раскладки облаков (pure-хелперы).
- **Create** `src/world/Island.ts` — процедурная гео мезы (скальный фрустум + травяной скирт + каменная кромка/парапет). Чисто визуальная, не трогает коллизию.
- **Modify** `src/rendering/Environment.ts` — грейдинг/виньетка/DOF, перекраска тумана, владение Sky-объектом + quality-гейт DOF/облаков.
- **Modify** `src/rendering/models.ts` — новые ключи: `cell.pad`, `decor.crystal`, `decor.crystalSmall`, `decor.dirt`, `tile.roadCorner`.
- **Modify** `scripts/copy-assets.mjs` — добавить новые Kenney GLB в копирование.
- **Modify** `src/main.ts` — клетки/кусты/патчи/дорога-углы/хижина на ассеты; интеграция Island + Sky + CameraRig.update; ребинд клавиш поворота камеры; обновить легенду.

---

## Phase 1 — Камера: фикс-изо + 4 пресета + зум

### Task 1: Pure preset-логика камеры

**Files:**
- Create: `src/camera/CameraPresets.ts`
- Test: `src/camera/CameraPresets.test.ts`

**Interfaces:**
- Produces:
  - `ISO_BETA: number` — фикс-наклон изо-камеры (рад).
  - `PRESET_ALPHAS: number[]` — 4 диагональных угла обзора (рад), по углам квадратной карты.
  - `nextPresetAlpha(currentAlpha: number, dir: 1 | -1): number` — целевая альфа следующего/предыдущего пресета (с учётом wrap), монотонно относительно `currentAlpha` (не «прыгает» через 2π).
  - `easeAlpha(current: number, target: number, dt: number, rate?: number): number` — экспоненциальный lerp угла к target по кратчайшей дуге.

- [ ] **Step 1: Failing test**

```ts
// src/camera/CameraPresets.test.ts
import { describe, it, expect } from 'vitest'
import { ISO_BETA, PRESET_ALPHAS, nextPresetAlpha, easeAlpha } from './CameraPresets'

describe('CameraPresets', () => {
  it('iso beta is a fixed tilt above the ground (between horizon and top-down)', () => {
    expect(ISO_BETA).toBeGreaterThan(0.4)
    expect(ISO_BETA).toBeLessThan(1.3)
  })

  it('has 4 diagonal presets a quarter-turn apart', () => {
    expect(PRESET_ALPHAS).toHaveLength(4)
    const sorted = [...PRESET_ALPHAS].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeCloseTo(Math.PI / 2, 5)
    }
  })

  it('nextPresetAlpha advances ~90deg in the requested direction without wrap jumps', () => {
    const a = PRESET_ALPHAS[0]
    const fwd = nextPresetAlpha(a, 1)
    expect(fwd - a).toBeCloseTo(Math.PI / 2, 5)
    const back = nextPresetAlpha(a, -1)
    expect(a - back).toBeCloseTo(Math.PI / 2, 5)
  })

  it('easeAlpha moves toward target and reaches it', () => {
    let cur = 0
    const target = 1
    for (let i = 0; i < 600; i++) cur = easeAlpha(cur, target, 1 / 60)
    expect(cur).toBeCloseTo(target, 2)
  })

  it('easeAlpha takes the short way around the circle', () => {
    // target just past +pi should move negatively (short arc), not +almost-2pi
    const next = easeAlpha(0.1, 0.1 + Math.PI + 0.2, 1 / 60)
    expect(next).toBeLessThan(0.1) // went negative (short arc)
  })
})
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/camera/CameraPresets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/camera/CameraPresets.ts
// Pure camera-preset math (no Babylon) so it unit-tests.

// Fixed iso tilt: high enough to read the board, low enough to feel 3D (not top-down).
export const ISO_BETA = 0.95

// Four diagonal corner views of a square map, a quarter-turn apart.
export const PRESET_ALPHAS = [
  Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4,
]

// Target alpha one preset step away in `dir`, expressed relative to `current`
// so easeAlpha takes a clean 90deg arc (no 2pi wrap jump).
export function nextPresetAlpha(current: number, dir: 1 | -1): number {
  return current + dir * (Math.PI / 2)
}

// Shortest-arc angular difference in (-pi, pi].
function shortDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

// Exponential ease of an angle toward target along the short arc.
export function easeAlpha(current: number, target: number, dt: number, rate = 8): number {
  const d = shortDelta(current, target)
  const k = 1 - Math.exp(-rate * dt)
  return current + d * k
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/camera/CameraPresets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck` → no errors.

---

### Task 2: CameraRig — фикс-изо, отключить орбиту, оставить зум, пресеты

**Files:**
- Modify: `src/camera/CameraRig.ts`

**Interfaces:**
- Consumes: `ISO_BETA`, `PRESET_ALPHAS`, `nextPresetAlpha`, `easeAlpha` from Task 1.
- Produces (on `CameraRig`):
  - `rotatePreset(dir: 1 | -1): void` — крутит топ-камеру к соседнему пресету (только в режиме `top`).
  - `update(dt: number): void` — каждый кадр eases топ-камеру к целевой альфе.
  - неизменными остаются: `toggle()`, `syncHero()`, `mode`, `heroCam`, `topCam`.

- [ ] **Step 1: Заменить конструктор top-камеры и ввести фикс-изо + пресеты**

Заменить в `src/camera/CameraRig.ts` импорт и поля/конструктор `topCam`:

```ts
import { Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core'
import { Vec3 } from '../core/Vec3'
import { ISO_BETA, PRESET_ALPHAS, nextPresetAlpha, easeAlpha } from './CameraPresets'
```

В классе добавить поля:

```ts
  private topTargetAlpha = PRESET_ALPHAS[0]
```

Заменить создание `topCam` (сейчас `CameraRig.ts:14-15`) на:

```ts
    this.topCam = new ArcRotateCamera('top', PRESET_ALPHAS[0], ISO_BETA, 45, Vector3.Zero(), scene)
    this.topCam.attachControl(canvas, true)
    // lock tilt to the iso preset; no free orbit/pan — only wheel zoom remains
    this.topCam.lowerBetaLimit = ISO_BETA; this.topCam.upperBetaLimit = ISO_BETA
    this.topCam.lowerRadiusLimit = 30; this.topCam.upperRadiusLimit = 58
    // remove pointer rotate/pan input; keep the mouse-wheel zoom input
    this.topCam.inputs.removeByType('ArcRotateCameraPointersInput')
    this.topCam.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')
```

- [ ] **Step 2: Добавить методы `rotatePreset` и `update`**

Добавить в класс (например, после `toggle()`):

```ts
  // rotate the top-down camera to the neighbouring 90deg preset (top mode only)
  rotatePreset(dir: 1 | -1): void {
    if (this.mode !== 'top') return
    this.topTargetAlpha = nextPresetAlpha(this.topTargetAlpha, dir)
  }

  // per-frame: ease the top camera toward its target preset angle
  update(dt: number): void {
    if (this.mode !== 'top') return
    this.topCam.alpha = easeAlpha(this.topCam.alpha, this.topTargetAlpha, dt)
  }
```

- [ ] **Step 3: При входе в top-режим синхронизировать target с текущей альфой**

В методе `toggle()`, в ветке `this.mode = 'top'` (после `this.scene.activeCamera = this.topCam`), добавить:

```ts
      this.topTargetAlpha = this.topCam.alpha // avoid a jump back to preset[0]
```

- [ ] **Step 4: Checkpoint**

Run: `npm run typecheck`
Expected: no errors. (Если `removeByType` ругается на имя — проверить точные строки: Babylon input class names `ArcRotateCameraPointersInput`, `ArcRotateCameraKeyboardMoveInput`.)

---

### Task 3: Привязать поворот камеры к клавишам + кнопкам + обновить легенду

**Files:**
- Modify: `src/main.ts` (keydown `:616-631`, render loop `:704`, legend `:788-794`)

**Interfaces:**
- Consumes: `rig.rotatePreset`, `rig.update` from Task 2.

- [ ] **Step 1: Вызывать `rig.update(realDt)` каждый кадр**

В `scene.onBeforeRenderObservable` (после строки `const realDt = engine.getDeltaTime() / 1000`, `main.ts:706`) добавить:

```ts
  rig.update(realDt)
```

- [ ] **Step 2: Ребинд клавиш — Q/E поворот камеры; снять Q с качества**

В обработчике `keydown` (`main.ts:616-631`) удалить блок `if (e.key === 'q' ...)` качества и заменить на поворот:

```ts
  if (e.key === 'q' || e.key === 'Q' || e.key === 'й') rig.rotatePreset(-1)
  if (e.key === 'e' || e.key === 'E' || e.key === 'у') rig.rotatePreset(1)
```

(Качество остаётся доступным через шестерёнку-Settings — `settings.mount()` уже даёт UI выбора пресета. Хоткей Q убран осознанно.)

- [ ] **Step 3: Экранные кнопки поворота (низ-лево, рядом со Speed)**

После `document.body.appendChild(legend)` (`main.ts:794`) добавить:

```ts
// camera rotate buttons (top-down only)
const rotBar = document.createElement('div')
rotBar.style.cssText = 'position:fixed;left:8px;bottom:60px;display:flex;gap:6px;z-index:6'
for (const [label, dir] of [['⟲', -1], ['⟳', 1]] as const) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = 'font-family:monospace;font-size:18px;width:38px;height:38px;cursor:pointer;' +
    'border:2px solid #ffd24d;background:#1b2330;color:#ffd24d;border-radius:6px'
  b.onclick = () => rig.rotatePreset(dir)
  rotBar.appendChild(b)
}
document.body.appendChild(rotBar)
// hide rotate buttons in third-person
const origToggleVis = () => { rotBar.style.display = rig.mode === 'top' ? 'flex' : 'none' }
```

И в `keydown` Tab-ветке (`main.ts:617-620`), после `rig.toggle()`, добавить `origToggleVis()`.

- [ ] **Step 4: Обновить легенду**

Заменить последнюю строку `legend.innerHTML` (`main.ts:790-793`), строку с `Tab — вид · Q — качество · M — звук` на:

```
Tab — вид · Q/E — поворот · M — звук
```

- [ ] **Step 5: Checkpoint — визуальная проверка**

1. `npm run typecheck` → clean.
2. Браузер `http://localhost:5177/` → «Играть».
3. Критерии:
   - Камера стоит на чистом изо-диагональном ракурсе (не косой случайный угол).
   - Перетаскивание мышью НЕ вращает и НЕ наклоняет сцену (орбита убрана).
   - Колесо мыши зумит в пределах (не улетает в космос/в землю).
   - Q/E (и кнопки ⟲/⟳) плавно поворачивают карту на 90° между 4 углами.
   - Под пол/в синь нырнуть нельзя.

---

## Phase 2 — Остров + небо

### Task 4: Процедурный остров-меза (скальный фрустум + травяной скирт)

**Files:**
- Create: `src/world/Island.ts`
- Modify: `src/main.ts` (после создания `ground`, `main.ts:90-94`)

**Interfaces:**
- Produces: `buildIsland(scene: Scene): TransformNode` — создаёт парящую мезу под игровой плоскостью (верх травы на y≈0), возвращает корневой узел (чтобы можно было не диспозить между картами — остров общий).

- [ ] **Step 1: Реализовать `buildIsland`**

```ts
// src/world/Island.ts
import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh } from '@babylonjs/core'

// A floating hex mesa sitting under the 40x40 play plane: a tapered rock frustum
// plus a thin grass apron so the play surface reads as the top of a real island,
// not a square cut floating in the void. Purely visual — no collision.
export function buildIsland(scene: Scene): TransformNode {
  const root = new TransformNode('island', scene)

  const rock = new StandardMaterial('islandRock', scene)
  rock.diffuseColor = new Color3(0.42, 0.36, 0.3)
  rock.specularColor = new Color3(0, 0, 0)

  const grassSide = new StandardMaterial('islandGrassSide', scene)
  grassSide.diffuseColor = new Color3(0.3, 0.5, 0.26)
  grassSide.specularColor = new Color3(0, 0, 0)

  // grass apron: short hex prism whose top sits just below y=0 (play plane covers it)
  const apron = MeshBuilder.CreateCylinder('islandApron',
    { diameterTop: 62, diameterBottom: 58, height: 2.2, tessellation: 6 }, scene)
  apron.material = grassSide
  apron.position.y = -1.0
  apron.rotation.y = Math.PI / 6 // flat edge faces the default camera
  apron.isPickable = false
  apron.parent = root

  // rock body: tapers inward and down, giving the floating-island silhouette
  const body = MeshBuilder.CreateCylinder('islandRock',
    { diameterTop: 58, diameterBottom: 30, height: 18, tessellation: 6 }, scene) as Mesh
  body.material = rock
  body.position.y = -11
  body.rotation.y = Math.PI / 6
  body.isPickable = false
  body.parent = root

  // a few chunky boulders hanging off the underside for toon silhouette
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const r = MeshBuilder.CreateIcoSphere(`islandChunk${i}`, { radius: 2 + (i % 3), subdivisions: 1 }, scene)
    r.material = rock
    r.position = new Vector3(Math.cos(a) * 22, -16 - (i % 3) * 2, Math.sin(a) * 22)
    r.isPickable = false
    r.parent = root
  }
  return root
}
```

- [ ] **Step 2: Вызвать в main.ts**

В `src/main.ts` добавить импорт рядом с другими world-импортами:

```ts
import { buildIsland } from './world/Island'
```

`env` создаётся на `main.ts:104`, `env.setReceiver(ground)` — на `main.ts:105`. Вставить ОДНУ строку сразу после `main.ts:105` (НЕ дублировать `setReceiver`):

```ts
const island = buildIsland(scene) // floating mesa under the play plane; visual only, no shadow caster needed
```

- [ ] **Step 3: Checkpoint — визуально**

Браузер → «Играть». Критерий: под травяным полем виден скальный конус-меза с валунами; край поля больше не обрывается в пустоту вплотную — есть травяной борт + скала вниз. (Небо пока ещё плоско-синее — чиним в Task 5.)

---

### Task 5: Skybox-купол с градиентом + перекраска тумана

**Files:**
- Create: `src/rendering/Sky.ts` (купол; облака/острова добавим в Task 6-7)
- Modify: `src/rendering/Environment.ts` (туман-цвет), `src/main.ts` (создать Sky)

**Interfaces:**
- Produces: `class Sky { constructor(scene: Scene); readonly horizonColor: Color3; dispose(): void }` — большой инвертированный купол с вертикальным градиентом (зенит → горизонт), emissive/unlit, бесконечно далёкий.

- [ ] **Step 1: Реализовать купол**

```ts
// src/rendering/Sky.ts
import { Scene, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, Mesh } from '@babylonjs/core'

const ZENITH = '#3f74b8'   // deeper blue overhead
const HORIZON = '#cfe0ec'  // pale haze at the horizon

export class Sky {
  readonly horizonColor = Color3.FromHexString(HORIZON)
  private dome: Mesh

  constructor(scene: Scene) {
    const tex = new DynamicTexture('skyGrad', { width: 8, height: 256 }, scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, ZENITH)
    g.addColorStop(1, HORIZON)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 8, 256)
    tex.update()
    tex.wrapV = Texture.CLAMP_ADDRESSMODE

    const mat = new StandardMaterial('skyMat', scene)
    mat.emissiveTexture = tex
    mat.disableLighting = true
    mat.backFaceCulling = false
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.specularColor = new Color3(0, 0, 0)

    // large dome; sideOrientation BACKSIDE so we see it from inside
    this.dome = MeshBuilder.CreateSphere('skyDome', { diameter: 600, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene)
    this.dome.material = mat
    this.dome.isPickable = false
    this.dome.infiniteDistance = true // follows the camera; always at horizon
    this.dome.applyFog = false
  }

  dispose(): void { this.dome.material?.dispose(); this.dome.dispose() }
}
```

- [ ] **Step 2: Создать Sky в main.ts и отдать цвет тумана в Environment**

В `src/main.ts` импорт:

```ts
import { Sky } from './rendering/Sky'
```

После создания `env` (`main.ts:104`) и `buildIsland`:

```ts
const sky = new Sky(scene)
env.setHorizonColor(sky.horizonColor) // fog fades to the sky's horizon haze, not flat blue
```

- [ ] **Step 3: Environment — метод `setHorizonColor` + убрать плоский clearColor доминанту**

В `src/rendering/Environment.ts` добавить метод и применять цвет к туману (заменив жёсткий `SKY`-туман):

```ts
  setHorizonColor(c: Color3): void {
    this.scene.fogColor = c.clone()
  }
```

И в конструкторе уменьшить плотность тумана, чтобы дальний план читался (Task 7): в `applyQuality` строка `this.scene.fogDensity = 0.011` → `0.006`.

> `scene.clearColor` остаётся как фоллбэк-цвет за куполом — оставить как есть (купол перекрывает его).

- [ ] **Step 4: Checkpoint — визуально**

Браузер → «Играть». Критерий: небо — мягкий вертикальный градиент (темнее вверху, светлая дымка у горизонта), а не плоская заливка. Поворот камеры Q/E — небо стабильно (купол следует за камерой). Дальняя дымка совпадает по цвету с горизонтом.

---

### Task 6: Облака-биллборды + дрейф (гейт по Quality)

**Files:**
- Modify: `src/rendering/Sky.ts`
- Create: `src/rendering/Sky.test.ts`
- Modify: `src/main.ts` (тик дрейфа), `src/rendering/Quality.ts` (поле `clouds`)

**Interfaces:**
- Produces (на `Sky`): `setClouds(count: number): void` (0 = выкл), `update(dt: number): void` (дрейф).
- Pure helper: `cloudRingPositions(count: number, radius: number, y: number): {x:number;y:number;z:number}[]` — экспортируемая чистая функция (тестируется).
- `Quality.ts`: `QualityConfig.clouds: number` (кол-во облаков: low=0, med=10, high=18).

- [ ] **Step 1: Failing test для раскладки облаков**

```ts
// src/rendering/Sky.test.ts
import { describe, it, expect } from 'vitest'
import { cloudRingPositions } from './Sky'

describe('cloudRingPositions', () => {
  it('returns the requested count', () => {
    expect(cloudRingPositions(10, 80, -4)).toHaveLength(10)
  })
  it('places clouds on a ring of the given radius at the given height', () => {
    for (const p of cloudRingPositions(8, 80, -4)) {
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(80, 0)
      expect(p.y).toBe(-4)
    }
  })
  it('count 0 yields no clouds', () => {
    expect(cloudRingPositions(0, 80, -4)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run src/rendering/Sky.test.ts`).

- [ ] **Step 3: Реализовать облака в Sky.ts**

Добавить в `src/rendering/Sky.ts`:

```ts
import { TransformNode, Vector3 } from '@babylonjs/core'

// Pure: evenly distribute `count` clouds on a horizontal ring (below the island).
export function cloudRingPositions(count: number, radius: number, y: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    out.push({ x: Math.cos(a) * radius, y, z: Math.sin(a) * radius })
  }
  return out
}
```

В классе `Sky` добавить поле `private cloudRoot: TransformNode | null = null` и метод:

```ts
  setClouds(count: number): void {
    this.cloudRoot?.dispose(false, true)
    this.cloudRoot = null
    if (count <= 0) return
    const scene = this.dome.getScene()
    // soft round cloud sprite via radial-alpha DynamicTexture
    const tex = new DynamicTexture('cloudTex', { width: 128, height: 64 }, scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const grad = ctx.createRadialGradient(64, 32, 4, 64, 32, 50)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 64)
    tex.update(); tex.hasAlpha = true
    const mat = new StandardMaterial('cloudMat', scene)
    mat.emissiveTexture = tex; mat.opacityTexture = tex
    mat.disableLighting = true; mat.backFaceCulling = false
    mat.diffuseColor = new Color3(0, 0, 0); mat.specularColor = new Color3(0, 0, 0)

    const root = new TransformNode('clouds', scene)
    const positions = cloudRingPositions(count, 90, -6)
    positions.forEach((p, i) => {
      const plane = MeshBuilder.CreatePlane(`cloud${i}`, { width: 22 + (i % 3) * 8, height: 11 + (i % 2) * 4 }, scene)
      plane.material = mat
      plane.position = new Vector3(p.x, p.y - (i % 4), p.z)
      plane.billboardMode = 7 // BILLBOARDMODE_ALL
      plane.isPickable = false
      plane.applyFog = true
      plane.parent = root
    })
    this.cloudRoot = root
  }

  update(dt: number): void {
    if (this.cloudRoot) this.cloudRoot.rotation.y += dt * 0.01 // slow drift
  }
```

(Импорты `StandardMaterial`, `MeshBuilder`, `Color3` уже есть в Sky.ts.)

- [ ] **Step 4: Run → PASS** (`npx vitest run src/rendering/Sky.test.ts`).

- [ ] **Step 5: Quality.ts — поле `clouds`**

В `QualityConfig` добавить `clouds: number`. В `resolveQuality`:
- `low`: `clouds: 0`
- `med`: `clouds: 10`
- `high`: `clouds: 18`
(добавить ключ в каждый возвращаемый объект).

- [ ] **Step 6: main.ts — применить и тикать**

После `const sky = new Sky(scene)` добавить:

```ts
sky.setClouds(resolveQuality(quality).clouds)
```

В `settings` set-колбэке (`main.ts:142-143`), где `env.applyQuality(...)`, добавить рядом:

```ts
      sky.setClouds(resolveQuality(p).clouds)
```

В render loop (после `rig.update(realDt)`):

```ts
  sky.update(realDt)
```

- [ ] **Step 7: Checkpoint — визуально**

Браузер → «Играть». Критерий: вокруг/ниже острова — мягкие белые облака, медленно дрейфуют, дают ощущение «остров в воздухе». На `low` (шестерёнка) облаков нет, на `high` — больше.

---

### Task 7: Дальний горизонт — силуэты парящих островов

**Files:**
- Modify: `src/rendering/Sky.ts` (метод `setDistantIslands`)
- Modify: `src/main.ts` (вызвать), `src/rendering/Quality.ts` (`distant: boolean`)

**Interfaces:**
- Produces (на `Sky`): `setDistantIslands(enabled: boolean): void` — несколько маленьких тёмных мез далеко на горизонте (глубина для третьего лица).
- `Quality.ts`: `QualityConfig.distant: boolean` (low=false, med/high=true).

- [ ] **Step 1: Реализовать**

В `Sky.ts` добавить `private farRoot: TransformNode | null = null` и:

```ts
  setDistantIslands(enabled: boolean): void {
    this.farRoot?.dispose(false, true); this.farRoot = null
    if (!enabled) return
    const scene = this.dome.getScene()
    const mat = new StandardMaterial('farIsleMat', scene)
    mat.diffuseColor = new Color3(0.5, 0.55, 0.62) // hazy blue-grey, blends into fog
    mat.specularColor = new Color3(0, 0, 0)
    const root = new TransformNode('farIslands', scene)
    const spec = [
      { a: 0.6, r: 150, y: -8, s: 26 }, { a: 1.9, r: 170, y: 2, s: 34 },
      { a: 3.3, r: 140, y: -14, s: 22 }, { a: 4.7, r: 185, y: 6, s: 40 },
      { a: 5.6, r: 160, y: -4, s: 30 },
    ]
    for (const [i, m] of spec.entries()) {
      const isle = MeshBuilder.CreateCylinder(`farIsle${i}`,
        { diameterTop: m.s, diameterBottom: m.s * 0.5, height: m.s * 0.7, tessellation: 6 }, scene)
      isle.material = mat
      isle.position = new Vector3(Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r)
      isle.rotation.y = Math.PI / 6
      isle.isPickable = false
      isle.applyFog = true // fades into the horizon haze
      isle.parent = root
    }
    this.farRoot = root
  }
```

- [ ] **Step 2: Quality.ts** — добавить `distant: boolean` в `QualityConfig`, и в `resolveQuality`: low=false, med/high=true.

- [ ] **Step 3: main.ts** — после `sky.setClouds(...)`:

```ts
sky.setDistantIslands(resolveQuality(quality).distant)
```

И в settings set-колбэке рядом с `sky.setClouds(...)`:

```ts
      sky.setDistantIslands(resolveQuality(p).distant)
```

- [ ] **Step 4: Checkpoint — визуально (третье лицо!)**

Браузер → «Играть» → Tab (третье лицо) → пробежать WASD к краю карты, посмотреть наружу. Критерий: на горизонте видны дальние парящие острова в дымке — глубина есть, не пустота. (Кромка-парапет — следующая фаза.)

---

## Phase 3 — Достоверность от третьего лица: кромка

### Task 8: Каменная кромка/парапет по периметру поля

**Files:**
- Modify: `src/main.ts` (рядом с perimeter walls `:97-100`)

**Interfaces:**
- Consumes: `assets.instance('prop.rock')` (уже зарегистрирован, `models.ts:53`), `prop.wall` (`models.ts:54`).

- [ ] **Step 1: Построить визуальный бордюр вдоль 4 границ**

После цикла невидимых стен (`main.ts:100`) добавить функцию и вызвать её один раз (бордюр общий для всех карт — ставим при старте, не диспозим в `loadMap`):

```ts
// visual rim along the play boundary so third-person doesn't show a bare slab edge:
// alternating rocks (so the hero sees a believable cliff lip, not a cut table edge)
function buildRim() {
  const B = 19.5 // just inside the 20-unit invisible walls
  const step = 3
  for (let t = -B; t <= B; t += step) {
    for (const [x, z] of [[t, B], [t, -B], [B, t], [-B, t]] as const) {
      const rock = assets.instance('prop.rock')
      rock.position.set(x + (Math.abs(x) % 1) * 0.3, -0.2, z)
      rock.rotation.y = (x + z) // pseudo-varied yaw
      const s = rock.scaling.x * (0.7 + ((Math.abs(x * 7 + z * 3)) % 5) / 8)
      rock.scaling.set(s, s, s)
      rock.getChildMeshes().forEach((m) => (m.isPickable = false))
      env.addShadowCaster(rock)
    }
  }
}
```

Вызвать `buildRim()` один раз в `boot()` после `loadMap(0)` (`main.ts:835`).

> Камни берутся из общего `AssetManager.instance` и не диспозятся между картами — это ок, бордюр статичен. Если позже захочется чистить — вынести в отдельный массив; для MVP оставить статикой.

- [ ] **Step 2: Checkpoint — визуально (третье лицо)**

Tab → подбежать к краю. Критерий: по периметру — каменная кромка-губа; голый срез плоскости с земли не виден; ощущение «стою на вершине острова», не «на столе». Сверху (top) камни читаются как обрамление, не мешают видеть путь/клетки.

---

## Phase 4 — Замена программерских примитивов

### Task 9: Импортировать ассеты (Kenney TD markers/corner + Nature Kit foliage) + зарегистрировать модели

**Контекст:** Пользователь хочет НАСТОЯЩИЕ кусты/деревья, не кристаллы. В Kenney TD-ките модели куста нет. Поэтому контроллер уже скачал CC0 **Kenney Nature Kit** и положил курированный набор в репо: `kenney_nature-kit/Models/GLB format/` (License.txt рядом). Эти GLB — самодостаточные, vertex-colored (НЕТ atlas-текстуры → НЕТ purple-tint бага, `tint` НЕ нужен). Доступные файлы: `plant_bushDetailed`, `plant_bushSmall`, `plant_bushLarge`, `tree_default`, `tree_oak`, `tree_detailed`, `tree_pineRoundA`, `tree_fat`, `grass`, `grass_large`, `flower_redA`, `flower_yellowA`, `flower_purpleA`.

**Files:**
- Modify: `scripts/copy-assets.mjs`, `src/rendering/models.ts`

**Interfaces:**
- Produces ключи моделей: `cell.pad`, `tile.roadCorner`, `decor.bush`, `decor.bushSmall`, `decor.bushLarge`, `decor.grass`, `decor.grassLarge`, `decor.flowerRed`, `decor.flowerYellow`, `decor.flowerPurple`. Плюс репойнт `prop.tree` на Nature-дерево (красивее).

- [ ] **Step 1: copy-assets.mjs — Kenney TD добавки**

В `KENNEY_MODELS`:
- новый раздел `markers: ['selection-a', 'selection-b']`
- в `tiles` добавить: `'tile-corner-round'`

(crystals НЕ добавляем — заменены на Nature foliage.)

- [ ] **Step 2: copy-assets.mjs — Nature Kit копир**

Добавить рядом с `KENNEY`/`ADV`/`SKEL` константами:

```js
const NATURE = join(root, 'kenney_nature-kit/Models/GLB format')
```

Добавить таблицу и копир (Nature GLB самодостаточны — НЕ копируем colormap):

```js
const NATURE_MODELS = {
  nature: [
    'plant_bushDetailed', 'plant_bushSmall', 'plant_bushLarge',
    'tree_default', 'tree_oak', 'tree_detailed', 'tree_pineRoundA', 'tree_fat',
    'grass', 'grass_large', 'flower_redA', 'flower_yellowA', 'flower_purpleA',
  ],
}
function copyNature(folder, names) {
  const dst = join(OUT, folder)
  mkdirSync(dst, { recursive: true })
  for (const n of names) {
    const src = join(NATURE, n + '.glb')
    if (!existsSync(src)) throw new Error('missing Nature model: ' + src)
    cpSync(src, join(dst, n + '.glb'))
  }
}
```

И в конце файла, после Kenney/KayKit циклов, добавить:

```js
for (const [folder, names] of Object.entries(NATURE_MODELS)) copyNature(folder, names)
```

- [ ] **Step 3: Запустить копирование**

Run: `npm run assets`
Expected: `assets copied to .../public/models`, без `missing ... model`. Проверить, что появились `public/models/nature/*.glb` и `public/models/markers/selection-a.glb`.

- [ ] **Step 4: Зарегистрировать модели в `models.ts`**

Добавить префикс рядом с другими (`models.ts:26-31`):

```ts
const N = '/models/nature/'
```

В `MODELS` добавить:

```ts
  'cell.pad':          { url: '/models/markers/selection-a.glb', targetHeight: 1, footprint: 2.0, tileTopY: 0.04, tint: [0.45, 0.75, 1.0] },
  'tile.roadCorner':   { url: TL + 'tile-corner-round.glb', targetHeight: 1, footprint: 2.4, tileTopY: 0.06, tint: [0.4, 0.32, 0.24] },
  'decor.bush':        { url: N + 'plant_bushDetailed.glb', targetHeight: 1.1 },
  'decor.bushSmall':   { url: N + 'plant_bushSmall.glb', targetHeight: 0.7 },
  'decor.bushLarge':   { url: N + 'plant_bushLarge.glb', targetHeight: 1.6 },
  'decor.grass':       { url: N + 'grass.glb', targetHeight: 0.5 },
  'decor.grassLarge':  { url: N + 'grass_large.glb', targetHeight: 0.9 },
  'decor.flowerRed':   { url: N + 'flower_redA.glb', targetHeight: 0.5 },
  'decor.flowerYellow':{ url: N + 'flower_yellowA.glb', targetHeight: 0.5 },
  'decor.flowerPurple':{ url: N + 'flower_purpleA.glb', targetHeight: 0.5 },
```

И **репойнт** существующего solid-дерева на красивое Nature-дерево (заменить строку `models.ts:52`):

```ts
  'prop.tree':  { url: N + 'tree_default.glb', targetHeight: 2.6 },
```

(Nature GLB vertex-colored — БЕЗ `tint`, чтобы сохранить родные цвета. `P`/`TL` — существующие префиксы.)

- [ ] **Step 5: Checkpoint**

Run: `npm run typecheck` → clean. `npx vitest run src/rendering/models.test.ts` → проходят (если тест перечисляет ключи/считает модели — обновить ожидания).

---

### Task 10: Клетки застройки — `cell.pad` вместо синих боксов

**Files:**
- Modify: `src/main.ts` (`buildEnvironment` cells `:251-255`; `loadMap` cleanup `:306`)

- [ ] **Step 1: Заменить генерацию клеток**

В `buildEnvironment` (`main.ts:251-255`) заменить блок создания `pad`-боксов на:

```ts
  for (const c of level.cells) {
    const pad = assets.instance('cell.pad')
    pad.position.set(c.pos.x, 0, c.pos.z)
    pad.getChildMeshes().forEach((m) => (m.isPickable = false))
    envProps.push(pad)
  }
```

Удалить ставший ненужным `cellMat` (`main.ts:112`), если больше нигде не используется (проверить grep — превью-кольцо использует `previewMat`, не `cellMat`).

- [ ] **Step 2: Checkpoint — визуально**

Браузер → «Играть». Критерий: клетки под застройку — плоские рун-пады на земле (Kenney selection), НЕ летающие синие квадраты. Превью-кольцо радиуса при выборе башни всё ещё работает.

---

### Task 11: Декор — настоящие кусты/трава/цветы вместо сфер-кустов и плоских патчей

**Контекст:** Пользователь любит кусты — ставим настоящие Nature-кусты (`decor.bush*`), кочки → пучки травы (`decor.grassLarge`), плоские цветные патчи → трава+цветы (`decor.grass`/`decor.flower*`). Никаких кристаллов.

**Files:**
- Modify: `src/main.ts` (`buildProp` `:270-295`, материалы `:115-117`)

- [ ] **Step 1: Заменить bush/mound/patch на Nature-ассеты**

В `buildProp` (`main.ts:285-294`) заменить ветки `bush`/`mound`/`patch`:

```ts
  if (p.kind === 'bush') {
    const key = p.w > 1.5 ? 'decor.bushLarge' : p.w > 1.0 ? 'decor.bush' : 'decor.bushSmall'
    const node = assets.instance(key)
    node.position.set(p.x, 0, p.z); node.rotation.y = p.rot
    node.getChildMeshes().forEach((m) => (m.isPickable = false))
    env.addShadowCaster(node); envProps.push(node)
  } else if (p.kind === 'mound') {
    const node = assets.instance('decor.grassLarge') // leafy grass clump instead of a squashed sphere
    node.position.set(p.x, 0, p.z); node.rotation.y = p.rot
    node.getChildMeshes().forEach((m) => (m.isPickable = false))
    envProps.push(node)
  } else { // patch — scatter grass tufts / flowers instead of a flat coloured box
    const keys = ['decor.grass', 'decor.flowerRed', 'decor.flowerYellow', 'decor.flowerPurple'] as const
    const node = assets.instance(keys[(patchTick++) % keys.length])
    node.position.set(p.x, 0, p.z); node.rotation.y = p.rot
    node.getChildMeshes().forEach((m) => (m.isPickable = false))
    envProps.push(node)
  }
```

Удалить неиспользуемые `bushMat`, `moundMat`, `patchMats` (`main.ts:115-117`) если grep подтверждает, что больше не нужны. **`patchTick` ОСТАВИТЬ** (`main.ts:269`) — используется для ротации трава/цветы выше.

> Узлы теперь `TransformNode` (instance), а не `Mesh` — кладём в `envProps` (диспозится в `loadMap` через `n.dispose(false,true)`), не в `envMeshes`. Локальный `add()`-хелпер в `buildProp` для bush/mound/patch больше не нужен (его primitive-ветки удалены) — проверить, что он не остался висеть мёртвым; solid-props (`rock/tree/crate/wall`) идут отдельной веткой выше (`main.ts:272-284`), её не трогаем. `prop.tree` теперь Nature-дерево (репойнт в Task 9) — solid-ветка автоматически получит красивое дерево.

- [ ] **Step 2: Checkpoint — визуально**

Браузер → «Играть». Критерий: кусты-сферы и плоские цветные патчи исчезли; вместо них тун-кристаллы и кочки земли из кита. Сцена выглядит однородно по стилю. Тени от кристаллов есть на high.

---

### Task 12: Дорога — угловые тайлы на поворотах

**Files:**
- Modify: `src/main.ts` (`buildEnvironment` road loop `:239-247`)

- [ ] **Step 1: Ставить угловой тайл в вершинах пути**

После цикла раскладки прямых дорожных тайлов (`main.ts:239-247`), перед `placeTile('tile.spawn', ...)`, добавить угловые тайлы во внутренних вершинах пути:

```ts
  // place a corner tile at each interior bend so turns read cleanly (not stepped squares)
  for (let i = 1; i < level.path.length - 1; i++) {
    const v = level.path[i]
    const corner = assets.instance('tile.roadCorner')
    corner.position.x = v.x; corner.position.z = v.z
    // orient the corner so its arc connects incoming->outgoing segment
    const prev = level.path[i - 1], next = level.path[i + 1]
    corner.rotation.y = Math.atan2(next.x - v.x, next.z - v.z) + (Math.atan2(v.x - prev.x, v.z - prev.z) < 0 ? 0 : Math.PI / 2)
    corner.getChildMeshes().forEach((m) => (m.isPickable = false))
    envProps.push(corner)
  }
```

> Поворот углового тайла зависит от модели Kenney; точную ориентацию подобрать визуально (шаг `Math.PI/2`). Если `tile-corner-round` ориентируется иначе — скорректировать слагаемое.

- [ ] **Step 2: Checkpoint — визуально**

Браузер → «Играть» на карте с поворотами (карта 2+). Критерий: на изгибах дороги — скруглённый угловой тайл, стык читается чисто, без ступенчатого наложения квадратов.

---

### Task 13: Спавн-хижина — перекрасить в палитру

**Files:**
- Modify: `src/main.ts` (`buildSpawnHut` `:219-221`)

- [ ] **Step 1: Сменить кричащие цвета на выветренные**

В `buildSpawnHut` заменить материалы (`main.ts:219-221`):

```ts
  const wood = mat('hutWood', 0.36, 0.27, 0.19)
  const roof = mat('hutRoof', 0.34, 0.2, 0.18) // weathered dark red-brown, not bright red
  const dark = mat('hutDoor', 0.05, 0.05, 0.07)
```

- [ ] **Step 2: Checkpoint — визуально**

Критерий: хижина спавна больше не ярко-красный бокс; цвета приглушённые, вписываются в палитру острова.

---

## Phase 5 — Грейдинг + пост

### Task 14: Виньетка + тюнинг тонмаппинга

**Files:**
- Modify: `src/rendering/Environment.ts` (конструктор pipeline `:40-48`)

- [ ] **Step 1: Включить виньетку и подстроить экспозицию/контраст**

В конструкторе `Environment`, после настройки `ip` (`Environment.ts:41-44`), добавить:

```ts
    ip.vignetteEnabled = true
    ip.vignetteWeight = 2.2
    ip.vignetteColor = new Color4(0.05, 0.06, 0.1, 0)
    ip.vignetteCameraFov = 0.9
    ip.exposure = 1.05
    ip.contrast = 1.12
```

(Добавить `Color4` в импорт из `@babylonjs/core`, если ещё нет — он уже импортируется в Environment.ts.)

- [ ] **Step 2: Checkpoint — визуально**

Критерий: лёгкое затемнение по углам кадра фокусирует взгляд на острове; картинка чуть контрастнее/насыщеннее, не выцветшая. Не переборщить — пути/враги должны оставаться читаемыми.

---

### Task 15: Tilt-shift DOF только на high, выкл в третьем лице

**Files:**
- Modify: `src/rendering/Environment.ts` (`applyQuality`), `src/rendering/Quality.ts` (`dof: boolean`), `src/main.ts` (выкл DOF при Tab)

**Interfaces:**
- Produces: `Environment.setDofEnabled(on: boolean): void`.
- `Quality.ts`: `QualityConfig.dof` (low/med=false, high=true).

- [ ] **Step 1: Quality.ts** — добавить `dof: boolean` в `QualityConfig`; low/med=false, high=true.

- [ ] **Step 2: Environment — DOF в pipeline + геттер-сеттер**

В `applyQuality` (после блока bloom/fxaa) добавить:

```ts
    this.pipeline.depthOfFieldEnabled = cfg.dof
    if (cfg.dof) {
      this.pipeline.depthOfField.focusDistance = 45000 // mm-ish; board center
      this.pipeline.depthOfField.fStop = 1.4
      this.pipeline.depthOfField.focalLength = 60
    }
```

Добавить метод:

```ts
  setDofEnabled(on: boolean): void { this.pipeline.depthOfFieldEnabled = on }
```

- [ ] **Step 3: main.ts — выключать DOF в третьем лице**

В Tab-ветке `keydown` (`main.ts:617-620`), после `rig.toggle()`, добавить:

```ts
    env.setDofEnabled(rig.mode === 'top' && resolveQuality(quality).dof)
```

- [ ] **Step 4: Checkpoint — визуально**

На `high` (шестерёнка) сверху: лёгкий tilt-shift — края карты чуть размыты, «игрушечная диорама». Tab в третье лицо: DOF выключается, мир резкий и «настоящий». На low/med DOF нет вовсе.

---

## Phase 6 — Полировка

### Task 16: Establishing-заход камеры + ambient-частицы

**Files:**
- Modify: `src/camera/CameraRig.ts` (intro), `src/main.ts` (ambient motes)

**Interfaces:**
- Produces (на `CameraRig`): `playIntro(): void` — короткий заход (радиус с дальнего к рабочему) при старте карты.

- [ ] **Step 1: Intro в CameraRig**

Добавить поле `private introT = 0` и в `update(dt)` (top-режим) перед `easeAlpha`:

```ts
    if (this.introT > 0) {
      this.introT = Math.max(0, this.introT - dt)
      const k = this.introT / 1.2 // 1.2s ease-in
      this.topCam.radius = 45 + k * 18 // start far, settle to 45
    }
```

И метод:

```ts
  playIntro(): void { this.introT = 1.2; this.topCam.radius = 63 }
```

- [ ] **Step 2: Вызвать intro при загрузке карты**

В `main.ts` `loadMap` (конец функции, после `syncHero()` `:314`) добавить:

```ts
  rig.playIntro()
```

- [ ] **Step 3: Ambient motes — лёгкие парящие частицы**

В `main.ts`, после создания `sky`, добавить ненавязчивые частицы-пылинки над островом (гейт по quality — только med/high). Использовать существующий `burst`/`Particles`? Нет — нужен постоянный эмиттер. Минимально через `ParticleSystem`:

```ts
import { ParticleSystem, Texture as BTexture, Vector3 as V3, Color4 } from '@babylonjs/core'
```

(если имена конфликтуют — переиспользовать уже импортированные `Vector3`, `Texture`, `Color4`.)

```ts
function buildAmbientMotes() {
  if (resolveQuality(quality).preset === 'low') return
  const ps = new ParticleSystem('motes', 120, scene)
  ps.particleTexture = gm.diffuseTexture as Texture // reuse any texture; tiny + faint
  ps.emitter = new Vector3(0, 4, 0)
  ps.minEmitBox = new Vector3(-20, 0, -20); ps.maxEmitBox = new Vector3(20, 8, 20)
  ps.color1 = new Color4(1, 1, 0.9, 0.18); ps.color2 = new Color4(1, 1, 1, 0.1)
  ps.colorDead = new Color4(1, 1, 1, 0)
  ps.minSize = 0.04; ps.maxSize = 0.12
  ps.minLifeTime = 4; ps.maxLifeTime = 8
  ps.emitRate = 18
  ps.direction1 = new Vector3(-0.2, 0.4, -0.2); ps.direction2 = new Vector3(0.2, 0.6, 0.2)
  ps.gravity = new Vector3(0, 0.02, 0)
  ps.start()
}
buildAmbientMotes()
```

> Если переиспользование `gm.diffuseTexture` даёт некрасивый спрайт — заменить на маленькую radial-alpha `DynamicTexture` (как облака). Цель — едва заметные парящие искры/пыльца, добавляющие «воздух».

- [ ] **Step 4: Checkpoint — визуально**

Критерий: при входе на карту камера делает короткий мягкий заход (чуть отдаляется → садится). В воздухе над островом — еле заметные парящие пылинки (med/high), создают атмосферу, не отвлекают. На low — нет.

---

## Финальная приёмка (по спеку)

После всех задач — прогон критериев спека:

1. **Сверху:** чистый фикс-изо ракурс, поворот только Q/E на 90°, зум в пределах, нырнуть в void нельзя. ✔ (Phase 1)
2. **«Квадрат в космосе» исчез:** остров-меза + skybox-градиент + облака. ✔ (Phase 2)
3. **Третье лицо (главный критерий пользователя):** скриншот Tab у края = «стою на вершине парящего острова над морем облаков» (кромка-камни + дальние острова + дымка), НЕ «бегаю по столу настолки». ✔ (Phase 2-3)
4. **Ноль программерских примитивов:** клетки=пады, кусты=настоящие Nature-кусты, кочки=трава, патчи=трава/цветы, деревья=Nature, дорога-углы, хижина в палитре. ✔ (Phase 4)
5. **Финишная рамка:** виньетка, грейдинг, tilt-shift (high), establishing, частицы. ✔ (Phase 5-6)
6. **Перф:** low не получает облаков/DOF/частиц/дальних островов; всё гейтится Quality. ✔
7. **Геймплей не тронут:** волны/башни/коллизия/аудио без изменений. ✔

**Команды финальной проверки:**
- `npm run typecheck` → clean
- `npx vitest run` → все тесты зелёные
- Браузер: пройти карту 1, переключить top/третье-лицо, покрутить Q/E, сменить качество low↔high — везде корректно.
