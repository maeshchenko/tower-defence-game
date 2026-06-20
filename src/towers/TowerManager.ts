import { GameState } from '../core/GameState'
import { Level, BuildCell } from '../world/Level'
import { Enemy } from '../enemies/Enemy'
import { Tower, ShotResult } from './Tower'
import { TowerKind, TOWER_DEFS } from './TowerTypes'

export class TowerManager {
  private _towers: Tower[] = []
  private cellOf = new Map<Tower, BuildCell>()
  private spent = new Map<Tower, number>()
  constructor(private state: GameState, level: Level) {
    void level // Keep reference for future use
  }
  get towers() { return this._towers }

  build(kind: TowerKind, cell: BuildCell): Tower | null {
    if (cell.occupied) return null
    const cost = TOWER_DEFS[kind][0].cost
    if (!this.state.spendGold(cost)) return null
    const t = new Tower(kind, cell.pos)
    cell.occupied = true
    this._towers.push(t)
    this.cellOf.set(t, cell)
    this.spent.set(t, cost)
    return t
  }
  upgrade(t: Tower): boolean {
    const defs = TOWER_DEFS[t.kind]
    const next = t.level + 1
    if (next >= defs.length) return false
    const cost = defs[next].cost
    if (!this.state.spendGold(cost)) return false
    t.upgrade()
    this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
    return true
  }
  sellValue(t: Tower): number { return Math.floor((this.spent.get(t) ?? 0) * 0.6) }
  sell(t: Tower): void {
    const refund = Math.floor((this.spent.get(t) ?? 0) * 0.6)
    this.state.addGold(refund)
    const cell = this.cellOf.get(t)
    if (cell) cell.occupied = false
    this._towers = this._towers.filter((x) => x !== t)
    this.cellOf.delete(t); this.spent.delete(t)
  }
  update(dt: number, enemies: Enemy[]): ShotResult[] {
    const shots: ShotResult[] = []
    for (const t of this._towers) {
      const s = t.update(dt, enemies)
      if (s) shots.push(s)
    }
    return shots
  }
}
