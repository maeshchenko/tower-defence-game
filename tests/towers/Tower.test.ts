import { describe, it, expect } from 'vitest'
import { Tower } from '../../src/towers/Tower'
import { Enemy } from '../../src/enemies/Enemy'
import { ENEMY_DEFS } from '../../src/enemies/EnemyTypes'

const at = (x: number) => new Enemy(ENEMY_DEFS.normal, [{x,y:0,z:0},{x:x+100,y:0,z:0}])

describe('Tower', () => {
  it('does not fire before cooldown elapses', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const e = at(1)
    // fireRate of cannon lvl0 assumed 1/sec -> needs dt>=1 from cold start? define: fires immediately when ready
    const first = t.update(0.001, [e])
    expect(first).toBeNull()
  })
  it('fires at in-range enemy when ready', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const e = at(1)
    const shot = t.update(10, [e]) // plenty of time
    expect(shot?.target).toBe(e)
    expect(shot?.damage).toBeGreaterThan(0)
  })
  it('ignores out-of-range enemies', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const far = at(999)
    expect(t.update(10, [far])).toBeNull()
  })
  it('upgrade raises level until max', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const maxIdx = 2
    expect(t.level).toBe(0)
    expect(t.upgrade()).toBe(true)
    while (t.level < maxIdx) t.upgrade()
    expect(t.upgrade()).toBe(false)
  })
  it('rotates toward the target at a bounded rate, not instantly', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    const e = at(1) // desired heading atan2(1,0) = PI/2
    t.update(0.001, [e]) // tiny step: barely turns
    expect(t.yaw).toBeGreaterThan(0)
    expect(t.yaw).toBeLessThan(0.1) // did NOT snap to PI/2
  })
  it('holds fire while still turning toward a far-angle target', () => {
    const t = new Tower('cannon', {x:0,y:0,z:0})
    // enemy directly behind (z=-1): desired heading is PI, a full 180° from yaw 0
    const behind = new Enemy(ENEMY_DEFS.normal, [{x:0,y:0,z:-1},{x:0,y:0,z:-100}])
    let shot = null
    for (let i = 0; i < 45; i++) { const r = t.update(1/60, [behind]); if (r) { shot = r; break } }
    expect(shot).toBeNull() // cooldown is up by now, but the barrel hasn't finished turning
    // give it more time to finish rotating, then it fires
    for (let i = 0; i < 120 && !shot; i++) shot = t.update(1/60, [behind])
    expect(shot).not.toBeNull()
  })
  it('slow tower reports slow factor', () => {
    const t = new Tower('slow', {x:0,y:0,z:0})
    const e = at(1)
    const shot = t.update(10, [e])
    expect(shot?.slow).toBeGreaterThan(0)
    expect(shot?.slow).toBeLessThan(1)
  })
})
