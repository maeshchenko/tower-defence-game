import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core'
import { Tower } from './Tower'

const COLOR = {
  cannon: new Color3(0.5,0.5,0.55),
  slow: new Color3(0.25,0.45,0.9),
  sniper: new Color3(0.15,0.15,0.2),
}

export class TowerView {
  readonly mesh: Mesh
  constructor(scene: Scene, private tower: Tower) {
    this.mesh = MeshBuilder.CreateCylinder('tower', { height: 1.5, diameter: 1.2 }, scene)
    const m = new StandardMaterial('tm', scene); m.diffuseColor = COLOR[tower.kind]
    this.mesh.material = m
    this.mesh.position.set(tower.pos.x, 0.75, tower.pos.z)
    this.sync()
  }
  sync() { this.mesh.scaling.y = 1 + this.tower.level * 0.25 }
  dispose() { this.mesh.dispose() }
}
