import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh, LinesMesh } from '@babylonjs/core'
import { Tower } from './Tower'

const COLOR = {
  cannon: new Color3(0.5,0.5,0.55),
  slow: new Color3(0.25,0.45,0.9),
  sniper: new Color3(0.15,0.15,0.2),
}

// unit-radius circle points (closed loop) in the XZ plane, reused for every ring
const RING_POINTS: Vector3[] = []
for (let i = 0; i <= 64; i++) {
  const a = (i / 64) * Math.PI * 2
  RING_POINTS.push(new Vector3(Math.cos(a), 0, Math.sin(a)))
}

export class TowerView {
  readonly mesh: Mesh
  private ring: LinesMesh
  constructor(scene: Scene, private tower: Tower) {
    this.mesh = MeshBuilder.CreateCylinder('tower', { height: 1.5, diameter: 1.2 }, scene)
    const m = new StandardMaterial('tm', scene); m.diffuseColor = COLOR[tower.kind]
    this.mesh.material = m
    this.mesh.position.set(tower.pos.x, 0.75, tower.pos.z)
    // thin dashed range ring on the ground (unit radius, scaled to range in sync)
    this.ring = MeshBuilder.CreateDashedLines('range', { points: RING_POINTS, dashSize: 2, gapSize: 2, dashNb: 80 }, scene)
    this.ring.color = COLOR[tower.kind]
    this.ring.isPickable = false
    this.ring.position.set(tower.pos.x, 0.08, tower.pos.z)
    this.sync()
  }
  sync() {
    this.mesh.scaling.y = 1 + this.tower.level * 0.25
    this.mesh.position.y = 0.75 * this.mesh.scaling.y
    const r = this.tower.stats.range
    this.ring.scaling.set(r, 1, r)
  }
  dispose() { this.mesh.dispose(); this.ring.dispose() }
}
