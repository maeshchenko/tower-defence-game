import { Scene, UniversalCamera, ArcRotateCamera, Vector3 } from '@babylonjs/core'
import { Vec3 } from '../core/Vec3'

export type ViewMode = 'top' | 'hero'

// hero eye height above ground
const HERO_EYE = 1.1

export class CameraRig {
  mode: ViewMode = 'top'
  readonly topCam: ArcRotateCamera
  readonly heroCam: UniversalCamera
  constructor(private scene: Scene, private canvas: HTMLCanvasElement, heroStart: Vec3) {
    this.topCam = new ArcRotateCamera('top', -Math.PI/2, 0.6, 45, Vector3.Zero(), scene)
    this.topCam.attachControl(canvas, true)
    this.heroCam = new UniversalCamera('hero', new Vector3(heroStart.x, HERO_EYE, heroStart.z), scene)
    this.heroCam.applyGravity = false
    this.heroCam.minZ = 0.05
    // movement is driven by HeroController (which owns the hero's world position),
    // so disable the camera's own WASD/arrow handling — it only does mouse-look.
    this.heroCam.keysUp = []; this.heroCam.keysDown = []; this.heroCam.keysLeft = []; this.heroCam.keysRight = []
    scene.activeCamera = this.topCam
  }

  // place the FPS camera at the hero's world position (called every frame)
  syncHero(p: Vec3) { this.heroCam.position.set(p.x, HERO_EYE, p.z) }
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
