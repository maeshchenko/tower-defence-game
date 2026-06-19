import { Scene, TransformNode } from '@babylonjs/core'
import { Enemy } from './Enemy'
import { AssetManager } from '../rendering/AssetManager'
import { ClipPlayer } from '../rendering/ClipPlayer'

// KayKit skeletons' visual front is local -Z, while atan2(dx,dz) aligns local
// +Z to the movement vector — so add PI to face the direction of travel.
const FACING_OFFSET = Math.PI

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
  // Play the death clip once, then dispose this corpse. Caller has already
  // removed the enemy from gameplay (no more hits/sync after this).
  die(onDone?: () => void) {
    if (this.dying) return
    this.dying = true
    this.clips.play(/death_a$/i, { loop: false, force: true, onEnd: () => { this.dispose(); onDone?.() } })
  }
  dispose() {
    this.clips.dispose()
    this.mesh.dispose(false, true)
  }
}
