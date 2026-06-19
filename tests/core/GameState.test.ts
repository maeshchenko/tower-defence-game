import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/EventBus'
import { GameState } from '../../src/core/GameState'

const make = (o?: any) => new GameState(new EventBus(), o)

describe('GameState', () => {
  it('defaults', () => {
    const g = make()
    expect(g.gold).toBe(100); expect(g.lives).toBe(20)
    expect(g.wave).toBe(0); expect(g.phase).toBe('build'); expect(g.totalWaves).toBe(10)
  })
  it('spendGold respects balance', () => {
    const g = make({ gold: 50 })
    expect(g.spendGold(60)).toBe(false); expect(g.gold).toBe(50)
    expect(g.spendGold(30)).toBe(true); expect(g.gold).toBe(20)
  })
  it('addGold', () => { const g = make({ gold: 0 }); g.addGold(15); expect(g.gold).toBe(15) })
  it('damageBase to zero ends game as loss', () => {
    const bus = new EventBus(); const over = vi.fn(); bus.on('gameOver', over)
    const g = new GameState(bus, { lives: 1 })
    g.damageBase(5)
    expect(g.lives).toBe(0); expect(g.phase).toBe('gameover')
    expect(over).toHaveBeenCalledWith({ victory: false })
  })
  it('startWave increments wave and sets phase', () => {
    const g = make(); g.startWave()
    expect(g.wave).toBe(1); expect(g.phase).toBe('wave')
  })
  it('endWave on last wave wins', () => {
    const bus = new EventBus(); const over = vi.fn(); bus.on('gameOver', over)
    const g = new GameState(bus, { totalWaves: 1 })
    g.startWave(); g.endWave()
    expect(g.phase).toBe('gameover'); expect(over).toHaveBeenCalledWith({ victory: true })
  })
  it('startWave is no-op when not in build phase', () => {
    const g = make()
    g.startWave() // wave = 1, phase = 'wave'
    g.startWave() // second call from 'wave' phase — should be no-op
    expect(g.wave).toBe(1)
    expect(g.phase).toBe('wave')
  })
  it('endWave is no-op when in build phase', () => {
    const bus = new EventBus(); const over = vi.fn(); bus.on('gameOver', over)
    const g = new GameState(bus) // phase starts as 'build'
    g.endWave() // called from 'build' — should be no-op
    expect(g.phase).toBe('build')
    expect(over).not.toHaveBeenCalled()
  })
})
