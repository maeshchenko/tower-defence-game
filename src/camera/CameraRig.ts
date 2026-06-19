import { Scene, UniversalCamera, ArcRotateCamera, Vector3 } from '@babylonjs/core'
import { Vec3 } from '../core/Vec3'

export type ViewMode = 'top' | 'hero'

// hero eye height above ground (quarter-size hero)
const HERO_EYE = 0.425

export class CameraRig {
  mode: ViewMode = 'top'
  readonly topCam: ArcRotateCamera
  readonly heroCam: UniversalCamera
  constructor(private scene: Scene, private canvas: HTMLCanvasElement, heroStart: Vec3) {
    this.topCam = new ArcRotateCamera('top', -Math.PI/2, 0.6, 45, Vector3.Zero(), scene)
    this.topCam.attachControl(canvas, true)
    this.heroCam = new UniversalCamera('hero', new Vector3(heroStart.x, HERO_EYE, heroStart.z), scene)
    this.heroCam.checkCollisions = true
    this.heroCam.applyGravity = false
    this.heroCam.ellipsoid = new Vector3(0.125, 0.2125, 0.125)
    this.heroCam.minZ = 0.05
    scene.activeCamera = this.topCam
  }
  toggle() {
    if (this.mode === 'top') {
      this.mode = 'hero'
      this.topCam.detachControl()
      this.scene.activeCamera = this.heroCam
      this.heroCam.attachControl(this.canvas, true)
      this.canvas.requestPointerLock?.()
    } else {
      this.mode = 'top'
      this.heroCam.detachControl()
      document.exitPointerLock?.()
      this.scene.activeCamera = this.topCam
      this.topCam.attachControl(this.canvas, true)
    }
  }
  setHeroPosition(p: Vec3) { this.heroCam.position.set(p.x, HERO_EYE, p.z) }
  get heroPosition(): Vec3 { const v = this.heroCam.position; return { x: v.x, y: v.y, z: v.z } }
}
