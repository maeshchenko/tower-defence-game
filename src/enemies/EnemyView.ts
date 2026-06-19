import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import { Enemy } from './Enemy'

const STYLE = {
  normal: { color: new Color3(0.7,0.7,0.7), h: 1.6, d: 0.8 },
  fast: { color: new Color3(0.9,0.85,0.2), h: 1.1, d: 0.6 },
  tank: { color: new Color3(0.8,0.2,0.2), h: 1.8, d: 1.4 },
}

export class EnemyView {
  readonly mesh: Mesh
  constructor(scene: Scene, private enemy: Enemy) {
    const s = STYLE[enemy.kind]
    this.mesh = MeshBuilder.CreateCapsule('enemy', { height: s.h, radius: s.d/2 }, scene)
    const m = new StandardMaterial('em', scene); m.diffuseColor = s.color
    this.mesh.material = m
    this.sync()
  }
  sync() {
    const p = this.enemy.pos
    this.mesh.position.set(p.x, this.mesh.getBoundingInfo().boundingBox.extendSize.y, p.z)
  }
  dispose() { this.mesh.dispose() }
}
