import { Vec3 } from '../core/Vec3'

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
    // in-place math (no per-frame Vec3 allocations: this runs for every enemy every frame)
    while (budget > 0 && !this.done) {
      const tgt = this.path[this.target]
      const dx = tgt.x - this.pos.x, dy = tgt.y - this.pos.y, dz = tgt.z - this.pos.z
      const d = Math.hypot(dx, dy, dz)
      if (d <= budget) {
        this.pos.x = tgt.x; this.pos.y = tgt.y; this.pos.z = tgt.z
        budget -= d
        this.target += 1
        if (this.target >= this.path.length) { this.done = true; this.target = this.path.length - 1 }
      } else {
        const inv = budget / d
        this.pos.x += dx * inv; this.pos.y += dy * inv; this.pos.z += dz * inv
        budget = 0
      }
    }
  }
}
