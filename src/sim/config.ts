// ============================================================================
// TUNING KNOBS — proposed balance numbers from the spec
// (2026-06-20-td-balance-and-build-ux-design.md). Edit HERE to retune; the sim
// reads only this file. Once tuned, these values get written into the real
// TowerTypes.ts / EnemyTypes.ts / economy during implementation.
// ============================================================================
import { TowerKind } from '../towers/TowerTypes'
import { EnemyKind } from '../enemies/EnemyTypes'

export interface SimTowerLevel {
  range: number; fireRate: number; damage: number; cost: number
  pierce?: number       // sniper: ignores this much armor
  splashRadius?: number // mortar
  chainCount?: number; chainRange?: number // tesla
  slow?: number; aura?: boolean            // slow: persistent aura, slowFactor
}

export const SIM_TOWERS: Record<TowerKind, SimTowerLevel[]> = {
  cannon: [
    { damage: 10, fireRate: 1.5, range: 6.0, cost: 40 },
    { damage: 17, fireRate: 1.7, range: 6.5, cost: 45 },
    { damage: 28, fireRate: 1.9, range: 7.0, cost: 60 },
  ],
  sniper: [
    { damage: 50, fireRate: 0.45, range: 11.0, cost: 90, pierce: 4 },
    { damage: 80, fireRate: 0.50, range: 12.5, cost: 85, pierce: 8 },
    { damage: 130, fireRate: 0.55, range: 14.0, cost: 130, pierce: 999 },
  ],
  tesla: [
    { damage: 6, fireRate: 2.2, range: 5.5, cost: 60, chainCount: 2, chainRange: 3.0 },
    { damage: 9, fireRate: 2.5, range: 6.0, cost: 55, chainCount: 3, chainRange: 3.2 },
    { damage: 12, fireRate: 2.8, range: 6.5, cost: 80, chainCount: 4, chainRange: 3.5 },
  ],
  mortar: [
    { damage: 14, fireRate: 0.6, range: 7.0, cost: 75, splashRadius: 2.4 },
    { damage: 20, fireRate: 0.7, range: 7.5, cost: 70, splashRadius: 2.8 },
    { damage: 30, fireRate: 0.8, range: 8.0, cost: 95, splashRadius: 3.2 },
  ],
  slow: [ // PURE utility: 0 damage (else slow-spam chip-kills everything = degenerate)
    { damage: 0, fireRate: 1.0, range: 3.5, cost: 35, slow: 0.55, aura: true },
    { damage: 0, fireRate: 1.0, range: 4.5, cost: 35, slow: 0.45, aura: true },
    { damage: 0, fireRate: 1.0, range: 5.0, cost: 45, slow: 0.35, aura: true },
  ],
}

export interface SimEnemyDef {
  kind: EnemyKind; hp: number; speed: number; bounty: number
  leak: number; armor: number
  heal?: { amount: number; range: number; rate: number }
}

export const SIM_ENEMIES: Record<EnemyKind, SimEnemyDef> = {
  normal: { kind: 'normal', hp: 45, speed: 2.0, bounty: 4, leak: 1, armor: 0 },
  fast: { kind: 'fast', hp: 24, speed: 4.5, bounty: 5, leak: 1, armor: 0 },
  rogue: { kind: 'rogue', hp: 15, speed: 6.0, bounty: 3, leak: 1, armor: 0 },
  tank: { kind: 'tank', hp: 200, speed: 1.0, bounty: 16, leak: 3, armor: 6 },
  brute: { kind: 'brute', hp: 400, speed: 1.3, bounty: 22, leak: 3, armor: 0 },
  healer: { kind: 'healer', hp: 90, speed: 1.8, bounty: 20, leak: 2, armor: 0, heal: { amount: 8, range: 5, rate: 0.5 } },
  boss: { kind: 'boss', hp: 2600, speed: 0.9, bounty: 140, leak: 8, armor: 6 },
}

// per-map enemy HP multiplier: difficulty ramps over the campaign so each map
// matches its cell count (early maps easy/tutorial, late maps hard) — lets us keep
// MANY build cells without the late maps being trivial.
export const SIM_HP_SCALE = (mapIndex: number) => 1 + mapIndex * 0.06 // map1 x1.0 ... map10 x1.54

export const SIM_ECONOMY = {
  startGold: (mapIndex: number) => 120 + mapIndex * 15, // per-map fresh budget (no carry)
  startLives: 20,
  waveClear: (wave: number) => 12 + wave * 2, // wave is 1-based
  earlyStartBonusIgnored: true,               // sim never starts early
}

// the hero, modelled as a free, always-on shooter (25 dmg x 4/s = 100 dps).
// Generous range approximates mobility + perfect player aim; respawn ignored
// (assumes always up) -> this OVERSTATES the hero, so if towers still matter
// here they matter for real. Used only by the hero-probe in the report.
export const SIM_HERO = { range: 13, damage: 22, fireRate: 4, pierce: 999 }

// the self-defending keep (auto-fires at nearest enemy). Range cut from 12->6
// and dmg 8->5: at range 12 the keep covered nearly a whole ~30-unit map and
// trivialized defense (it out-carried real towers). Now a short last-ditch line.
export const SIM_BASE = { range: 6, damage: 5, fireRate: 1.0, pierce: 0 }
