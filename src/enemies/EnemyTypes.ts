export type EnemyKind = 'normal' | 'fast' | 'tank'
// atk: damage per shot, atkRange: how close the hero must be, atkRate: shots/sec
export interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number; atk: number; atkRange: number; atkRate: number }
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 30, speed: 2, bounty: 5, atk: 5, atkRange: 14, atkRate: 0.5 },
  fast: { kind: 'fast', hp: 15, speed: 4, bounty: 5, atk: 3, atkRange: 12, atkRate: 0.8 },
  tank: { kind: 'tank', hp: 120, speed: 1, bounty: 15, atk: 12, atkRange: 16, atkRate: 0.3 },
}
