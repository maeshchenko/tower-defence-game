import { Vec3 } from '../core/Vec3'
import { Enemy } from './Enemy'
import { ENEMY_DEFS, EnemyKind } from './EnemyTypes'

export interface WaveEntry { kind: EnemyKind; count: number; interval: number }
interface Pending { kind: EnemyKind; interval: number; remaining: number; timer: number }

export class WaveManager {
  private _active: Enemy[] = []
  private queue: Pending[] = []
  constructor(private path: Vec3[], private waves: WaveEntry[][]) {}
  get active() { return this._active }
  get spawning() { return this.queue.length > 0 }

  startWave(index: number) {
    const w = this.waves[index] ?? []
    this.queue = w.map((g) => ({ kind: g.kind, interval: g.interval, remaining: g.count, timer: 0 }))
  }
  update(dt: number): Enemy[] {
    const spawned: Enemy[] = []
    for (const g of this.queue) {
      g.timer -= dt
      while (g.remaining > 0 && g.timer <= 0) {
        const e = new Enemy(ENEMY_DEFS[g.kind], this.path)
        this._active.push(e); spawned.push(e)
        g.remaining -= 1
        g.timer += g.interval
      }
    }
    this.queue = this.queue.filter((g) => g.remaining > 0)
    return spawned
  }
  remove(e: Enemy) { this._active = this._active.filter((x) => x !== e) }
  cleared(): boolean { return !this.spawning && this._active.length === 0 }

  static demoWaves(): WaveEntry[][] {
    const w: WaveEntry[][] = []
    for (let i = 0; i < 10; i++) {
      const groups: WaveEntry[] = [{ kind: 'normal', count: 4 + i * 2, interval: 0.8 }]
      if (i >= 2) groups.push({ kind: 'fast', count: 2 + i, interval: 0.5 })
      if (i >= 4) groups.push({ kind: 'tank', count: Math.floor(i / 2), interval: 1.5 })
      w.push(groups)
    }
    return w
  }

  // exactly 2 waves per map, escalating with map index
  static mapWaves(mapIndex: number): WaveEntry[][] {
    const b = mapIndex * 3
    const w1: WaveEntry[] = [{ kind: 'normal', count: 5 + b, interval: 0.8 }]
    const w2: WaveEntry[] = [
      { kind: 'normal', count: 6 + b, interval: 0.7 },
      { kind: 'fast', count: 2 + mapIndex, interval: 0.5 },
    ]
    if (mapIndex >= 1) w2.push({ kind: 'tank', count: mapIndex, interval: 1.5 })
    return [w1, w2]
  }
}
