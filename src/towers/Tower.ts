import { Vec3, dist } from '../core/Vec3'
import { Enemy } from '../enemies/Enemy'
import { TowerKind, TowerLevel, TOWER_DEFS } from './TowerTypes'

export interface ShotResult { target: Enemy; damage: number; slow?: number }

export class Tower {
  private lvl = 0
  private cooldown: number
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
    this.cooldown -= dt
    if (this.cooldown > 0) return null
    const s = this.stats
    const target = enemies.find((e) => e.alive && dist(e.pos, this.pos) <= s.range)
    if (!target) return null
    this.cooldown = 1 / s.fireRate
    return { target, damage: s.damage, slow: s.slow }
  }
}
