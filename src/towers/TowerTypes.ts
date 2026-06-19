export type TowerKind = 'cannon' | 'slow' | 'sniper'
export interface TowerLevel { range: number; fireRate: number; damage: number; slow?: number; cost: number }
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
}
