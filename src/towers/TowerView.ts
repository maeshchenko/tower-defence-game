import { Scene, MeshBuilder, Color3, Vector3, TransformNode, LinesMesh, Animation } from '@babylonjs/core'
import { Tower } from './Tower'
import { AssetManager } from '../rendering/AssetManager'

const COLOR = {
  cannon: new Color3(0.5,0.5,0.55),
  slow: new Color3(0.25,0.45,0.9),
  sniper: new Color3(0.15,0.15,0.2),
}
// correction between the model's forward axis and our atan2(dx,dz) heading; tuned in-browser
const TOWER_FACING_OFFSET = 0

// unit-radius circle points (closed loop) in the XZ plane, reused for every ring
const RING_POINTS: Vector3[] = []
for (let i = 0; i <= 64; i++) {
  const a = (i / 64) * Math.PI * 2
  RING_POINTS.push(new Vector3(Math.cos(a), 0, Math.sin(a)))
}

export class TowerView {
  readonly mesh: TransformNode
  private ring: LinesMesh
  constructor(scene: Scene, assets: AssetManager, private tower: Tower) {
    this.mesh = assets.instance('tower.' + tower.kind)
    this.mesh.position.set(tower.pos.x, 0, tower.pos.z)
    // thin dashed range ring on the ground (unit radius, scaled to range in sync)
    this.ring = MeshBuilder.CreateDashedLines('range', { points: RING_POINTS, dashSize: 2, gapSize: 2, dashNb: 80 }, scene)
    this.ring.color = COLOR[tower.kind]
    this.ring.isPickable = false
    this.ring.position.set(tower.pos.x, 0.08, tower.pos.z)
    this.ring.isVisible = false // shown only on hover / selection (declutter)
    this.sync()
  }
  setRingVisible(v: boolean) { this.ring.isVisible = v }
  sync() {
    const grow = 1 + this.tower.level * 0.15
    const base = (this.mesh.metadata?.baseScale as number) ?? this.mesh.scaling.x
    this.mesh.metadata = { ...(this.mesh.metadata ?? {}), baseScale: base }
    this.mesh.scaling.setAll(base * grow)
    const r = this.tower.stats.range
    this.ring.scaling.set(r, 1, r)
  }
  // point the tower's front at its current heading (tower.yaw). Offset corrects
  // for the model's own forward axis; tuned so the barrel faces the target.
  applyYaw(yaw: number) { this.mesh.rotation.y = yaw + TOWER_FACING_OFFSET }

  // recoil pulse on fire: a quick downward squash that springs back
  kickback() {
    const base = (this.mesh.metadata?.baseScale as number) ?? this.mesh.scaling.x
    const grow = 1 + this.tower.level * 0.15
    const s = base * grow
    const keys = [
      { frame: 0, value: new Vector3(s, s, s) },
      { frame: 2, value: new Vector3(s * 1.08, s * 0.82, s * 1.08) },
      { frame: 8, value: new Vector3(s, s, s) },
    ]
    const anim = new Animation('kick', 'scaling', 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT)
    anim.setKeys(keys)
    this.mesh.animations = [anim]
    this.mesh.getScene().beginAnimation(this.mesh, 0, 8, false)
  }

  dispose() { this.mesh.dispose(false, true); this.ring.dispose() }
}
