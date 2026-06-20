import { describe, it, expect } from 'vitest'
import { VoiceLimiter } from '../../src/audio/VoiceLimiter'

describe('VoiceLimiter', () => {
  it('rejects retriggers inside the cooldown window', () => {
    const vl = new VoiceLimiter({ defaultMax: 8, defaultCooldownMs: 40 })
    expect(vl.request('shoot', 0)).toBe(true)
    expect(vl.request('shoot', 20)).toBe(false) // within 40ms
    expect(vl.request('shoot', 41)).toBe(true)  // past cooldown
  })
  it('coalesces same-frame triggers to one (cooldown > 0)', () => {
    const vl = new VoiceLimiter({ defaultMax: 8, defaultCooldownMs: 40 })
    expect(vl.request('shoot', 100)).toBe(true)
    expect(vl.request('shoot', 100)).toBe(false)
    expect(vl.request('shoot', 100)).toBe(false)
  })
  it('caps concurrent active voices and recovers after release', () => {
    const vl = new VoiceLimiter({ defaultMax: 2, defaultCooldownMs: 0 })
    expect(vl.request('hit', 0)).toBe(true)
    expect(vl.request('hit', 1)).toBe(true)
    expect(vl.request('hit', 2)).toBe(false) // at cap
    vl.release('hit')
    expect(vl.request('hit', 3)).toBe(true)
  })
  it('honors per-call overrides', () => {
    const vl = new VoiceLimiter({ defaultMax: 8, defaultCooldownMs: 0 })
    expect(vl.request('boss', 0, { max: 1 })).toBe(true)
    expect(vl.request('boss', 0, { max: 1 })).toBe(false)
  })
})
