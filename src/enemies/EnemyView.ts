import { Scene, TransformNode, AnimationGroup } from '@babylonjs/core'
import { Enemy } from './Enemy'
import { AssetManager } from '../rendering/AssetManager'

// KayKit characters' visual front is local -Z (verified in-browser), while
// atan2(dx,dz) aligns local +Z to the movement vector — so add PI to face forward.
const FACING_OFFSET = Math.PI

export class EnemyView {
  readonly mesh: TransformNode
  private groups: AnimationGroup[]
  private current = ''
  private last: { x: number; z: number } | null = null
  constructor(_scene: Scene, assets: AssetManager, private enemy: Enemy) {
    this.mesh = assets.instance('enemy.' + enemy.kind)
    this.groups = assets.getAnimationGroups(this.mesh)
    this.playClip('idle')
    this.sync()
  }
  // start the first group matching `name`, stop the rest; no-op if already current
  private playClip(name: 'idle' | 'walk') {
    if (this.current === name) return
    this.current = name
    const re = name === 'walk' ? /walk/i : /idle/i
    let started = false
    for (const g of this.groups) {
      if (!started && re.test(g.name)) { g.start(true); started = true }
      else g.stop()
    }
  }
  sync() {
    const p = this.enemy.pos
    this.mesh.position.set(p.x, 0, p.z)
    if (this.last) {
      const dx = p.x - this.last.x, dz = p.z - this.last.z
      if (dx * dx + dz * dz > 1e-6) {
        this.mesh.rotation.y = Math.atan2(dx, dz) + FACING_OFFSET
        this.playClip('walk')
      } else {
        this.playClip('idle')
      }
    }
    this.last = { x: p.x, z: p.z }
  }
  dispose() {
    for (const g of this.groups) g.dispose()
    this.mesh.dispose(false, true)
  }
}
