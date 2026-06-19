import { Scene, ArcRotateCamera, Vector3 } from '@babylonjs/core'
import { Vec3 } from '../core/Vec3'

export type ViewMode = 'top' | 'hero'

// height on the hero the third-person camera looks at (≈ chest)
const HERO_LOOK_Y = 1.0

export class CameraRig {
  mode: ViewMode = 'top'
  readonly topCam: ArcRotateCamera
  readonly heroCam: ArcRotateCamera // third-person follow camera, orbits the hero
  constructor(private scene: Scene, private canvas: HTMLCanvasElement, heroStart: Vec3) {
    this.topCam = new ArcRotateCamera('top', -Math.PI / 2, 0.6, 45, Vector3.Zero(), scene)
    this.topCam.attachControl(canvas, true)

    this.heroCam = new ArcRotateCamera('hero', -Math.PI / 2, 1.0, 9,
      new Vector3(heroStart.x, HERO_LOOK_Y, heroStart.z), scene)
    this.heroCam.minZ = 0.05
    this.heroCam.lowerBetaLimit = 0.25; this.heroCam.upperBetaLimit = 1.45 // keep above ground
    this.heroCam.lowerRadiusLimit = 5; this.heroCam.upperRadiusLimit = 16   // zoom range
    // movement is driven by HeroController (which owns the hero's world position),
    // so disable the camera's own keyboard panning. Rotation is free mouse-look
    // (below) and the wheel zooms via attachControl.
    this.heroCam.keysUp = []; this.heroCam.keysDown = []; this.heroCam.keysLeft = []; this.heroCam.keysRight = []
    canvas.addEventListener('mousemove', this.onMouseLook)
    // any click while in third-person (re)captures the cursor so free mouse-look
    // works without holding a button, and re-grabs it after the player hit Esc
    canvas.addEventListener('pointerdown', this.onCanvasPointerDown)
    scene.activeCamera = this.topCam
  }

  private onCanvasPointerDown = () => {
    if (this.mode === 'hero' && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.()
  }

  // free mouse-look in third-person: moving the mouse orbits the camera around
  // the hero (the hero then faces the camera's forward, via HeroController).
  private onMouseLook = (e: MouseEvent) => {
    if (this.mode !== 'hero' || document.pointerLockElement !== this.canvas) return
    this.heroCam.alpha -= e.movementX * 0.0035
    const b = this.heroCam.beta - e.movementY * 0.0035
    this.heroCam.beta = Math.max(this.heroCam.lowerBetaLimit!, Math.min(this.heroCam.upperBetaLimit!, b))
  }

  // keep the follow camera centred on the hero (called every frame)
  syncHero(p: Vec3) { this.heroCam.setTarget(new Vector3(p.x, HERO_LOOK_Y, p.z)) }
  toggle() {
    if (this.mode === 'top') {
      this.mode = 'hero'
      this.topCam.detachControl()
      this.scene.activeCamera = this.heroCam
      this.heroCam.attachControl(this.canvas, true) // wheel zoom; rotation via mouse-look
      this.canvas.requestPointerLock?.()
    } else {
      this.mode = 'top'
      this.heroCam.detachControl()
      document.exitPointerLock?.()
      this.scene.activeCamera = this.topCam
      this.topCam.attachControl(this.canvas, true)
    }
  }
  setHeroPosition(p: Vec3) { this.syncHero(p) }
  get heroPosition(): Vec3 { const v = this.heroCam.target; return { x: v.x, y: v.y, z: v.z } }
}
