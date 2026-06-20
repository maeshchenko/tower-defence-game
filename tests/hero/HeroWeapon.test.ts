import { describe, it, expect } from 'vitest'
import { HeroWeapon } from '../../src/hero/HeroWeapon'

describe('HeroWeapon', () => {
  it('fires then needs cooldown', () => {
    const w = new HeroWeapon({ damage: 25, fireRate: 4 })
    expect(w.fire()).toBe(25)
    expect(w.canFire()).toBe(false)
    expect(w.fire()).toBeNull()
  })
  it('recovers after enough time', () => {
    const w = new HeroWeapon({ fireRate: 4 }) // 0.25s cd
    w.fire(); w.tick(0.3)
    expect(w.canFire()).toBe(true)
  })
  it('default damage is 22 (secondary hero: punchy but not a carry)', () => {
    expect(new HeroWeapon().fire()).toBe(22)
  })
})
