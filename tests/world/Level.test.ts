import { describe, it, expect } from 'vitest'
import { Level } from '../../src/world/Level'

describe('Level.demo', () => {
  const lvl = Level.demo()
  it('path starts at spawn ends at base', () => {
    expect(lvl.path[0]).toEqual(lvl.spawn)
    expect(lvl.path[lvl.path.length - 1]).toEqual(lvl.base)
    expect(lvl.path.length).toBeGreaterThanOrEqual(3)
  })
  it('has build cells, none occupied initially', () => {
    expect(lvl.cells.length).toBeGreaterThanOrEqual(6)
    expect(lvl.cells.every(c => !c.occupied)).toBe(true)
  })
  it('cellAt finds nearest within radius', () => {
    const c = lvl.cells[0]
    expect(lvl.cellAt(c.pos.x, c.pos.z)?.id).toBe(c.id)
    expect(lvl.cellAt(999, 999)).toBeUndefined()
  })
})
