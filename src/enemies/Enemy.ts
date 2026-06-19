import { Vec3, dist } from '../core/Vec3'
import { PathFollower } from '../world/PathFollower'
import { EnemyDef, EnemyKind } from './EnemyTypes'

export class Enemy {
  hp: number
  readonly maxHp: number
  readonly bounty: number
  readonly kind: EnemyKind
  private follower: PathFollower
  private slowFactor = 1
  private slowTimer = 0
  private atk: number
  private atkRange: number
  private atkCd: number
  private atkInterval: number
  constructor(def: EnemyDef, path: Vec3[]) {
    this.hp = def.hp; this.maxHp = def.hp; this.bounty = def.bounty; this.kind = def.kind
    this.atk = def.atk; this.atkRange = def.atkRange
    this.atkInterval = 1 / def.atkRate; this.atkCd = this.atkInterval
    this.follower = new PathFollower(path, def.speed)
  }
  get pos(): Vec3 { return this.follower.pos }
  get alive(): boolean { return this.hp > 0 && !this.follower.done }
  get reachedBase(): boolean { return this.follower.done && this.hp > 0 }
  update(dt: number) {
    if (this.hp <= 0) return
    const eff = this.slowFactor
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1 }
    this.follower.advance(dt * eff)
  }
  takeDamage(n: number) { this.hp = Math.max(0, this.hp - n) }
  // fire at the hero when alive, in range and off cooldown; returns shot damage or null
  attack(dt: number, heroPos: Vec3): number | null {
    if (!this.alive) return null
    this.atkCd -= dt
    if (this.atkCd > 0) return null
    if (dist(this.pos, heroPos) > this.atkRange) return null
    this.atkCd = this.atkInterval
    return this.atk
  }
  applySlow(factor: number, duration: number) {
    this.slowFactor = Math.min(this.slowFactor, factor)
    this.slowTimer = Math.max(this.slowTimer, duration)
  }
}
