import { describe, it, expect } from 'vitest'
import { DuckController } from '../../src/audio/DuckController'

describe('DuckController', () => {
  it('multiplier is 1 when no ducks active', () => {
    const d = new DuckController(0.4)
    expect(d.count).toBe(0)
    expect(d.pop()).toBe(1) // pop below zero stays at 1
  })
  it('ducks while at least one is active, restores when all released', () => {
    const d = new DuckController(0.4)
    expect(d.push()).toBeCloseTo(0.4)
    expect(d.push()).toBeCloseTo(0.4) // overlapping duck stays ducked
    expect(d.count).toBe(2)
    expect(d.pop()).toBeCloseTo(0.4)  // still one active
    expect(d.pop()).toBe(1)           // all released
  })
})
