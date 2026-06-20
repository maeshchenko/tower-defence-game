import { describe, it, expect } from 'vitest'
import { effectiveDamage, singleDps, pathSamples, coverage } from './balance'
import { SIM_TOWERS } from './config'

describe('effectiveDamage (flat armor model)', () => {
  it('subtracts armor per hit, floors at 1', () => {
    expect(effectiveDamage(10, 0)).toBe(10)
    expect(effectiveDamage(10, 6)).toBe(4)
    expect(effectiveDamage(5, 6)).toBe(1) // never below 1
  })
  it('pierce ignores armor up to its value', () => {
    expect(effectiveDamage(50, 6, 4)).toBe(48) // armor reduced 6->2
    expect(effectiveDamage(50, 6, 8)).toBe(50) // pierce > armor
    expect(effectiveDamage(50, 6, 999)).toBe(50)
  })
})

describe('singleDps', () => {
  it('cannon L1 = 10*1.5 = 15 vs no armor', () => {
    expect(singleDps(SIM_TOWERS.cannon[0], 0)).toBeCloseTo(15)
  })
  it('tesla is heavily taxed vs armor (low per-hit)', () => {
    const t = SIM_TOWERS.tesla[2] // dmg 12
    expect(singleDps(t, 6)).toBeCloseTo(6 * 2.8) // 12-6=6 per hit
  })
  it('sniper L3 ignores armor via pierce', () => {
    const s = SIM_TOWERS.sniper[2]
    expect(singleDps(s, 6)).toBeCloseTo(130 * 0.55)
  })
})

describe('path coverage helpers', () => {
  const path = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]
  it('samples span the segment', () => {
    const s = pathSamples(path, 1)
    expect(s.length).toBeGreaterThan(9)
    expect(s[0]).toEqual({ x: 0, y: 0, z: 0 })
  })
  it('coverage counts samples within range', () => {
    const s = pathSamples(path, 1)
    expect(coverage({ x: 5, y: 0, z: 0 }, 2, s)).toBeGreaterThan(0)
    expect(coverage({ x: 100, y: 0, z: 0 }, 2, s)).toBe(0)
  })
})
