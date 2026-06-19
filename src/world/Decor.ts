import { Vec3 } from '../core/Vec3'
import { Level } from './Level'

export type PropKind = 'rock' | 'bush' | 'crate' | 'wall' | 'tree' | 'mound' | 'patch'

// a decorative/obstacle object: footprint w x d, height h, yaw rot
export interface Prop { kind: PropKind; x: number; z: number; w: number; d: number; h: number; rot: number }
// axis-aligned blocker the hero cannot walk through
export interface Obstacle { x: number; z: number; hw: number; hd: number }
export interface Decor { props: Prop[]; obstacles: Obstacle[] }

const SOLID: Record<PropKind, boolean> = {
  rock: true, crate: true, wall: true, tree: true, // block the hero
  bush: false, mound: false, patch: false,         // passable scenery
}

// deterministic PRNG so each map's layout is stable across reloads
function rng(seed: number) {
  let s = (seed + 0x9e3779b9) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function segDist(px: number, pz: number, a: Vec3, b: Vec3): number {
  const dx = b.x - a.x, dz = b.z - a.z
  const l2 = dx * dx + dz * dz || 1
  let t = ((px - a.x) * dx + (pz - a.z) * dz) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz))
}
function distToPath(x: number, z: number, path: Vec3[]): number {
  let min = Infinity
  for (let i = 0; i < path.length - 1; i++) min = Math.min(min, segDist(x, z, path[i], path[i + 1]))
  return min
}

const BOUND = 18
// per-kind: how many to place, footprint range, and how far it must clear the road
const PLAN: { kind: PropKind; count: number; min: number; max: number; clear: number }[] = [
  { kind: 'wall', count: 5, min: 3, max: 6, clear: 3.0 },
  { kind: 'rock', count: 8, min: 0.8, max: 2.2, clear: 2.4 },
  { kind: 'crate', count: 5, min: 0.9, max: 1.4, clear: 2.4 },
  { kind: 'tree', count: 6, min: 0.6, max: 0.9, clear: 2.6 },
  { kind: 'bush', count: 12, min: 0.8, max: 1.8, clear: 1.8 },
  { kind: 'mound', count: 5, min: 2.5, max: 5, clear: 1.5 },
  { kind: 'patch', count: 14, min: 1.5, max: 4, clear: 1.0 },
]

// generate a stable set of decor props + hero obstacles for a level
export function generateDecor(level: Level, seed: number): Decor {
  const rand = rng(seed)
  const props: Prop[] = []
  const obstacles: Obstacle[] = []
  const placed: { x: number; z: number; r: number }[] = []

  for (const spec of PLAN) {
    for (let n = 0; n < spec.count; n++) {
      for (let tries = 0; tries < 30; tries++) {
        const x = (rand() * 2 - 1) * BOUND
        const z = (rand() * 2 - 1) * BOUND
        const size = spec.min + rand() * (spec.max - spec.min)
        const long = spec.kind === 'wall' ? size : size * (0.7 + rand() * 0.6)
        const w = spec.kind === 'wall' ? 0.6 : size
        const d = spec.kind === 'wall' ? long : size * (0.7 + rand() * 0.6)
        const rot = spec.kind === 'wall' ? Math.floor(rand() * 4) * (Math.PI / 4) : rand() * Math.PI
        const reach = Math.max(w, d) / 2
        if (distToPath(x, z, level.path) < spec.clear + reach) continue
        if (level.cellAt(x, z, 2 + reach)) continue
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + reach + 0.6)) continue
        props.push({ kind: spec.kind, x, z, w, d, h: size, rot })
        placed.push({ x, z, r: reach })
        if (SOLID[spec.kind]) {
          // approximate the rotated footprint with an axis-aligned blocker
          const hw = (Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d) / 2
          const hd = (Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * d) / 2
          obstacles.push({ x, z, hw, hd })
        }
        break
      }
    }
  }
  return { props, obstacles }
}
