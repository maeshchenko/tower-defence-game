import { Vec3, dist } from '../core/Vec3'
import { Enemy } from '../enemies/Enemy'
import { TowerKind, TowerLevel, TOWER_DEFS } from './TowerTypes'

export interface ShotResult { target: Enemy; damage: number; slow?: number; from: Vec3 }

// how fast each tower kind swings its barrel toward a target (radians/sec) and how
// close to on-target it must be before it may fire (radians)
const TURN_SPEED: Record<TowerKind, number> = { cannon: 2.5, slow: 3.5, sniper: 1.4 }
const ALIGN_THRESHOLD = 0.12

// wrap an angle into [-PI, PI] so we always turn the short way around
function normAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

export class Tower {
  private lvl = 0
  private cooldown: number
  yaw = 0 // current barrel heading (atan2(dx,dz) convention, +Z forward)
  constructor(readonly kind: TowerKind, readonly pos: Vec3) {
    this.cooldown = 1 / TOWER_DEFS[kind][0].fireRate
  }
  get level() { return this.lvl }
  get stats(): TowerLevel { return TOWER_DEFS[this.kind][this.lvl] }
  get maxLevel() { return TOWER_DEFS[this.kind].length - 1 }
  upgrade(): boolean {
    if (this.lvl >= this.maxLevel) return false
    this.lvl += 1; return true
  }
  update(dt: number, enemies: Enemy[]): ShotResult | null {
    const s = this.stats
    this.cooldown -= dt
    const target = enemies.find((e) => e.alive && dist(e.pos, this.pos) <= s.range)
    if (!target) return null
    // rotate the barrel toward the target at a bounded turn rate
    const desired = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z)
    const diff = normAngle(desired - this.yaw)
    const maxStep = TURN_SPEED[this.kind] * dt
    this.yaw = Math.abs(diff) <= maxStep ? desired : normAngle(this.yaw + Math.sign(diff) * maxStep)
    // fire only once cooled down AND actually facing the target (no instant 180° snap-shots)
    if (this.cooldown > 0) return null
    if (Math.abs(normAngle(desired - this.yaw)) > ALIGN_THRESHOLD) return null
    this.cooldown = 1 / s.fireRate
    return { target, damage: s.damage, slow: s.slow, from: this.pos }
  }
}
