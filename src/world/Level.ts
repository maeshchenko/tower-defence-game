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

  // dense samples along the path polyline (for coverage scoring)
  private static sample(path: Vec3[], step: number): Vec3[] {
    const out: Vec3[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1]
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
      const n = Math.max(1, Math.ceil(len / step))
      for (let k = 0; k < n; k++) { const u = k / n; out.push({ x: a.x + (b.x - a.x) * u, y: 0, z: a.z + (b.z - a.z) * u }) }
    }
    out.push(path[path.length - 1])
    return out
  }

  // Strategic build cells: instead of 2 per segment on both sides, greedily place a
  // LIMITED number of pads at the spots that cover the most path — chokepoints and
  // hairpins (where one tower reaches several lanes) get picked first. `budget` caps
  // the count so a big map stays "medium": enough to defend with good placement, not
  // so many it plays itself. Pads sit beside the road, never clustered.
  static fromPathStrategic(path: Vec3[], budget: number): Level {
    const COV_R = 6.0   // tower reach used for coverage scoring
    const STEP = 2.0    // path sampling granularity
    const OFFSET = 3.2  // how far beside the road a pad sits
    const MINSEP = 4.0  // keep pads apart so they don't bunch on one chokepoint
    const samples = Level.sample(path, STEP)
    const cands: Vec3[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1]
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1
      const px = -dz / len, pz = dx / len // unit perpendicular
      for (let t = 0; t < len; t += STEP) {
        const cx = a.x + dx * (t / len), cz = a.z + dz * (t / len)
        for (const s of [OFFSET, -OFFSET]) cands.push({ x: cx + px * s, y: 0, z: cz + pz * s })
      }
    }
    const covered = new Array(samples.length).fill(false)
    const chosen: Vec3[] = []
    const within = (p: Vec3, q: Vec3, r: number) => Math.hypot(p.x - q.x, p.z - q.z) <= r
    for (let n = 0; n < budget; n++) {
      let best = -1, bestGain = 0
      for (let c = 0; c < cands.length; c++) {
        if (chosen.some((p) => within(p, cands[c], MINSEP))) continue // no clustering
        let gain = 0
        for (let s = 0; s < samples.length; s++) if (!covered[s] && within(samples[s], cands[c], COV_R)) gain++
        if (gain > bestGain) { bestGain = gain; best = c }
      }
      if (best < 0 || bestGain === 0) break
      chosen.push(cands[best])
      for (let s = 0; s < samples.length; s++) if (!covered[s] && within(samples[s], cands[best], COV_R)) covered[s] = true
    }
    const cells = chosen.map((pos, i) => ({ id: `c${i}`, pos, occupied: false }))
    return new Level(path, cells)
  }

  // build a level from a path, auto-placing build cells perpendicular to each segment
  static fromPath(path: Vec3[]): Level {
    const cells: BuildCell[] = []
    let id = 0
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1]
      const dx = b.x - a.x, dz = b.z - a.z
      const len = Math.hypot(dx, dz) || 1
      const px = -dz / len, pz = dx / len // unit perpendicular
      for (const t of [0.33, 0.66]) {
        const cx = a.x + dx * t, cz = a.z + dz * t
        for (const side of [3, -3]) {
          cells.push({ id: `c${id++}`, pos: { x: cx + px * side, y: 0, z: cz + pz * side }, occupied: false })
        }
      }
    }
    return new Level(path, cells)
  }

  // the campaign's 10 maps. Maps 1-3 are the original small teaching paths
  // (unchanged). Maps 4-5 are the originals scaled x2 (4x area). Maps 6-10 are new
  // large layouts. Every big map (4-10) uses STRATEGIC cells (fromPathStrategic):
  // a tuned, limited number of pads at chokepoints — "medium" difficulty, so good
  // placement matters. Per-map budgets are sim-validated (src/sim/report.test.ts).
  static maps(): Level[] {
    const y = 0
    const sc = (pts: [number, number][]): Vec3[] => pts.map(([x, z]) => ({ x: x * 2, y, z: z * 2 })) // x2 scale helper
    const big = (pts: [number, number][]): Vec3[] => pts.map(([x, z]) => ({ x, y, z })) // already big coords
    return [
      Level.demo(), // 1 — tutorial: short L
      Level.fromPath([ // 2 — S-curve
        { x: -15, y, z: -12 }, { x: 12, y, z: -12 }, { x: 12, y, z: 2 }, { x: -11, y, z: 2 }, { x: -11, y, z: 13 },
      ]),
      Level.fromPath([ // 3 — big U
        { x: -14, y, z: 13 }, { x: -14, y, z: -13 }, { x: 14, y, z: -13 }, { x: 14, y, z: 13 },
      ]),
      // 4 — zigzag, x2 (was ±15 -> now ±30)
      Level.fromPathStrategic(sc([[-15, -14], [-15, 8], [-5, 8], [-5, -8], [6, -8], [6, 9], [15, 9], [15, 15]]), 12),
      // 5 — long snake, x2
      Level.fromPathStrategic(sc([[-15, -15], [10, -15], [10, -5], [-10, -5], [-10, 5], [11, 5], [11, 15]]), 12),
      // 6 — double switchback
      Level.fromPathStrategic(big([[-30, -26], [30, -26], [30, -10], [-26, -10], [-26, 6], [30, 6], [30, 26], [-30, 26]]), 14),
      // 7 — inward spiral (compact geometry over-covers, so fewer pads)
      Level.fromPathStrategic(big([[-30, -30], [30, -30], [30, 30], [-18, 30], [-18, -18], [18, -18], [18, 18], [-6, 18], [-6, -6]]), 12),
      // 8 — comb / fingers
      Level.fromPathStrategic(big([[-30, -28], [-30, 20], [-18, 20], [-18, -20], [-6, -20], [-6, 20], [8, 20], [8, -20], [22, -20], [22, 20], [30, 20], [30, 28]]), 16),
      // 9 — wide staircase
      Level.fromPathStrategic(big([[-30, -28], [-10, -28], [-10, -10], [-30, -10], [-30, 8], [10, 8], [10, -8], [30, -8], [30, 28], [-30, 28]]), 16),
      // 10 — grand serpentine finale (parallel runs over-cover; keep pads lean)
      Level.fromPathStrategic(big([[-30, -30], [22, -30], [22, -14], [-22, -14], [-22, 2], [22, 2], [22, 18], [-22, 18], [-22, 30], [30, 30]]), 10),
    ]
  }
}
