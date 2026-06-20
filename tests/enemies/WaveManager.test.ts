import { describe, it, expect } from 'vitest'
import { WaveManager } from '../../src/enemies/WaveManager'

const path = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('WaveManager', () => {
  it('spawns enemies over time', () => {
    const wm = new WaveManager(path, [[{ kind: 'normal', count: 2, interval: 1 }]])
    wm.startWave(0)
    let spawned = wm.update(0.01) // first spawns immediately
    expect(spawned.length).toBe(1)
    expect(wm.active.length).toBe(1)
    wm.update(0.5) // not yet
    expect(wm.active.length).toBe(1)
    wm.update(0.6) // crosses interval
    expect(wm.active.length).toBe(2)
    expect(wm.spawning).toBe(false)
  })
  it('cleared only after spawning done and active empty', () => {
    const wm = new WaveManager(path, [[{ kind: 'normal', count: 1, interval: 1 }]])
    wm.startWave(0)
    wm.update(0.01)
    expect(wm.cleared()).toBe(false)
    wm.remove(wm.active[0])
    expect(wm.cleared()).toBe(true)
  })
  it('demoWaves has 10 waves', () => {
    expect(WaveManager.demoWaves().length).toBe(10)
  })
  it('mapWaves has 10 escalating waves; later maps are harder', () => {
    const m0 = WaveManager.mapWaves(0)
    expect(m0.length).toBe(10)
    // wave 10 has more 'normal' enemies than wave 1 on the same map
    expect(m0[9][0].count).toBeGreaterThan(m0[0][0].count)
    // map 1 wave 1 is harder than map 0 wave 1
    expect(WaveManager.mapWaves(1)[0][0].count).toBeGreaterThan(m0[0][0].count)
  })
})
