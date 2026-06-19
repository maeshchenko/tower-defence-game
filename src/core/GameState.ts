import { EventBus } from './EventBus'
export type Phase = 'build' | 'wave' | 'gameover'

export class GameState {
  private _gold: number
  private _lives: number
  private _wave = 0
  private _phase: Phase = 'build'
  readonly totalWaves: number
  constructor(private bus: EventBus, opts?: { gold?: number; lives?: number; totalWaves?: number }) {
    this._gold = opts?.gold ?? 100
    this._lives = opts?.lives ?? 20
    this.totalWaves = opts?.totalWaves ?? 10
  }
  get gold() { return this._gold }
  get lives() { return this._lives }
  get wave() { return this._wave }
  get phase() { return this._phase }
  addGold(n: number) { this._gold += n }
  spendGold(n: number): boolean {
    if (n > this._gold) return false
    this._gold -= n; return true
  }
  damageBase(n: number) {
    this._lives = Math.max(0, this._lives - n)
    this.bus.emit('baseHit', { remaining: this._lives })
    if (this._lives === 0) { this._phase = 'gameover'; this.bus.emit('gameOver', { victory: false }) }
  }
  startWave() { if (this._phase === 'build') { this._phase = 'wave'; this._wave += 1 } }
  endWave() {
    if (this._phase !== 'wave') return
    if (this._wave >= this.totalWaves) { this._phase = 'gameover'; this.bus.emit('gameOver', { victory: true }) }
    else this._phase = 'build'
  }
}
