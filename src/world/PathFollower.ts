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
