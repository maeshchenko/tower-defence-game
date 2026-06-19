import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'

describe('EventBus', () => {
  it('calls subscribers with payload', () => {
    const bus = new EventBus()
    const cb = vi.fn()
    bus.on('enemyKilled', cb)
    bus.emit('enemyKilled', { bounty: 10 })
    expect(cb).toHaveBeenCalledWith({ bounty: 10 })
  })
  it('unsubscribe stops calls', () => {
    const bus = new EventBus()
    const cb = vi.fn()
    const off = bus.on('baseHit', cb)
    off()
    bus.emit('baseHit', { remaining: 5 })
    expect(cb).not.toHaveBeenCalled()
  })
})
