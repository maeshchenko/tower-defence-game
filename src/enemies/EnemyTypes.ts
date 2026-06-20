export type EnemyKind = 'normal' | 'fast' | 'tank' | 'rogue' | 'brute' | 'healer' | 'boss'
// atk: damage per shot, atkRange: how close the hero must be, atkRate: shots/sec
// heal (optional): a healer pulses `amount` HP to allies within `range`, `rate`/sec
export interface EnemyDef {
  kind: EnemyKind; hp: number; speed: number; bounty: number
  atk: number; atkRange: number; atkRate: number
  armor: number   // flat damage reduction per hit
  leak: number    // lives lost if this enemy reaches the base
  heal?: { amount: number; range: number; rate: number }
}
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 45, speed: 2.0, bounty: 4, atk: 5, atkRange: 14, atkRate: 0.5, armor: 0, leak: 1 },
  fast: { kind: 'fast', hp: 24, speed: 4.5, bounty: 5, atk: 3, atkRange: 12, atkRate: 0.8, armor: 0, leak: 1 },
  tank: { kind: 'tank', hp: 200, speed: 1.0, bounty: 16, atk: 12, atkRange: 16, atkRate: 0.3, armor: 6, leak: 3 },
  rogue: { kind: 'rogue', hp: 15, speed: 6.0, bounty: 3, atk: 4, atkRange: 10, atkRate: 1.0, armor: 0, leak: 1 },
  brute: { kind: 'brute', hp: 400, speed: 1.3, bounty: 22, atk: 16, atkRange: 14, atkRate: 0.4, armor: 0, leak: 3 },
  healer: { kind: 'healer', hp: 90, speed: 1.8, bounty: 20, atk: 0, atkRange: 0, atkRate: 0, armor: 0, leak: 2, heal: { amount: 8, range: 5, rate: 0.5 } },
  boss: { kind: 'boss', hp: 2600, speed: 0.9, bounty: 140, atk: 25, atkRange: 18, atkRate: 0.4, armor: 6, leak: 8 },
}
