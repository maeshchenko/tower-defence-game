# M1 — Asset Pipeline + Visual Swap (Design)

Date: 2026-06-19
Status: approved direction, ready for implementation plan

## Context

The tower-defence game currently renders every entity as a Babylon.js primitive
(boxes, capsules, cylinders, spheres) with flat `StandardMaterial` colours. It
plays fully but looks like a prototype. We want a real game with real 3D models.

Asset audit is done. All assets are CC0 and already on disk:

- **Kenney Tower Defense Kit** (`kenney_tower-defense-kit/Models/GLB format/`) —
  towers, weapons, ammo, terrain tiles, props. 160 GLB models.
- **KayKit Adventurers** (`assets-src/adventurers/.../Characters/gltf/`) — hero
  characters (Knight/Barbarian/Mage/Rogue), rigged + animated `.glb`.
- **KayKit Skeletons** (`assets-src/skeletons/.../Characters/gltf/`) — ground
  enemies (Skeleton Warrior/Minion/Rogue/Mage), rigged + animated `.glb`.

Theme committed: **medieval/fantasy**. Kenney's UFO enemies are dropped.

M1 is the foundation milestone of a 6-milestone overhaul (M2 animation system,
M3 grid-tile maps, M4 combat depth, M5 audio/juice, M6 menus). Everything
downstream depends on the asset loader M1 introduces.

**Goal of M1:** replace primitive meshes with GLB models. Gameplay, maps, waves,
balance stay **identical**. Outcome: the game looks real and plays the same.

## Scope

### In scope (swap primitive → model)
- **Towers** (`TowerView.ts`) — cannon / slow / sniper.
- **Enemies** (`EnemyView.ts`) — normal / fast / tank → skeleton models.
- **Hero** (`main.ts` `heroBody`/`heroNose`) → Knight model.
- **Projectiles** (`main.ts` `spawnBall`) → Kenney ammo models.
- **Solid decor props** (`buildProp` for `rock`/`crate`/`wall`/`tree`) → Kenney
  detail/structure models. Obstacle AABB logic unchanged (footprint still comes
  from `Prop.w/d`).
- **Base marker** → a Kenney tower/structure model (a "castle" to defend).
- **Idle pose:** every animated character plays its looping `Idle` animation so
  models are not frozen in T-pose. (State-driven walk/death/attack = M2.)

### Out of scope (deferred)
- Ground, road segments, build-cell pads → stay primitive (M3 rebuilds the map
  from Kenney tile models).
- Passable scenery (`bush`/`mound`/`patch`) → stay primitive (low visual weight).
- State-driven animation logic (walk on path, death on kill, hit flinch) → M2.
- Tower build-stage / stacking visuals, muzzle/impact FX → M3/M4.
- No gameplay, balance, wave, or input changes whatsoever.

## Key constraints discovered

1. **`@babylonjs/loaders` is not installed.** Add it (`npm i @babylonjs/loaders`)
   and import the glTF loader side-effect (`import '@babylonjs/loaders/glTF'`)
   once at startup, or Babylon cannot import `.glb`.
2. **Kenney GLB textures are external.** Each Kenney `.glb` references
   `"uri":"Textures/colormap.png"`. When a model is served, `colormap.png` must
   sit at `<model-dir>/Textures/colormap.png` relative to the `.glb`. KayKit
   `.glb` are self-contained (embedded textures) — copy as-is.
3. **Kenney models are sub-unit scale** (~0.44 units tall) and KayKit chars are
   ~1.8 units. Both need normalization to game units. Use a bounding-box
   normalize helper (target height per entity), not hard-coded magic numbers.
4. **Loading is async; current init is synchronous.** Wrap startup so all models
   preload before the first map builds; show a simple loading overlay.
5. Vite serves `public/` at the site root. Models must live under `public/` (the
   source kits stay where they are; we copy only what we use into `public/`).

## Architecture

### New: `src/rendering/AssetManager.ts`
Single owner of model loading and instancing. Public surface:

- `async preload(scene): Promise<void>` — load every GLB we use into Babylon
  `AssetContainer`s (via `LoadAssetContainerAsync`). Caches by key. Called once
  at startup.
- `instance(key: string): TransformNode` — clone a cached container into the
  scene (`container.instantiateModelsToScene`), returning the root node. For
  animated characters this yields independent `AnimationGroup`s per instance
  (each enemy/hero animates on its own).
- `playIdle(root): void` — find and loop the `Idle` animation group on an
  instance (used in M1; M2 generalizes this into an animation controller).
- A `MODELS` registry mapping logical keys → file paths + per-key normalize
  target height + y-offset. One place to retune scale/placement.

Why a container-based manager: `instantiateModelsToScene` gives cheap clones with
their own transforms and per-instance animation groups — exactly what many
enemies need. Loading each container once avoids re-parsing GLB per spawn.

### Model registry (M1 mapping)

Towers (assembled once per kind from Kenney parts → a recognizable silhouette;
M1 keeps it simple — one template node per kind, cached):
- `tower.cannon`  → `tower-square-bottom-a` + `tower-square-middle-a` + `weapon-cannon`
- `tower.slow`    → `tower-round-base` + `tower-round-crystals` (frost/magic look)
- `tower.sniper`  → `tower-square-bottom-a` + `tower-square-middle-a` + `weapon-ballista`

Enemies (KayKit skeletons):
- `enemy.normal`  → `Skeleton_Warrior`
- `enemy.fast`    → `Skeleton_Minion` (smaller/quicker read)
- `enemy.tank`    → `Skeleton_Warrior` scaled up + recolored, or `Skeleton_Rogue`
  bulked — pick the heavier silhouette during implementation.

Hero: `hero.knight` → `Knight.glb`.

Projectiles (Kenney ammo):
- cannon → `weapon-ammo-cannonball`, sniper → `weapon-ammo-arrow`,
  slow → `weapon-ammo-bullet`, hero → `weapon-ammo-arrow`, enemy → keep small
  emissive sphere (readable as a "magic bolt").

Solid decor → Kenney detail/structure:
- `tree` → `detail-tree` / `detail-tree-large`
- `rock` → `detail-rocks` / `detail-rocks-large`
- `wall` → `wood-structure` / `wood-structure-high`
- `crate` → `wood-structure-part` (no crate in kit; closest wood prop)

Base marker → a tall Kenney tower stack (e.g. round base + middle + roof) as the
defended keep.

### View class changes (keep the existing interface)
`TowerView` and `EnemyView` already expose `mesh` + `sync()` + `dispose()`, and
`main.ts` only touches those. Preserve that contract so `main.ts` barely changes:

- `TowerView`: replace the `CreateCylinder` body with
  `assets.instance('tower.'+kind)`; keep the dashed range ring as-is; keep
  `sync()` level-scaling (scale the model root instead of the cylinder).
- `EnemyView`: replace `CreateCapsule` with `assets.instance('enemy.'+kind)`;
  call `playIdle`; keep `sync()` writing position (drop the half-height Y offset,
  use the registry y-offset so feet sit on the ground).
- Hero in `main.ts`: replace `heroBody`/`heroNose` capsule+box with
  `assets.instance('hero.knight')`; keep `syncHero()` position/yaw/enabled logic.
- `buildProp` in `main.ts`: for solid kinds, instance the mapped model scaled to
  `Prop.w/d/h`; passable kinds keep their current primitives.
- `spawnBall`: accept a model key; instance the ammo model (fallback sphere if a
  key is missing) so the rest of the projectile code is untouched.

### Startup flow (`main.ts`)
Wrap the bottom-of-file init in an async bootstrap:
1. register glTF loader import.
2. `await assets.preload(scene)` behind a loading overlay (`<div>` over canvas).
3. hide overlay, then run existing `loadMap(0)` + render loop.

`scene.onBeforeRenderObservable` loop is unchanged.

## Asset deployment
- Add an `npm run assets` script (node copy script in `scripts/copy-assets.mjs`)
  that copies the used GLB + `Textures/colormap.png` from the two kits into
  `public/models/{towers,enemies,hero,props,ammo}/`, preserving the `Textures/`
  subdir next to Kenney GLBs. Idempotent; documented in README.
- Rationale: keep the multi-hundred-MB source kits (and KayKit `.git`) out of the
  build; `public/` carries only the handful of models actually used.
- Strip the cloned KayKit `.git` dirs (`assets-src/*/.git`, ~270MB) — they were
  shallow clones we only needed for the files. Add `assets-src/` and
  `kenney_tower-defense-kit/` to `.gitignore` if not committing source kits.

## File touch list
- new `src/rendering/AssetManager.ts`
- new `scripts/copy-assets.mjs`
- `src/towers/TowerView.ts` — swap mesh, keep ring + sync contract
- `src/enemies/EnemyView.ts` — swap mesh, idle anim, y-offset
- `src/main.ts` — hero model, `buildProp` solid kinds, `spawnBall` key, async
  bootstrap + loading overlay, base marker
- `package.json` — add `@babylonjs/loaders`, `assets` script
- `.gitignore`, `README.md`

## Risks & mitigations
- **Style mismatch** (KayKit textured chars vs Kenney flat colormap): both
  low-poly matte; acceptable. If jarring, apply flat/unlit material tweak in M5.
- **Scale/orientation drift** (model forward axis vs `yaw`): normalize helper +
  per-key y-offset; verify hero nose/skeleton facing during impl, add a yaw
  offset constant per character if needed.
- **Load time / payload**: only used models go to `public/`; KayKit chars are
  ~3-4MB each (≤9 chars). Acceptable for a loading screen. Consider Draco later.
- **Animated-instance cost**: `instantiateModelsToScene` per enemy gives its own
  animation groups; fine at current wave sizes. Revisit with instancing if many
  enemies regress FPS.

## Verification
1. `npm run assets` populates `public/models/**` incl. `Textures/colormap.png`.
2. `npm run typecheck` passes.
3. `npm run dev` → loading overlay shows, then game renders with: skeleton
   enemies walking the path (idle-anim, not T-pose), a knight hero, 3D towers on
   cells, model projectiles, rock/wall/tree/crate props as models, a keep at base.
4. Play a full wave: build a tower, it fires model projectiles, enemies take
   damage and are removed on death, hero shoots, gold/lives behave as before.
5. Map transition (clear map 0) loads map 1 with models intact, no leaked meshes
   (watch `scene.meshes` count across reloads).
6. Compare against pre-M1 behaviour: identical gameplay, only visuals changed.
