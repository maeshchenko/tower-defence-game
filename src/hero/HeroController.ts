import { Scene, Vector3 } from '@babylonjs/core'
import { CameraRig } from '../camera/CameraRig'
import { HeroWeapon } from './HeroWeapon'
import { Vec3 } from '../core/Vec3'
import { Obstacle } from '../world/Decor'

const SPEED = 1.8
const SPRINT_MULT = 2.4 // hold Shift to sprint
const HERO_R = 0.4 // hero collision radius
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
  private active = true // false while the hero is dead/respawning: no move, aim or fire
  private obstacles: Obstacle[] = []
  private bound = 19 // play-area half-extent; set per map so big maps are walkable
  setObstacles(o: Obstacle[]) { this.obstacles = o }
  setBound(b: number) { this.bound = b }
  setActive(v: boolean) { this.active = v; if (!v) this.wantFire = false }
  private blocked(x: number, z: number): boolean {
    for (const o of this.obstacles) {
      if (Math.abs(x - o.x) < o.hw + HERO_R && Math.abs(z - o.z) < o.hd + HERO_R) return true
    }
    return false
  }
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
    this.weapon.tick(dt) // weapon keeps recharging even while dead
    if (!this.active) { this.wantFire = false; return null } // dead: ignore all input
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
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT_MULT : 1
      move.normalize().scaleInPlace(SPEED * sprint * dt)
      // move per-axis so the hero slides along walls instead of sticking
      const nx = Math.max(-this.bound, Math.min(this.bound, this.pos.x + move.x))
      if (!this.blocked(nx, this.pos.z)) this.pos.x = nx
      const nz = Math.max(-this.bound, Math.min(this.bound, this.pos.z + move.z))
      if (!this.blocked(this.pos.x, nz)) this.pos.z = nz
    }

    // aim direction + facing
    let aim: Vector3
    if (topMode) {
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (m) => m.name === 'ground')
      aim = pick?.pickedPoint
        ? this.flat(new Vector3(pick.pickedPoint.x - this.pos.x, 0, pick.pickedPoint.z - this.pos.z))
        : fwd
    } else {
      // third-person: the follow camera looks down at the hero, so flatten its
      // forward to keep shots horizontal (otherwise they dive into the ground)
      aim = this.flat(this.rig.heroCam.getDirection(Vector3.Forward()))
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
