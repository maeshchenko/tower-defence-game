import { describe, it, expect } from 'vitest'
import { ENEMY_DEFS } from '../../src/enemies/EnemyTypes'
import { Enemy } from '../../src/enemies/Enemy'

const path = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('Enemy', () => {
  it('starts alive at spawn with def hp', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    expect(e.alive).toBe(true); expect(e.hp).toBe(45); expect(e.pos.x).toBe(0)
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
    e.takeDamage(45)
    expect(e.hp).toBe(0); expect(e.alive).toBe(false)
  })
  it('applySlow reduces effective speed temporarily', () => {
    const e = new Enemy(ENEMY_DEFS.normal, [{x:0,y:0,z:0},{x:100,y:0,z:0}])
    e.applySlow(0.5, 1)
    e.update(1) // speed 2 * 0.5 = 1
    expect(e.pos.x).toBeCloseTo(1)
    e.update(1) // slow expired -> full speed 2
    expect(e.pos.x).toBeCloseTo(3)
  })
  it('exposes maxHp from its def', () => {
    expect(new Enemy(ENEMY_DEFS.normal, path).maxHp).toBe(45)
  })
  it('attacks hero only when in range and off cooldown', () => {
    const e = new Enemy(ENEMY_DEFS.normal, [{x:0,y:0,z:0},{x:100,y:0,z:0}]) // range 7, atk 5, rate 0.5 -> interval 2
    const hero = { x: 1, y: 0, z: 0 }
    expect(e.attack(0.001, hero)).toBeNull() // cooldown not elapsed yet
    expect(e.attack(10, hero)).toBe(5)       // off cooldown + in range -> fires
    expect(e.attack(0.001, hero)).toBeNull() // back on cooldown
  })
  it('does not attack a hero out of range', () => {
    const e = new Enemy(ENEMY_DEFS.normal, [{x:0,y:0,z:0},{x:100,y:0,z:0}])
    expect(e.attack(10, { x: 50, y: 0, z: 0 })).toBeNull()
  })
})
