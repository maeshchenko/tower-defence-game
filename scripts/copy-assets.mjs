import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KENNEY = join(root, 'kenney_tower-defense-kit/Models/GLB format')
const ADV = join(root, 'assets-src/adventurers/addons/kaykit_character_pack_adventures/Characters/gltf')
const SKEL = join(root, 'assets-src/skeletons/addons/kaykit_character_pack_skeletons/Characters/gltf')
const OUT = join(root, 'public/models')

// Kenney models grouped by destination folder (texture copied per folder once)
const KENNEY_MODELS = {
  towers: [
    'tower-square-bottom-a', 'tower-square-middle-a',
    'tower-round-base', 'tower-round-middle-a', 'tower-round-roof-a', 'tower-round-crystals',
    'weapon-cannon', 'weapon-ballista',
  ],
  ammo: ['weapon-ammo-cannonball', 'weapon-ammo-arrow', 'weapon-ammo-bullet'],
  props: ['detail-tree', 'detail-tree-large', 'detail-rocks', 'detail-rocks-large',
          'wood-structure', 'wood-structure-high', 'wood-structure-part'],
  tiles: ['tile', 'tile-straight', 'tile-corner-square', 'tile-spawn', 'tile-end'],
}
const KAYKIT = {
  hero: [[ADV, 'Knight.glb']],
  enemies: [[SKEL, 'Skeleton_Warrior.glb'], [SKEL, 'Skeleton_Minion.glb'], [SKEL, 'Skeleton_Rogue.glb']],
}

function copyKenney(folder, names) {
  const dst = join(OUT, folder)
  mkdirSync(join(dst, 'Textures'), { recursive: true })
  cpSync(join(KENNEY, 'Textures/colormap.png'), join(dst, 'Textures/colormap.png'))
  for (const n of names) {
    const src = join(KENNEY, n + '.glb')
    if (!existsSync(src)) throw new Error('missing Kenney model: ' + src)
    cpSync(src, join(dst, n + '.glb'))
  }
}
function copyKaykit(folder, entries) {
  const dst = join(OUT, folder)
  mkdirSync(dst, { recursive: true })
  for (const [base, file] of entries) {
    const src = join(base, file)
    if (!existsSync(src)) throw new Error('missing KayKit model: ' + src)
    cpSync(src, join(dst, file))
  }
}

for (const [folder, names] of Object.entries(KENNEY_MODELS)) copyKenney(folder, names)
for (const [folder, entries] of Object.entries(KAYKIT)) copyKaykit(folder, entries)
console.log('assets copied to', OUT)
