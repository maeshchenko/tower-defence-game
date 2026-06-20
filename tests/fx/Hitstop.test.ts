import { describe, it, expect } from 'vitest'
import { Hitstop } from '../../src/fx/Hitstop'

describe('Hitstop', () => {
  it('returns sim scale 1 when idle', () => {
    const h = new Hitstop()
    expect(h.update(16)).toBe(1)
    expect(h.frozen).toBe(false)
  })

  it('freezes (scale 0) for the triggered duration then resumes', () => {
    const h = new Hitstop()
    h.trigger(70)
    expect(h.update(16)).toBe(0) // 54 left
    expect(h.update(16)).toBe(0) // 38 left
    expect(h.update(16)).toBe(0) // 22 left
    expect(h.update(16)).toBe(0) // 6 left
    expect(h.update(16)).toBe(0) // drains to -10 this frame, still reports frozen
    expect(h.frozen).toBe(false)
    expect(h.update(16)).toBe(1) // next frame resumes
  })

  it('overlapping trigger extends to the longer remaining time', () => {
    const h = new Hitstop()
    h.trigger(30)
    h.update(10) // 20 left
    h.trigger(70) // extend to 70 (longer than 20)
    let frames = 0
    while (h.frozen) { h.update(16); frames++; if (frames > 100) break }
    expect(frames).toBe(5) // ceil(70/16)
  })

  it('a shorter trigger does not cut an active longer freeze', () => {
    const h = new Hitstop()
    h.trigger(80)
    h.update(10) // 70 left
    h.trigger(20) // shorter, ignored
    expect(h.frozen).toBe(true)
    expect(h.update(10)).toBe(0) // still frozen (60 left)
  })
})
