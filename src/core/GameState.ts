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
  // send the next wave WHILE the current one is still on the field (overlap), for a
  // gold bonus. Only once the current wave has finished spawning and not on the last.
  callNextWaveEarly(): boolean {
    if (this._phase !== 'wave' || this._wave >= this.totalWaves) return false
    this._wave += 1; return true
  }
  endWave() {
    if (this._phase !== 'wave') return
    if (this._wave >= this.totalWaves) { this._phase = 'gameover'; this.bus.emit('gameOver', { victory: true }) }
    else this._phase = 'build'
  }
  // advance to the next map: reset wave count and resume building
  nextMap() { this._wave = 0; this._phase = 'build' }
  // start a map with a fresh gold + lives budget (NO carry-over — gold must stay
  // tight so every map is its own economic puzzle and gold never snowballs).
  beginMap(gold: number, lives: number) { this._gold = gold; this._lives = lives; this._wave = 0; this._phase = 'build' }
}
