import { describe, it, expect } from 'vitest'
import { Screenshake } from '../../src/fx/Screenshake'

describe('Screenshake', () => {
  it('accumulates trauma and caps at 1', () => {
    const s = new Screenshake()
    s.addTrauma(0.3); s.addTrauma(0.3)
    expect(s.value).toBeCloseTo(0.6)
    s.addTrauma(1)
    expect(s.value).toBe(1)
  })

  it('never goes below 0', () => {
    const s = new Screenshake()
    s.addTrauma(-5)
    expect(s.value).toBe(0)
  })

  it('intensity is trauma squared', () => {
    const s = new Screenshake()
    s.addTrauma(0.5)
    expect(s.intensity()).toBeCloseTo(0.25)
  })

  it('decays toward 0 over time', () => {
    const s = new Screenshake(1.5)
    s.addTrauma(1)
    for (let i = 0; i < 60; i++) s.step(1 / 60, 0.5) // ~1s at 60fps
    expect(s.value).toBe(0)
  })

  it('offset is zero when there is no trauma', () => {
    const s = new Screenshake()
    const off = s.step(0.016, 0.5)
    expect(off.x).toBeCloseTo(0) // 0 * noise can be -0; magnitude is what matters
    expect(off.y).toBeCloseTo(0)
  })

  it('offset is bounded by maxAmp * intensity', () => {
    const s = new Screenshake(0) // no decay, so intensity holds across the sample
    s.addTrauma(1)
    for (let i = 0; i < 50; i++) {
      const off = s.step(0.016, 0.4)
      expect(Math.abs(off.x)).toBeLessThanOrEqual(0.4)
      expect(Math.abs(off.y)).toBeLessThanOrEqual(0.4)
    }
  })
})
