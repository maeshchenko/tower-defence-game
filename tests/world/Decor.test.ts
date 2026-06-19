import { describe, it, expect } from 'vitest'
import { Level } from '../../src/world/Level'
import { generateDecor } from '../../src/world/Decor'

function minDistToPath(x: number, z: number, path: { x: number; z: number }[]): number {
  let min = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1
    let t = ((x - a.x) * dx + (z - a.z) * dz) / l2
    t = Math.max(0, Math.min(1, t))
    min = Math.min(min, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)))
  }
  return min
}

describe('generateDecor', () => {
  const level = Level.demo()
  it('produces props and some solid obstacles', () => {
    const d = generateDecor(level, 0)
    expect(d.props.length).toBeGreaterThan(10)
    expect(d.obstacles.length).toBeGreaterThan(0)
  })
  it('is deterministic for the same seed', () => {
    expect(generateDecor(level, 3)).toEqual(generateDecor(level, 3))
  })
  it('keeps props off the road and inside bounds', () => {
    const d = generateDecor(level, 1)
    for (const p of d.props) {
      expect(minDistToPath(p.x, p.z, level.path)).toBeGreaterThan(0.8)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(18)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(18)
    }
  })
})
