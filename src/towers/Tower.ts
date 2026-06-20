import { Vec3, dist } from '../core/Vec3'
import { Enemy } from '../enemies/Enemy'
import { TowerKind, TowerLevel, TOWER_DEFS } from './TowerTypes'

export interface ShotResult {
  target?: Enemy; damage?: number; slow?: number; from: Vec3
  splashRadius?: number; chainCount?: number; chainRange?: number
  pierce?: number
  aura?: { slow: number; range: number }
}

// how a tower chooses among in-range enemies
export type TargetMode = 'first' | 'last' | 'strong' | 'weak'

// how fast each tower kind swings its barrel toward a target (radians/sec) and how
// close to on-target it must be before it may fire (radians)
const TURN_SPEED: Record<TowerKind, number> = { cannon: 2.5, slow: 3.5, sniper: 1.4, mortar: 1.6, tesla: 4.0 }
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
  targetMode: TargetMode = 'first'
  cycleTargetMode() {
    const order: TargetMode[] = ['first', 'last', 'strong', 'weak']
    this.targetMode = order[(order.indexOf(this.targetMode) + 1) % order.length]
  }
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
    if (s.aura) { // slow field: no projectile, no aim; the caller applies it each tick
      return { aura: { slow: s.slow ?? 0, range: s.range }, from: this.pos }
    }
    this.cooldown -= dt
    const inRange = enemies.filter((e) => e.alive && dist(e.pos, this.pos) <= s.range)
    let target: Enemy | undefined
    for (const e of inRange) {
      if (!target) { target = e; continue }
      const better =
        this.targetMode === 'first' ? e.traveled > target.traveled :
        this.targetMode === 'last' ? e.traveled < target.traveled :
        this.targetMode === 'strong' ? e.hp > target.hp :
        e.hp < target.hp
      if (better) target = e
    }
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
    return { target, damage: s.damage, slow: s.slow, from: this.pos, splashRadius: s.splashRadius, chainCount: s.chainCount, chainRange: s.chainRange, pierce: s.pierce }
  }
}
