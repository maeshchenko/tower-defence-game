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

  // composition of a wave (for the "next wave" preview); empty if past the last wave
  peek(index: number): WaveEntry[] { return this.waves[index] ?? [] }
  get waveCount(): number { return this.waves.length }

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

  // 10 waves per map, escalating within the map (i) and across maps (mapIndex).
  // Enemy variety unlocks over the run; every map ends on a boss wave.
  static mapWaves(mapIndex: number): WaveEntry[][] {
    const b = mapIndex * 3 // later maps start harder
    const w: WaveEntry[][] = []
    for (let i = 0; i < 10; i++) {
      const g: WaveEntry[] = [{ kind: 'normal', count: 4 + b + i * 2, interval: 0.8 }]
      if (i >= 1) g.push({ kind: 'fast', count: 2 + mapIndex + i, interval: 0.5 })
      if (i >= 2) g.push({ kind: 'rogue', count: 2 + i, interval: 0.4 })
      if (i >= 4) g.push({ kind: 'brute', count: mapIndex + Math.floor(i / 3), interval: 1.2 })
      if (i >= 5) g.push({ kind: 'tank', count: mapIndex + Math.floor((i - 3) / 2), interval: 1.5 })
      if (i >= 6 && i < 9) g.push({ kind: 'healer', count: 1 + Math.floor((i - 6) / 2), interval: 2.0 })
      if (i === 9) g.push({ kind: 'boss', count: mapIndex >= 3 ? 2 : 1, interval: 4.0 }) // finale
      w.push(g)
    }
    return w
  }
}
