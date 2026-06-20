import { describe, it, expect } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { GameState } from '../../src/core/GameState'
import { Level } from '../../src/world/Level'
import { TowerManager } from '../../src/towers/TowerManager'
import { Enemy } from '../../src/enemies/Enemy'
import { ENEMY_DEFS } from '../../src/enemies/EnemyTypes'

const setup = (gold = 200) => {
  const state = new GameState(new EventBus(), { gold })
  const level = Level.demo()
  return { state, level, tm: new TowerManager(state, level) }
}

describe('TowerManager', () => {
  it('builds on free cell, spends gold, occupies cell', () => {
    const { state, level, tm } = setup()
    const cell = level.cells[0]
    const t = tm.build('cannon', cell)
    expect(t).not.toBeNull()
    expect(cell.occupied).toBe(true)
    expect(state.gold).toBe(160) // 200 - 40 (cannon L1)
    expect(tm.towers.length).toBe(1)
  })
  it('refuses build on occupied cell', () => {
    const { level, tm } = setup()
    const cell = level.cells[0]
    tm.build('cannon', cell)
    expect(tm.build('sniper', cell)).toBeNull()
  })
  it('refuses build without gold', () => {
    const { level, tm } = setup(10)
    expect(tm.build('cannon', level.cells[0])).toBeNull()
  })
  it('upgrade spends next-level cost', () => {
    const { state, level, tm } = setup()
    const t = tm.build('cannon', level.cells[0])!
    const before = state.gold
    expect(tm.upgrade(t)).toBe(true)
    expect(t.level).toBe(1)
    expect(state.gold).toBe(before - 45) // cannon L2 cost
  })
  it('sell refunds and frees cell', () => {
    const { state, level, tm } = setup()
    const cell = level.cells[0]
    const t = tm.build('cannon', cell)!
    const goldAfterBuild = state.gold
    tm.sell(t)
    expect(cell.occupied).toBe(false)
    expect(tm.towers.length).toBe(0)
    expect(state.gold).toBe(goldAfterBuild + 24) // 60% of 40 (cannon L1)
  })
  it('refused build on occupied cell leaves gold unchanged', () => {
    const { state, level, tm } = setup()
    const cell = level.cells[0]
    tm.build('cannon', cell)
    const goldAfterBuild = state.gold
    expect(tm.build('sniper', cell)).toBeNull()
    expect(state.gold).toBe(goldAfterBuild)
  })
  it('refused build without gold leaves cell unoccupied', () => {
    const { level, tm } = setup(10)
    const cell = level.cells[0]
    expect(tm.build('cannon', cell)).toBeNull()
    expect(cell.occupied).toBe(false)
  })
  it('update collects a shot from a tower with an enemy in range, and empty array when idle', () => {
    const { level, tm } = setup()
    const cell = level.cells[0]
    tm.build('cannon', cell)!
    const path = [
      { x: cell.pos.x, y: 0, z: cell.pos.z },
      { x: cell.pos.x + 50, y: 0, z: cell.pos.z }
    ]
    const enemy = new Enemy(ENEMY_DEFS.normal, path)
    const hpBefore = enemy.hp
    const shots = tm.update(10, [enemy])
    expect(shots.length).toBe(1)
    expect(shots[0].target).toBe(enemy)
    expect(shots[0].damage).toBeGreaterThan(0)
    expect(enemy.hp).toBe(hpBefore)
    const shotsOnCooldown = tm.update(0.001, [enemy])
    expect(shotsOnCooldown.length).toBe(0)
  })
})
