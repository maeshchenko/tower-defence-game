import { describe, it, expect } from 'vitest'
import { Enemy } from './Enemy'
import { ENEMY_DEFS } from './EnemyTypes'

const path = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }]

describe('Enemy armor', () => {
  it('tank (armor 6) takes raw minus armor, floored at 1', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path)
    e.takeDamage(10)            // 10 - 6 = 4
    expect(e.hp).toBe(200 - 4)
    e.takeDamage(2)             // 2 - 6 -> floor 1
    expect(e.hp).toBe(200 - 4 - 1)
  })
  it('pierce ignores armor up to its value', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path)
    e.takeDamage(50, 8)        // pierce 8 > armor 6 -> full 50
    expect(e.hp).toBe(200 - 50)
  })
  it('exposes leak and armor', () => {
    const e = new Enemy(ENEMY_DEFS.boss, path)
    expect(e.leak).toBe(8)
    expect(e.armor).toBe(6)
  })
})
