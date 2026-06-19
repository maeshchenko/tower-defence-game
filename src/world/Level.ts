import { Vec3, dist } from '../core/Vec3'

export interface BuildCell { id: string; pos: Vec3; occupied: boolean }

export class Level {
  constructor(
    readonly path: Vec3[],
    readonly cells: BuildCell[],
  ) {}
  get spawn(): Vec3 { return this.path[0] }
  get base(): Vec3 { return this.path[this.path.length - 1] }

  cellAt(x: number, z: number, radius = 1.0): BuildCell | undefined {
    let best: BuildCell | undefined
    let bestD = radius
    for (const c of this.cells) {
      const d = dist(c.pos, { x, y: 0, z })
      if (d <= bestD) { bestD = d; best = c }
    }
    return best
  }

  static demo(): Level {
    const y = 0
    const path: Vec3[] = [
      { x: -12, y, z: -12 }, { x: -12, y, z: 6 },
      { x: 6, y, z: 6 }, { x: 6, y, z: 12 },
    ]
    const cellPos: Vec3[] = [
      { x: -9, y, z: -8 }, { x: -15, y, z: -2 }, { x: -9, y, z: 2 },
      { x: -8, y, z: 9 }, { x: 2, y, z: 3 }, { x: 9, y, z: 3 },
      { x: 3, y, z: 9 }, { x: 9, y, z: 9 },
    ]
    const cells = cellPos.map((pos, i) => ({ id: `c${i}`, pos, occupied: false }))
    return new Level(path, cells)
  }
}
