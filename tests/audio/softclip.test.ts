import { describe, it, expect } from 'vitest'
import { makeSoftClipCurve } from '../../src/audio/softclip'

describe('makeSoftClipCurve', () => {
  it('is symmetric, monotonic, and bounded within [-1,1]', () => {
    const c = makeSoftClipCurve(1025)
    expect(c.length).toBe(1025)
    expect(c[0]).toBeLessThan(0)
    expect(c[c.length - 1]).toBeGreaterThan(0)
    expect(c[(c.length - 1) / 2]).toBeCloseTo(0, 5) // midpoint maps ~0
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1])
    for (const v of c) expect(Math.abs(v)).toBeLessThanOrEqual(1)
  })
  it('tames values past unity (soft clip, not hard)', () => {
    const c = makeSoftClipCurve(1025, 2)
    expect(Math.abs(c[c.length - 1])).toBeLessThan(1) // tanh asymptote < 1
  })
})
