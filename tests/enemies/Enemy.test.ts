import { describe, it, expect } from 'vitest'
import { ENEMY_DEFS } from '../../src/enemies/EnemyTypes'
import { Enemy } from '../../src/enemies/Enemy'

const path = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('Enemy', () => {
  it('starts alive at spawn with def hp', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    expect(e.alive).toBe(true); expect(e.hp).toBe(30); expect(e.pos.x).toBe(0)
  })
  it('moves along path on update', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    e.update(1) // speed 2
    expect(e.pos.x).toBeCloseTo(2)
  })
  it('reaches base at path end', () => {
    const e = new Enemy(ENEMY_DEFS.fast, path) // speed 4
    e.update(3) // 12 > 10
    expect(e.reachedBase).toBe(true)
  })
  it('dies when hp depleted', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    e.takeDamage(30)
    expect(e.hp).toBe(0); expect(e.alive).toBe(false)
  })
})
