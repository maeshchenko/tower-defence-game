import { test, expect } from 'vitest'
import { MODELS, normalizeScale } from './models'

test('normalizeScale maps raw model height to target game height', () => {
  expect(normalizeScale(0.44, 2.2)).toBeCloseTo(5.0, 2)
  expect(normalizeScale(2.0, 2.0)).toBeCloseTo(1.0, 2)
})

test('normalizeScale is safe for degenerate height', () => {
  expect(normalizeScale(0, 2)).toBe(1) // avoid divide-by-zero -> identity
})

test('registry has every logical key the views request', () => {
  for (const k of [
    'tower.cannon', 'tower.slow', 'tower.sniper',
    'enemy.normal', 'enemy.fast', 'enemy.tank',
    'hero.knight',
    'ammo.cannon', 'ammo.sniper', 'ammo.slow',
    'prop.tree', 'prop.rock', 'prop.wall', 'prop.crate',
    'base.keep',
  ]) {
    expect(MODELS[k], k).toBeDefined()
    expect(MODELS[k].url.startsWith('/models/'), k).toBe(true)
  }
})
