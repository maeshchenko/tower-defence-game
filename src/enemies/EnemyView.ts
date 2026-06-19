import { Scene, TransformNode } from '@babylonjs/core'
import { Enemy } from './Enemy'
import { AssetManager } from '../rendering/AssetManager'

export class EnemyView {
  readonly mesh: TransformNode
  constructor(_scene: Scene, assets: AssetManager, private enemy: Enemy) {
    this.mesh = assets.instance('enemy.' + enemy.kind)
    assets.playIdle(this.mesh)
    this.sync()
  }
  sync() {
    const p = this.enemy.pos
    this.mesh.position.set(p.x, 0, p.z)
  }
  dispose() { this.mesh.dispose(false, true) }
}
