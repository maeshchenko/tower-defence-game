import { Scene, TransformNode, AbstractMesh, Color3, StandardMaterial, Animation, Vector3 } from '@babylonjs/core'
import { Enemy } from './Enemy'
import { AssetManager } from '../rendering/AssetManager'
import { ClipPlayer } from '../rendering/ClipPlayer'

// KayKit characters' visual front is local +Z, and atan2(dx,dz) already aligns
// local +Z to the movement vector — so no offset; the skeleton faces where it walks.
const FACING_OFFSET = 0

export class EnemyView {
  readonly mesh: TransformNode
  private clips: ClipPlayer
  private last: { x: number; z: number } | null = null
  private dying = false
  constructor(_scene: Scene, assets: AssetManager, private enemy: Enemy) {
    this.mesh = assets.instance('enemy.' + enemy.kind)
    this.clips = new ClipPlayer(assets.getAnimationGroups(this.mesh))
    this.clips.play(/idle/i)
    this.sync()
  }
  sync() {
    if (this.dying) return // corpse: hold position, let the death clip play out
    const p = this.enemy.pos
    this.mesh.position.set(p.x, 0, p.z)
    if (this.last) {
      const dx = p.x - this.last.x, dz = p.z - this.last.z
      if (dx * dx + dz * dz > 1e-6) {
        this.mesh.rotation.y = Math.atan2(dx, dz) + FACING_OFFSET
        this.clips.play(/walk/i)
      } else {
        this.clips.play(/idle/i)
      }
    }
    this.last = { x: p.x, z: p.z }
  }
  // brief white emissive blink so a hit reads instantly on the enemy's body
  flashHit() {
    if (this.dying) return
    const meshes = this.mesh.getChildMeshes(false) as AbstractMesh[]
    for (const m of meshes) {
      const mat = m.material as StandardMaterial | null
      if (!mat || !('emissiveColor' in mat)) continue
      const prev = mat.emissiveColor?.clone() ?? new Color3(0, 0, 0)
      mat.emissiveColor = new Color3(0.9, 0.9, 0.9)
      setTimeout(() => { if (!m.isDisposed()) mat.emissiveColor = prev }, 90)
    }
  }

  // Play the death clip once, then dispose this corpse. Caller has already
  // removed the enemy from gameplay (no more hits/sync after this).
  die(onDone?: () => void) {
    if (this.dying) return
    this.dying = true
    // quick scale-pop the instant it dies, for a satisfying punch
    const s = this.mesh.scaling.x
    Animation.CreateAndStartAnimation('pop', this.mesh, 'scaling', 60, 8,
      new Vector3(s, s, s), new Vector3(s * 1.25, s * 1.25, s * 1.25), Animation.ANIMATIONLOOPMODE_CONSTANT)
    this.clips.play(/death_a$/i, { loop: false, force: true, onEnd: () => { this.dispose(); onDone?.() } })
  }
  dispose() {
    this.clips.dispose()
    this.mesh.dispose(false, true)
  }
}
