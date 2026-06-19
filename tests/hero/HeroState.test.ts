import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { HeroState } from '../../src/hero/HeroState'

describe('HeroState', () => {
  it('takes damage and dies, emits heroDied', () => {
    const bus = new EventBus(); const died = vi.fn(); bus.on('heroDied', died)
    const h = new HeroState(bus, { maxHp: 50 })
    h.takeDamage(50)
    expect(h.alive).toBe(false); expect(h.respawning).toBe(true)
    expect(died).toHaveBeenCalled()
  })
  it('respawns after timer', () => {
    const h = new HeroState(new EventBus(), { maxHp: 50, respawn: 3 })
    h.takeDamage(50)
    h.tick(3)
    expect(h.alive).toBe(true); expect(h.hp).toBe(50)
  })
})
