import { describe, it, expect, beforeEach } from 'vitest'
import { AudioBus } from '../../src/audio/AudioBus'

// AudioBus only touches AudioContext lazily (on first sound/unlock); volume + persist
// logic runs without it, so we can unit-test it under the node env with a fake store.
function installStore() {
  const m = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
  }
  return m
}

describe('AudioBus', () => {
  beforeEach(() => installStore())

  it('defaults volumes and unmuted', () => {
    const b = new AudioBus()
    expect(b.getVolume('master')).toBeCloseTo(0.8)
    expect(b.getVolume('music')).toBeCloseTo(0.45)
    expect(b.getVolume('sfx')).toBeCloseTo(0.8)
    expect(b.muted).toBe(false)
  })
  it('clamps volume to [0,1]', () => {
    const b = new AudioBus()
    b.setVolume('sfx', 5); expect(b.getVolume('sfx')).toBe(1)
    b.setVolume('sfx', -2); expect(b.getVolume('sfx')).toBe(0)
  })
  it('persists across instances', () => {
    const a = new AudioBus()
    a.setVolume('music', 0.2)
    a.toggleMute()
    const b = new AudioBus()
    expect(b.getVolume('music')).toBeCloseTo(0.2)
    expect(b.muted).toBe(true)
  })
  it('falls back to defaults on garbage stored data', () => {
    ;(globalThis as any).localStorage.setItem('td.audio', '{not json')
    const b = new AudioBus()
    expect(b.getVolume('master')).toBeCloseTo(0.8)
  })
  it('exposes the nominal master volume unchanged by headroom', () => {
    const b = new AudioBus()
    // headroom is applied at the graph level, not to the stored/displayed volume
    expect(b.getVolume('master')).toBeCloseTo(0.8)
  })
})
