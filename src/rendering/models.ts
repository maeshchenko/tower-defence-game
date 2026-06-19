export interface ModelDef {
  url: string          // path under public/, e.g. '/models/hero/Knight.glb'
  targetHeight: number // desired height in game units after normalize
  yaw?: number         // extra Y rotation (radians) if model faces the wrong way
  parts?: string[]     // extra GLB urls stacked onto url (towers), bottom→top
}

// scale factor to bring a model of measured height `rawHeight` to `targetHeight`
export function normalizeScale(rawHeight: number, targetHeight: number): number {
  if (!(rawHeight > 0)) return 1
  return targetHeight / rawHeight
}

const T = '/models/towers/'
const A = '/models/ammo/'
const P = '/models/props/'
const E = '/models/enemies/'
const H = '/models/hero/'

export const MODELS: Record<string, ModelDef> = {
  'tower.cannon': { url: T + 'tower-square-bottom-a.glb', targetHeight: 2.4,
    parts: [T + 'tower-square-middle-a.glb', T + 'weapon-cannon.glb'] },
  'tower.slow':   { url: T + 'tower-round-base.glb', targetHeight: 2.4,
    parts: [T + 'tower-round-middle-a.glb', T + 'tower-round-crystals.glb'] },
  'tower.sniper': { url: T + 'tower-square-bottom-a.glb', targetHeight: 2.6,
    parts: [T + 'tower-square-middle-a.glb', T + 'weapon-ballista.glb'] },

  'enemy.normal': { url: E + 'Skeleton_Warrior.glb', targetHeight: 1.7 },
  'enemy.fast':   { url: E + 'Skeleton_Minion.glb',  targetHeight: 1.3 },
  'enemy.tank':   { url: E + 'Skeleton_Warrior.glb', targetHeight: 2.4 },

  'hero.knight':  { url: H + 'Knight.glb', targetHeight: 1.8 },

  'ammo.cannon':  { url: A + 'weapon-ammo-cannonball.glb', targetHeight: 0.5 },
  'ammo.sniper':  { url: A + 'weapon-ammo-arrow.glb',      targetHeight: 0.6 },
  'ammo.slow':    { url: A + 'weapon-ammo-bullet.glb',     targetHeight: 0.4 },

  'prop.tree':  { url: P + 'detail-tree-large.glb', targetHeight: 2.6 },
  'prop.rock':  { url: P + 'detail-rocks-large.glb', targetHeight: 1.4 },
  'prop.wall':  { url: P + 'wood-structure-high.glb', targetHeight: 1.7 },
  'prop.crate': { url: P + 'wood-structure-part.glb', targetHeight: 1.2 },

  'base.keep':  { url: T + 'tower-round-base.glb', targetHeight: 3.0,
    parts: [T + 'tower-round-middle-a.glb', T + 'tower-round-roof-a.glb'] },
}
