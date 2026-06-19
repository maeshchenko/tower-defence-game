import { Vec3 } from '../core/Vec3'
import { PathFollower } from '../world/PathFollower'
import { EnemyDef, EnemyKind } from './EnemyTypes'

export class Enemy {
  hp: number
  readonly bounty: number
  readonly kind: EnemyKind
  private follower: PathFollower
  constructor(def: EnemyDef, path: Vec3[]) {
    this.hp = def.hp; this.bounty = def.bounty; this.kind = def.kind
    this.follower = new PathFollower(path, def.speed)
  }
  get pos(): Vec3 { return this.follower.pos }
  get alive(): boolean { return this.hp > 0 && !this.follower.done }
  get reachedBase(): boolean { return this.follower.done && this.hp > 0 }
  update(dt: number) { if (this.hp > 0) this.follower.advance(dt) }
  takeDamage(n: number) { this.hp = Math.max(0, this.hp - n) }
}
