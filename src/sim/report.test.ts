// Balance report. Run with:  npx vitest run src/sim/report.test.ts
// Prints (1) a tower DPS/gold dominance table and (2) per-map win/lose for each
// strategy. The asserts encode the design goals so a bad retune fails the test.
import { describe, it, expect } from 'vitest'
import { Level } from '../world/Level'
import { TowerKind } from '../towers/TowerTypes'
import { SIM_TOWERS } from './config'
import { singleDps, runMap, monoStrategy, mixedStrategy, MapRun, Strategy } from './balance'

const noBuild: Strategy = () => {} // build nothing — used for the hero-alone probe

const KINDS: TowerKind[] = ['cannon', 'sniper', 'tesla', 'mortar', 'slow']

function cumCost(k: TowerKind): number { return SIM_TOWERS[k].reduce((s, l) => s + l.cost, 0) }

describe('balance report', () => {
  it('prints dominance table + map outcomes (informational asserts)', { timeout: 30000 }, () => {
    // ---- dominance table ----
    const rows = KINDS.map((k) => {
      const L3 = SIM_TOWERS[k][SIM_TOWERS[k].length - 1]
      const cum = cumCost(k)
      const dpsBasic = singleDps(L3, 0)
      const dpsArmor = singleDps(L3, 6)
      return { k, range: L3.range, cum, dpsBasic, dpsArmor, perGold: dpsBasic / cum }
    })
    let table = '\n=== TOWER DOMINANCE (max level, single-target) ===\n'
    table += 'kind    range  cumCost  dps     dps/armor6  dps/gold\n'
    for (const r of rows)
      table += `${r.k.padEnd(7)} ${String(r.range).padEnd(6)} ${String(r.cum).padEnd(8)} ${r.dpsBasic.toFixed(1).padEnd(7)} ${r.dpsArmor.toFixed(1).padEnd(11)} ${r.perGold.toFixed(3)}\n`
    table += '(note: tesla/mortar gain a lot vs GROUPS — see map sim; table is single-target only)\n'

    // sniper must NOT be the most gold-efficient (old dominance bug)
    const cannon = rows.find((r) => r.k === 'cannon')!
    const sniper = rows.find((r) => r.k === 'sniper')!
    expect(sniper.perGold).toBeLessThan(cannon.perGold)
    // sniper must keep the longest reach
    expect(sniper.range).toBe(Math.max(...rows.map((r) => r.range)))

    // ---- map outcomes ----
    const maps = Level.maps()
    const runs: MapRun[] = []
    for (let m = 0; m < maps.length; m++) {
      for (const k of KINDS) runs.push(runMap(m, maps[m], `mono-${k}`, monoStrategy(k)))
      runs.push(runMap(m, maps[m], 'mixed', mixedStrategy))
    }
    let out = '\n=== MAP OUTCOMES (won? / lives left of 20) ===\n'
    out += 'map  strategy      result\n'
    for (const r of runs)
      out += `${String(r.mapIndex + 1).padEnd(4)} ${r.strategy.padEnd(13)} ${r.won ? `WON  (${r.livesLeft} lives)` : 'LOST'}\n`

    // worst wave detail for mixed on the last map (curve shape)
    const lastMixed = runs.find((r) => r.mapIndex === maps.length - 1 && r.strategy === 'mixed')!
    out += `\nmixed, map ${maps.length} per-wave lives-lost: ` + lastMixed.waves.map((w) => w.livesLost).join(',') + '\n'
    out += `mixed, map ${maps.length} gold curve:       ` + lastMixed.waves.map((w) => w.goldAfter).join(',') + '\n'

    console.log(table + out)

    // design goals (soft — informational, but flag gross failures):
    const mixedWins = runs.filter((r) => r.strategy === 'mixed' && r.won).length
    console.log(`\nMIXED won ${mixedWins}/${maps.length} maps.`)
    expect(mixedWins).toBeGreaterThan(0) // mixed strategy must be viable somewhere

    // ---- HERO PROBE: hero alone, ZERO towers (free 100-dps, overstated) ----
    let hero = '\n=== HERO PROBE (hero alone, no towers) ===\n'
    let heroWins = 0
    for (let m = 0; m < maps.length; m++) {
      const r = runMap(m, maps[m], 'hero-only', noBuild, true)
      if (r.won) heroWins++
      hero += `map ${m + 1}: ${r.won ? `WON (${r.livesLeft} lives)` : 'LOST'}  per-wave lives-lost: ${r.waves.map((w) => w.livesLost).join(',')}\n`
    }
    hero += `HERO-ALONE won ${heroWins}/${maps.length} maps (if high -> hero is too strong / makes towers optional).\n`
    console.log(hero)
  })
})
