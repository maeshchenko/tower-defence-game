import { describe, it, expect } from 'vitest'
import { semitoneToRate, randRange, RoundRobin } from '../../src/audio/variation'

describe('semitoneToRate', () => {
  it('returns 1 at 0 semitones', () => expect(semitoneToRate(0)).toBeCloseTo(1))
  it('returns 2 at +12 semitones', () => expect(semitoneToRate(12)).toBeCloseTo(2))
  it('returns 0.5 at -12 semitones', () => expect(semitoneToRate(-12)).toBeCloseTo(0.5))
})

describe('randRange', () => {
  it('maps rand=0 to min and rand→1 to max', () => {
    expect(randRange(0.7, 1.0, () => 0)).toBeCloseTo(0.7)
    expect(randRange(0.7, 1.0, () => 1)).toBeCloseTo(1.0)
    expect(randRange(-3, 0, () => 0.5)).toBeCloseTo(-1.5)
  })
})

describe('RoundRobin', () => {
  it('never returns the same item twice in a row over a long run', () => {
    const rr = new RoundRobin(['a', 'b', 'c'])
    let prev = ''
    let seq = 0
    const vals = [0, 0, 0, 0.5, 0.9, 0.1, 0.99, 0.34]
    for (let i = 0; i < 50; i++) {
      const v = rr.next(() => vals[seq++ % vals.length])
      expect(v).not.toBe(prev)
      prev = v
    }
  })
  it('returns the only item when length is 1', () => {
    const rr = new RoundRobin(['x'])
    expect(rr.next()).toBe('x')
    expect(rr.next()).toBe('x')
  })
})
