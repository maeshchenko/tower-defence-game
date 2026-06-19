# Polish P2 — Juice Implementation Plan

> Executed controller-inline in one pass (user: "делай, всё одним"). TDD on the pure modules; Babylon FX browser-verified; final whole-branch review at the end.

**Goal:** Add screenshake, hitstop, GPU particles, recoil, hit-blink, death-pop, and projectile trails without changing mechanics.

**Tech:** Babylon.js 9 core, TS, Vitest. New `src/fx/`. No new deps.

## Global Constraints
- `@babylonjs/core` only. tsc strict green. Sim modules untouched (`enemies/Enemy*`, `towers/Tower.ts`/`TowerManager.ts`/`TowerTypes.ts`, `hero/`, `core/`, `world/`). View files (`EnemyView`/`TowerView`) may gain FX methods. Commits: subject text only, no trailers.
- Restraint: shake capped, 0.4× in hero cam; hitstop ≤80ms on big events only; blink ≤90ms.

## Tasks
1. `src/fx/Screenshake.ts` (pure) + test — trauma add/cap/decay, intensity=trauma², deterministic offset.
2. `src/fx/Hitstop.ts` (pure) + test — trigger(ms)/update(realDtMs)→simScale.
3. `src/fx/Particles.ts` (Babylon) — shared soft sprite + `burst(scene,kind,x,y,z,color)` muzzle/impact/death, disposeOnStop.
4. `src/fx/Trail.ts` (Babylon) — `attachTrail(scene,node,color)`→TrailMesh.
5. `EnemyView.flashHit()` + death scale-pop; `TowerView.kickback()`.
6. Wire main.ts: real/sim dt split via Hitstop; camera `targetScreenOffset` from Screenshake (mode-scaled); triggers at hero-shot/tower-fire/impact/death/base-hit; replace sphere-flash with particles; attach+dispose trails; clear FX on loadMap.

Verify: vitest (pure), browser (visuals/FPS), build green.
