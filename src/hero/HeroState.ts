import { EventBus } from '../core/EventBus'
export class HeroState {
  hp: number
  private maxHp: number
  private respawn: number
  private _alive = true
  private timer = 0
  constructor(private bus: EventBus, opts?: { maxHp?: number; respawn?: number }) {
    this.maxHp = opts?.maxHp ?? 100
    this.respawn = opts?.respawn ?? 5
    this.hp = this.maxHp
  }
  get alive() { return this._alive }
  get respawning() { return !this._alive }
  takeDamage(n: number) {
    if (!this._alive) return
    this.hp = Math.max(0, this.hp - n)
    if (this.hp === 0) { this._alive = false; this.timer = this.respawn; this.bus.emit('heroDied', {}) }
  }
  tick(dt: number) {
    if (this._alive) return
    this.timer -= dt
    if (this.timer <= 0) { this._alive = true; this.hp = this.maxHp }
  }
}
