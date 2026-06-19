import { describe, it, expect } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { GameState } from '../../src/core/GameState'
import { Level } from '../../src/world/Level'
import { TowerManager } from '../../src/towers/TowerManager'

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
    expect(state.gold).toBe(150) // 200 - 50
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
    expect(state.gold).toBe(before - 40)
  })
  it('sell refunds and frees cell', () => {
    const { state, level, tm } = setup()
    const cell = level.cells[0]
    const t = tm.build('cannon', cell)!
    const goldAfterBuild = state.gold
    tm.sell(t)
    expect(cell.occupied).toBe(false)
    expect(tm.towers.length).toBe(0)
    expect(state.gold).toBe(goldAfterBuild + 25) // 50% of 50
  })
})
