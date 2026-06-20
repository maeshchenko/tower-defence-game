import { describe, it, expect } from 'vitest'
import { Speed, SPEED_STEPS } from '../../src/ui/Speed'

describe('Speed', () => {
  it('defaults to 1x running', () => {
    const s = new Speed()
    expect(s.scale).toBe(1)
    expect(s.paused).toBe(false)
  })
  it('pause makes scale 0 but remembers the multiplier', () => {
    const s = new Speed()
    s.setMultiplier(3)
    s.togglePause()
    expect(s.paused).toBe(true)
    expect(s.scale).toBe(0)
    expect(s.multiplier).toBe(3)
    s.togglePause()
    expect(s.scale).toBe(3)
  })
  it('cycles 1 -> 2 -> 3 -> 1', () => {
    const s = new Speed()
    s.cycle(); expect(s.multiplier).toBe(2)
    s.cycle(); expect(s.multiplier).toBe(3)
    s.cycle(); expect(s.multiplier).toBe(1)
  })
  it('choosing a speed unpauses', () => {
    const s = new Speed()
    s.togglePause()
    s.setMultiplier(2)
    expect(s.paused).toBe(false)
    expect(s.scale).toBe(2)
  })
  it('rejects an invalid multiplier, falling back to 1', () => {
    const s = new Speed()
    s.setMultiplier(7)
    expect(s.multiplier).toBe(1)
  })
  it('SPEED_STEPS are 1,2,3', () => {
    expect([...SPEED_STEPS]).toEqual([1, 2, 3])
  })
})
