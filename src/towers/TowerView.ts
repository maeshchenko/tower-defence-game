import { Scene, MeshBuilder, Color3, Vector3, TransformNode, LinesMesh, Animation } from '@babylonjs/core'
import { Tower } from './Tower'
import { TowerKind } from './TowerTypes'
import { AssetManager } from '../rendering/AssetManager'

const COLOR: Record<TowerKind, Color3> = {
  cannon: new Color3(0.5, 0.5, 0.55),
  slow: new Color3(0.25, 0.45, 0.9),
  sniper: new Color3(0.15, 0.15, 0.2),
  mortar: new Color3(0.85, 0.5, 0.25),
  tesla: new Color3(0.6, 0.4, 0.95),
}
// correction between the model's forward axis and our atan2(dx,dz) heading
const TOWER_FACING_OFFSET = 0

// optional hooks so the owner can (de)register the swappable mesh as a shadow caster
export interface TowerViewHooks { add(n: TransformNode): void; remove(n: TransformNode): void }

// unit-radius circle points (closed loop) in the XZ plane, reused for every ring
const RING_POINTS: Vector3[] = []
for (let i = 0; i <= 64; i++) {
  const a = (i / 64) * Math.PI * 2
  RING_POINTS.push(new Vector3(Math.cos(a), 0, Math.sin(a)))
}

export class TowerView {
  mesh!: TransformNode
  private ring: LinesMesh
  private builtLevel = -1
  constructor(scene: Scene, private assets: AssetManager, private tower: Tower, private hooks?: TowerViewHooks) {
    this.ring = MeshBuilder.CreateDashedLines('range', { points: RING_POINTS, dashSize: 2, gapSize: 2, dashNb: 80 }, scene)
    this.ring.color = COLOR[tower.kind]
    this.ring.isPickable = false
    this.ring.position.set(tower.pos.x, 0.08, tower.pos.z)
    this.ring.isVisible = false // shown only on hover / selection
    this.build()
    this.sync()
  }

  // (re)create the model for the tower's current level; upgrades swap body + weapon
  private build() {
    const node = this.assets.instance(`tower.${this.tower.kind}.${this.tower.level}`)
    node.position.set(this.tower.pos.x, 0, this.tower.pos.z)
    node.getChildMeshes().forEach((m) => (m.isPickable = true)) // must stay pickable so clicks select the tower
    this.mesh = node
    this.builtLevel = this.tower.level
    this.hooks?.add(node)
  }

  setRingVisible(v: boolean) { this.ring.isVisible = v }
  applyYaw(yaw: number) { this.mesh.rotation.y = yaw + TOWER_FACING_OFFSET }

  kickback() {
    const s = this.mesh.scaling.x
    const anim = new Animation('kick', 'scaling', 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT)
    anim.setKeys([
      { frame: 0, value: new Vector3(s, s, s) },
      { frame: 2, value: new Vector3(s * 1.08, s * 0.82, s * 1.08) },
      { frame: 8, value: new Vector3(s, s, s) },
    ])
    this.mesh.animations = [anim]
    this.mesh.getScene().beginAnimation(this.mesh, 0, 8, false)
  }

  sync() {
    if (this.tower.level !== this.builtLevel) { // upgraded -> rebuild with the new weapon
      const old = this.mesh
      this.hooks?.remove(old)
      old.dispose(false, true)
      this.build()
    }
    const r = this.tower.stats.range
    this.ring.scaling.set(r, 1, r)
  }

  dispose() { this.hooks?.remove(this.mesh); this.mesh.dispose(false, true); this.ring.dispose() }
}
