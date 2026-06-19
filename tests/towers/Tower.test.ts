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
  it('slow tower reports slow factor', () => {
    const t = new Tower('slow', {x:0,y:0,z:0})
    const e = at(1)
    const shot = t.update(10, [e])
    expect(shot?.slow).toBeGreaterThan(0)
    expect(shot?.slow).toBeLessThan(1)
  })
})
