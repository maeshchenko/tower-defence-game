import { Scene, Vector3 } from '@babylonjs/core'
import { CameraRig } from '../camera/CameraRig'
import { HeroWeapon } from './HeroWeapon'
import { Vec3 } from '../core/Vec3'

const SPEED = 1.5
const BOUND = 19 // keep hero inside the field
const EYE_FPS = 1.1
const EYE_TOP = 0.6

// a shot fired by the hero this frame — a ballistic projectile (no auto-aim)
export interface HeroShot { from: Vec3; dir: Vec3; damage: number }

// The hero is a world entity (pos + yaw), driven in BOTH views:
//  - FPS ('hero'): move relative to look, aim with the mouse, fire on click.
//  - Top-down ('top'): move relative to the screen, face the cursor, fire via triggerFire().
// Shots are NOT homing: the projectile flies straight, so you must lead moving enemies.
export class HeroController {
  pos: Vec3 = { x: 0, y: 0, z: 0 }
  yaw = 0
  private keys = new Set<string>()
  private wantFire = false
  constructor(private scene: Scene, private rig: CameraRig, private weapon: HeroWeapon) {
    // track by physical key code so any keyboard layout (e.g. Cyrillic цфыв) works as WASD
    addEventListener('keydown', (e) => this.keys.add(e.code))
    addEventListener('keyup', (e) => this.keys.delete(e.code))
    addEventListener('pointerdown', () => { if (this.rig.mode === 'hero') this.wantFire = true })
  }

  // called by the top-down click handler when the click is not a build/upgrade action
  triggerFire() { this.wantFire = true }

  private flat(v: Vector3): Vector3 { v.y = 0; return v.length() > 0 ? v.normalize() : v }

  update(dt: number): HeroShot | null {
    this.weapon.tick(dt)
    const topMode = this.rig.mode === 'top'

    // movement basis: relative to the active camera's screen orientation
    const fwd = topMode
      ? this.flat(this.rig.topCam.getForwardRay().direction.clone())
      : this.flat(this.rig.heroCam.getDirection(Vector3.Forward()))
    const right = new Vector3(fwd.z, 0, -fwd.x) // left-handed: right of +Z is +X

    const move = Vector3.Zero()
    if (this.keys.has('KeyW')) move.addInPlace(fwd)
    if (this.keys.has('KeyS')) move.subtractInPlace(fwd)
    if (this.keys.has('KeyD')) move.addInPlace(right)
    if (this.keys.has('KeyA')) move.subtractInPlace(right)
    if (move.length() > 0) {
      move.normalize().scaleInPlace(SPEED * dt)
      this.pos.x = Math.max(-BOUND, Math.min(BOUND, this.pos.x + move.x))
      this.pos.z = Math.max(-BOUND, Math.min(BOUND, this.pos.z + move.z))
    }

    // aim direction + facing
    let aim: Vector3
    if (topMode) {
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m) => m.name === 'ground')
      aim = pick?.pickedPoint
        ? this.flat(new Vector3(pick.pickedPoint.x - this.pos.x, 0, pick.pickedPoint.z - this.pos.z))
        : fwd
    } else {
      aim = this.rig.heroCam.getDirection(Vector3.Forward()).normalize()
    }
    const aimFlat = this.flat(aim.clone())
    this.yaw = Math.atan2(aimFlat.x, aimFlat.z)

    // shooting — fire a straight projectile (collision resolved while it travels)
    if (this.wantFire) {
      this.wantFire = false
      const dmg = this.weapon.fire()
      if (dmg != null) {
        const from = { x: this.pos.x, y: topMode ? EYE_TOP : EYE_FPS, z: this.pos.z }
        return { from, dir: { x: aim.x, y: aim.y, z: aim.z }, damage: dmg }
      }
    }
    return null
  }
}
