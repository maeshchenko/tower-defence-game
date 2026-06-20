export type EnemyKind = 'normal' | 'fast' | 'tank' | 'rogue' | 'brute' | 'healer' | 'boss'
// atk: damage per shot, atkRange: how close the hero must be, atkRate: shots/sec
// heal (optional): a healer pulses `amount` HP to allies within `range`, `rate`/sec
export interface EnemyDef {
  kind: EnemyKind; hp: number; speed: number; bounty: number
  atk: number; atkRange: number; atkRate: number
  heal?: { amount: number; range: number; rate: number }
}
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 30, speed: 2, bounty: 5, atk: 5, atkRange: 14, atkRate: 0.5 },
  fast: { kind: 'fast', hp: 15, speed: 4, bounty: 5, atk: 3, atkRange: 12, atkRate: 0.8 },
  tank: { kind: 'tank', hp: 120, speed: 1, bounty: 15, atk: 12, atkRange: 16, atkRate: 0.3 },
  rogue: { kind: 'rogue', hp: 12, speed: 6, bounty: 6, atk: 4, atkRange: 10, atkRate: 1.0 },
  brute: { kind: 'brute', hp: 220, speed: 1.4, bounty: 20, atk: 16, atkRange: 14, atkRate: 0.4 },
  healer: { kind: 'healer', hp: 60, speed: 1.8, bounty: 18, atk: 0, atkRange: 0, atkRate: 0, heal: { amount: 8, range: 5, rate: 0.5 } },
  boss: { kind: 'boss', hp: 1200, speed: 0.9, bounty: 120, atk: 25, atkRange: 18, atkRate: 0.4 },
}
