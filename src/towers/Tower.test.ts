import { describe, it, expect } from 'vitest'
import { Tower } from './Tower'
import { Enemy } from '../enemies/Enemy'
import { ENEMY_DEFS } from '../enemies/EnemyTypes'

const path = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }]
function enemyAt(x: number, kind: keyof typeof ENEMY_DEFS = 'normal') {
  const e = new Enemy(ENEMY_DEFS[kind], path)
  ;(e as any).follower.pos = { x, y: 0, z: 0 }
  return e
}

describe('Tower aura (slow)', () => {
  it('returns an aura effect, not a projectile shot', () => {
    const t = new Tower('slow', { x: 0, y: 0, z: 0 })
    const r = t.update(0.1, [enemyAt(2)])
    expect(r?.aura).toBeTruthy()
    expect(r?.aura?.slow).toBe(0.55)
    expect(r?.damage).toBeUndefined()
  })
})

describe('Tower pierce', () => {
  it('sniper shot carries its pierce value', () => {
    const t = new Tower('sniper', { x: 0, y: 0, z: 0 })
    let r = t.update(10, [enemyAt(3)])
    if (!r) r = t.update(10, [enemyAt(3)])
    expect(r?.pierce).toBe(4)
  })
})

describe('Tower targeting modes', () => {
  function inRange(x: number, hp: number, traveled: number) {
    const e = new Enemy(ENEMY_DEFS.normal, path)
    ;(e as any).follower.pos = { x, y: 0, z: 0 }
    ;(e as any)._traveled = traveled
    ;(e as any).hp = hp
    return e
  }
  it('first = furthest along the path', () => {
    const t = new Tower('cannon', { x: 0, y: 0, z: 0 })
    const a = inRange(1, 30, 5), b = inRange(2, 30, 9)
    const r = t.update(10, [a, b]) ?? t.update(10, [a, b])
    expect(r?.target).toBe(b)
  })
  it('weak = lowest hp', () => {
    const t = new Tower('cannon', { x: 0, y: 0, z: 0 })
    t.targetMode = 'weak'
    const a = inRange(1, 30, 5), b = inRange(2, 8, 9)
    const r = t.update(10, [a, b]) ?? t.update(10, [a, b])
    expect(r?.target).toBe(b)
  })
})
