// tests/rendering/Quality.test.ts
import { describe, it, expect } from 'vitest'
import { resolveQuality, nextPreset, loadPreset, savePreset, QUALITY_ORDER, MiniStorage } from '../../src/rendering/Quality'

function fakeStore(init: Record<string, string> = {}): MiniStorage {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) } }
}

describe('resolveQuality', () => {
  it('low: no shadows, no bloom, no ssao, fxaa+glow+fog on', () => {
    const c = resolveQuality('low')
    expect(c).toMatchObject({ preset: 'low', shadows: false, bloom: false, ssao: false, fxaa: true, glow: true, fog: true, shadowMapSize: 0 })
  })
  it('med: shadows@1024 + bloom, no ssao', () => {
    const c = resolveQuality('med')
    expect(c).toMatchObject({ preset: 'med', shadows: true, shadowMapSize: 1024, bloom: true, ssao: false })
  })
  it('high: shadows@2048 + bloom + ssao', () => {
    const c = resolveQuality('high')
    expect(c).toMatchObject({ preset: 'high', shadows: true, shadowMapSize: 2048, bloom: true, ssao: true })
  })
})

describe('nextPreset', () => {
  it('cycles low→med→high→low', () => {
    expect(nextPreset('low')).toBe('med')
    expect(nextPreset('med')).toBe('high')
    expect(nextPreset('high')).toBe('low')
  })
  it('order constant matches', () => {
    expect(QUALITY_ORDER).toEqual(['low', 'med', 'high'])
  })
})

describe('load/save', () => {
  it('round-trips a saved preset', () => {
    const s = fakeStore()
    savePreset('high', s)
    expect(loadPreset(s)).toBe('high')
  })
  it('defaults to med when missing', () => {
    expect(loadPreset(fakeStore())).toBe('med')
  })
  it('defaults to med on garbage', () => {
    expect(loadPreset(fakeStore({ 'td.quality': 'ultra' }))).toBe('med')
  })
  it('defaults to med with no storage', () => {
    expect(loadPreset(undefined)).toBe('med')
  })
})
