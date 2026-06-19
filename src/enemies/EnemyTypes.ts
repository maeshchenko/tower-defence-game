export type EnemyKind = 'normal' | 'fast' | 'tank'
export interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number }
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 30, speed: 2, bounty: 5 },
  fast: { kind: 'fast', hp: 15, speed: 4, bounty: 5 },
  tank: { kind: 'tank', hp: 120, speed: 1, bounty: 15 },
}
