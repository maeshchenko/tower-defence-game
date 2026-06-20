export type TowerKind = 'cannon' | 'slow' | 'sniper' | 'mortar' | 'tesla'
export interface TowerLevel {
  range: number; fireRate: number; damage: number; slow?: number; cost: number
  splashRadius?: number // mortar: damage all enemies within this radius of the impact
  chainCount?: number   // tesla: arc to this many extra enemies
  chainRange?: number   // tesla: max distance an arc can jump
}
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6, fireRate: 1.5, damage: 10, cost: 50 },
    { range: 7, fireRate: 1.8, damage: 16, cost: 40 },
    { range: 8, fireRate: 2.0, damage: 24, cost: 60 },
  ],
  slow: [
    { range: 5, fireRate: 1.0, damage: 2, slow: 0.5, cost: 40 },
    { range: 6, fireRate: 1.0, damage: 3, slow: 0.4, cost: 35 },
    { range: 7, fireRate: 1.0, damage: 4, slow: 0.3, cost: 50 },
  ],
  sniper: [
    { range: 14, fireRate: 0.4, damage: 60, cost: 70 },
    { range: 16, fireRate: 0.5, damage: 90, cost: 60 },
    { range: 18, fireRate: 0.6, damage: 130, cost: 90 },
  ],
  mortar: [
    { range: 7.0, fireRate: 0.6, damage: 14, splashRadius: 2.4, cost: 80 },
    { range: 7.5, fireRate: 0.7, damage: 22, splashRadius: 2.8, cost: 70 },
    { range: 8.0, fireRate: 0.8, damage: 34, splashRadius: 3.2, cost: 100 },
  ],
  tesla: [
    { range: 6.0, fireRate: 2.2, damage: 6, chainCount: 2, chainRange: 3.0, cost: 65 },
    { range: 6.5, fireRate: 2.6, damage: 9, chainCount: 3, chainRange: 3.2, cost: 55 },
    { range: 7.0, fireRate: 3.0, damage: 13, chainCount: 4, chainRange: 3.5, cost: 85 },
  ],
}
