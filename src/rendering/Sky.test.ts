import { describe, it, expect } from 'vitest'
import { cloudRingPositions } from './Sky'

describe('cloudRingPositions', () => {
  it('returns the requested count', () => {
    expect(cloudRingPositions(10, 80, -4)).toHaveLength(10)
  })
  it('places clouds on a ring of the given radius at the given height', () => {
    for (const p of cloudRingPositions(8, 80, -4)) {
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(80, 0)
      expect(p.y).toBe(-4)
    }
  })
  it('count 0 yields no clouds', () => {
    expect(cloudRingPositions(0, 80, -4)).toHaveLength(0)
  })
})
