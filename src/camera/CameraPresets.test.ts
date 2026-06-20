import { describe, it, expect } from 'vitest'
import { ISO_BETA, PRESET_ALPHAS, nextPresetAlpha, easeAlpha } from './CameraPresets'

describe('CameraPresets', () => {
  it('iso beta is a fixed tilt above the ground (between horizon and top-down)', () => {
    expect(ISO_BETA).toBeGreaterThan(0.4)
    expect(ISO_BETA).toBeLessThan(1.3)
  })

  it('has 4 diagonal presets a quarter-turn apart', () => {
    expect(PRESET_ALPHAS).toHaveLength(4)
    const sorted = [...PRESET_ALPHAS].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeCloseTo(Math.PI / 2, 5)
    }
  })

  it('nextPresetAlpha advances ~90deg in the requested direction without wrap jumps', () => {
    const a = PRESET_ALPHAS[0]
    const fwd = nextPresetAlpha(a, 1)
    expect(fwd - a).toBeCloseTo(Math.PI / 2, 5)
    const back = nextPresetAlpha(a, -1)
    expect(a - back).toBeCloseTo(Math.PI / 2, 5)
  })

  it('easeAlpha moves toward target and reaches it', () => {
    let cur = 0
    const target = 1
    for (let i = 0; i < 600; i++) cur = easeAlpha(cur, target, 1 / 60)
    expect(cur).toBeCloseTo(target, 2)
  })

  it('easeAlpha takes the short way around the circle', () => {
    // target just past +pi should move negatively (short arc), not +almost-2pi
    const next = easeAlpha(0.1, 0.1 + Math.PI + 0.2, 1 / 60)
    expect(next).toBeLessThan(0.1) // went negative (short arc)
  })
})
