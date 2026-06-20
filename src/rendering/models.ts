export interface ModelDef {
  url: string          // path under public/, e.g. '/models/hero/Knight.glb'
  targetHeight: number // desired size in game units after normalize (see normalizeBy)
  yaw?: number         // extra Y rotation (radians) if model faces the wrong way
  parts?: string[]     // extra GLB urls STACKED vertically onto url (towers), bottom→top
  // 'height' (default): fit targetHeight to the Y extent. 'max': fit it to the
  // largest of X/Y/Z — use for long/flat models (an arrow) that height-normalize blows up.
  normalizeBy?: 'height' | 'max'
  // Flat override colour [r,g,b] (0..1). Kenney's tower/base/tile GLBs (UnityGLTF export)
  // mis-sample the shared colormap atlas under Babylon's loader and render purple,
  // so we paint them a solid colour instead. Proper textured towers come in M4.
  tint?: [number, number, number]
  // Scale so the model's XZ footprint equals this (overrides height normalize).
  // Used for ground/road tiles laid on a grid. `tileTopY` is the world Y the
  // tile's top surface should sit at after scaling.
  footprint?: number
  tileTopY?: number
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
const TL = '/models/tiles/'
const N = '/models/nature/' // Kenney Nature Kit (vertex-colored, no tint needed)

export const MODELS: Record<string, ModelDef> = {
  // towers are generated below (tower.<kind>.<level>) so upgrades swap body + weapon

  'enemy.normal': { url: E + 'Skeleton_Warrior.glb', targetHeight: 1.7 },
  'enemy.fast':   { url: E + 'Skeleton_Minion.glb',  targetHeight: 1.3 },
  'enemy.tank':   { url: E + 'Skeleton_Warrior.glb', targetHeight: 2.4 },
  'enemy.rogue':  { url: E + 'Skeleton_Rogue.glb',   targetHeight: 1.5 },
  'enemy.brute':  { url: E + 'Skeleton_Warrior.glb', targetHeight: 2.0, tint: [0.7, 0.5, 0.38] },
  'enemy.healer': { url: E + 'Skeleton_Minion.glb',  targetHeight: 1.6, tint: [0.4, 0.85, 0.5] },
  'enemy.boss':   { url: E + 'Skeleton_Warrior.glb', targetHeight: 3.4, tint: [0.55, 0.18, 0.22] },

  'hero.knight':  { url: H + 'Knight.glb', targetHeight: 1.8 },

  'ammo.cannon':  { url: A + 'weapon-ammo-cannonball.glb', targetHeight: 0.5 },
  'ammo.sniper':  { url: A + 'weapon-ammo-arrow.glb',      targetHeight: 0.9, normalizeBy: 'max' },
  'ammo.slow':    { url: A + 'weapon-ammo-bullet.glb',     targetHeight: 0.4 },
  'ammo.mortar':  { url: A + 'weapon-ammo-boulder.glb',    targetHeight: 0.55 },
  'ammo.tesla':   { url: A + 'weapon-ammo-bullet.glb',     targetHeight: 0.35 },

  'prop.tree':  { url: N + 'tree_default.glb', targetHeight: 5.0 }, // tall tree, clearly towers over bushes
  'prop.rock':  { url: P + 'detail-rocks-large.glb', targetHeight: 1.4 },
  'prop.wall':  { url: P + 'wood-structure-high.glb', targetHeight: 1.7 },
  'prop.crate': { url: P + 'wood-structure-part.glb', targetHeight: 1.2 },

  // decor scenery (Nature Kit) + build-cell pad (Kenney selection marker)
  'cell.pad':          { url: '/models/markers/selection-a.glb', targetHeight: 1, footprint: 2.0, tileTopY: 0.04, tint: [0.45, 0.75, 1.0] },
  'decor.bush':        { url: N + 'plant_bushDetailed.glb', targetHeight: 1.7 },
  'decor.bushSmall':   { url: N + 'plant_bushSmall.glb', targetHeight: 1.1 },
  'decor.bushLarge':   { url: N + 'plant_bushLarge.glb', targetHeight: 2.4 },
  'decor.grass':       { url: N + 'grass.glb', targetHeight: 0.7 },
  'decor.grassLarge':  { url: N + 'grass_large.glb', targetHeight: 1.1 },
  'decor.flowerRed':   { url: N + 'flower_redA.glb', targetHeight: 0.5 },
  'decor.flowerYellow':{ url: N + 'flower_yellowA.glb', targetHeight: 0.5 },
  'decor.flowerPurple':{ url: N + 'flower_purpleA.glb', targetHeight: 0.5 },

  'base.keep':  { url: T + 'tower-round-base.glb', targetHeight: 3.0,
    parts: [T + 'tower-round-middle-a.glb', T + 'tower-round-roof-a.glb'], tint: [0.62, 0.6, 0.56] },

  // ground/road tiles — beveled Kenney blocks laid on a grid (footprint-scaled,
  // top surface at y=0), flat-tinted to dodge the colormap-atlas mis-sample.
  'tile.ground': { url: TL + 'tile.glb', targetHeight: 1, footprint: 4.2, tileTopY: 0, tint: [0.28, 0.5, 0.26] },
  'tile.road':   { url: TL + 'tile.glb', targetHeight: 1, footprint: 2.4, tileTopY: 0.08, tint: [0.62, 0.47, 0.3] },
  'tile.spawn':  { url: TL + 'tile.glb', targetHeight: 1, footprint: 2.4, tileTopY: 0.07, tint: [0.7, 0.3, 0.2] },
  'tile.roadCorner': { url: TL + 'tile-corner-round.glb', targetHeight: 1, footprint: 2.4, tileTopY: 0.1, tint: [0.62, 0.47, 0.3] },
}

// Generate tower.<kind>.<level> (level 0..2). Upgrading swaps to a taller body tier
// (middle a→b→c) so the tower visibly changes; each kind keeps its own weapon/tint.
const SQ_MID = ['tower-square-middle-a', 'tower-square-middle-b', 'tower-square-middle-c']
const RD_MID = ['tower-round-middle-a', 'tower-round-middle-b', 'tower-round-middle-c']
interface TowerBuild { round: boolean; top: string; tint: [number, number, number]; height: number }
const TOWER_BUILD: Record<string, TowerBuild> = {
  cannon: { round: false, top: 'weapon-cannon',   tint: [0.55, 0.55, 0.60], height: 2.4 },
  sniper: { round: false, top: 'weapon-ballista', tint: [0.28, 0.28, 0.34], height: 2.6 },
  mortar: { round: false, top: 'weapon-catapult', tint: [0.72, 0.46, 0.26], height: 2.5 },
  tesla:  { round: false, top: 'weapon-turret',   tint: [0.52, 0.36, 0.86], height: 2.4 },
  slow:   { round: true,  top: 'tower-round-crystals', tint: [0.35, 0.55, 0.95], height: 2.4 },
}
for (const [kind, b] of Object.entries(TOWER_BUILD)) {
  const bottom = b.round ? 'tower-round-base' : 'tower-square-bottom-a'
  const mids = b.round ? RD_MID : SQ_MID
  for (let lvl = 0; lvl < 3; lvl++) {
    MODELS[`tower.${kind}.${lvl}`] = {
      url: T + bottom + '.glb',
      parts: [T + mids[lvl] + '.glb', T + b.top + '.glb'],
      targetHeight: b.height + lvl * 0.25, // grows a touch with each tier
      tint: b.tint,
    }
  }
}
