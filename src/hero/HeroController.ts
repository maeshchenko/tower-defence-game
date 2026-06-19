import { Scene, Vector3 } from '@babylonjs/core'
import { CameraRig } from '../camera/CameraRig'
import { HeroWeapon } from './HeroWeapon'
import { Enemy } from '../enemies/Enemy'
import { EnemyView } from '../enemies/EnemyView'

const SPEED = 6

export class HeroController {
  private keys = new Set<string>()
  private wantFire = false
  constructor(private scene: Scene, private rig: CameraRig, private weapon: HeroWeapon) {
    addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()))
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    addEventListener('pointerdown', () => { if (this.rig.mode === 'hero') this.wantFire = true })
  }
  update(dt: number, enemies: { enemy: Enemy; view: EnemyView }[]): { hit: Enemy; damage: number } | null {
    this.weapon.tick(dt)
    if (this.rig.mode !== 'hero') { this.wantFire = false; return null }
    const cam = this.rig.heroCam
    const fwd = cam.getDirection(Vector3.Forward()); fwd.y = 0; fwd.normalize()
    const right = cam.getDirection(Vector3.Right()); right.y = 0; right.normalize()
    let move = Vector3.Zero()
    if (this.keys.has('w')) move.addInPlace(fwd)
    if (this.keys.has('s')) move.subtractInPlace(fwd)
    if (this.keys.has('d')) move.addInPlace(right)
    if (this.keys.has('a')) move.subtractInPlace(right)
    if (move.length() > 0) { move.normalize().scaleInPlace(SPEED * dt); cam.cameraDirection.addInPlace(move) }

    if (this.wantFire) {
      this.wantFire = false
      const dmg = this.weapon.fire()
      if (dmg != null) {
        const pick = this.scene.pick(this.scene.getEngine().getRenderWidth()/2, this.scene.getEngine().getRenderHeight()/2)
        if (pick?.hit && pick.pickedMesh) {
          const found = enemies.find((e) => e.view.mesh === pick.pickedMesh)
          if (found) return { hit: found.enemy, damage: dmg }
        }
      }
    }
    return null
  }
}
