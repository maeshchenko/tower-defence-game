import { Scene, ArcRotateCamera, Vector3, Camera } from '@babylonjs/core'
import { Vec3 } from '../core/Vec3'
import { ISO_BETA, PRESET_ALPHAS, nextPresetAlpha, easeAlpha } from './CameraPresets'

export type ViewMode = 'top' | 'hero'

// height on the hero the third-person camera looks at (≈ chest)
const HERO_LOOK_Y = 1.0

export class CameraRig {
  mode: ViewMode = 'top'
  readonly topCam: ArcRotateCamera
  readonly heroCam: ArcRotateCamera // third-person follow camera, orbits the hero
  private topTargetAlpha = PRESET_ALPHAS[0] // top cam eases toward this preset angle
  private introT = 0 // >0 while the establishing zoom-in plays
  private settleRadius = 45 // top-cam resting zoom; set per map to frame its size
  private panLimit = 20 // arrow-key pan clamp (half-extent of the island), set per map
  private panKeys = { up: false, down: false, left: false, right: false }
  constructor(private scene: Scene, private canvas: HTMLCanvasElement, heroStart: Vec3) {
    this.topCam = new ArcRotateCamera('top', PRESET_ALPHAS[0], ISO_BETA, 45, Vector3.Zero(), scene)
    this.topCam.attachControl(canvas, true)
    // true isometric look: orthographic projection (parallel lines, no perspective splay).
    // radius is still driven by wheel zoom + intro, but now feeds the ortho box (see applyOrtho).
    this.topCam.mode = Camera.ORTHOGRAPHIC_CAMERA
    this.topCam.minZ = -200; this.topCam.maxZ = 400 // tilted ortho: widen near/far so nothing clips
    // lock tilt to the iso preset; no free orbit/pan — only wheel zoom remains
    this.topCam.lowerBetaLimit = ISO_BETA; this.topCam.upperBetaLimit = ISO_BETA
    this.topCam.lowerRadiusLimit = 24; this.topCam.upperRadiusLimit = 100
    // remove pointer rotate/pan + keyboard pan; keep the mouse-wheel zoom input
    this.topCam.inputs.removeByType('ArcRotateCameraPointersInput')
    this.topCam.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')

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
    this.applyOrtho()
    scene.getEngine().onResizeObservable.add(() => this.applyOrtho())
    // arrow keys pan the top-cam target across the island (top mode only)
    addEventListener('keydown', this.onPanKey)
    addEventListener('keyup', this.onPanKey)
  }

  private onPanKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown'
    switch (e.key) {
      case 'ArrowUp': this.panKeys.up = down; break
      case 'ArrowDown': this.panKeys.down = down; break
      case 'ArrowLeft': this.panKeys.left = down; break
      case 'ArrowRight': this.panKeys.right = down; break
      default: return
    }
    if (this.mode === 'top') e.preventDefault() // stop page scroll while panning
  }

  // map the top-cam radius (zoom) + canvas aspect onto the orthographic box.
  // ortho ignores radius for projection, so we drive the box ourselves each frame.
  private applyOrtho(): void {
    const aspect = (this.canvas.width || 1) / (this.canvas.height || 1)
    const half = this.topCam.radius * 0.5
    this.topCam.orthoLeft = -half * aspect
    this.topCam.orthoRight = half * aspect
    this.topCam.orthoTop = half
    this.topCam.orthoBottom = -half
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
  // carry the hero's facing (yaw) into the FPS camera so the view doesn't snap to a
  // fixed heading on Tab — you keep looking where the hero was aiming top-down.
  toggle(heroYaw?: number) {
    if (this.mode === 'top') {
      this.mode = 'hero'
      if (heroYaw !== undefined) this.heroCam.alpha = Math.atan2(-Math.cos(heroYaw), -Math.sin(heroYaw))
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
      this.topTargetAlpha = this.topCam.alpha // avoid a jump back to preset[0]
    }
  }

  // rotate the top-down camera to the neighbouring 90deg preset (top mode only)
  rotatePreset(dir: 1 | -1): void {
    if (this.mode !== 'top') return
    this.topTargetAlpha = nextPresetAlpha(this.topTargetAlpha, dir)
  }

  // frame the current map: set the resting zoom from the map's size (called on load)
  setFrameRadius(r: number): void {
    this.settleRadius = r
    if (this.mode === 'top' && this.introT <= 0) this.topCam.radius = r
  }

  // short establishing zoom-in when a map loads (camera settles from far to the play radius)
  playIntro(): void { this.introT = 1.2; this.topCam.radius = this.settleRadius + 18 }

  // per-frame: ease the top camera toward its target preset angle (+ intro radius)
  update(dt: number): void {
    if (this.mode !== 'top') return
    if (this.introT > 0) {
      this.introT = Math.max(0, this.introT - dt)
      this.topCam.radius = this.settleRadius + (this.introT / 1.2) * 18 // start far, settle to frame radius
    }
    this.topCam.alpha = easeAlpha(this.topCam.alpha, this.topTargetAlpha, dt)
    this.panTopCam(dt)
    this.applyOrtho() // radius (wheel zoom + intro) feeds the ortho box every frame
  }

  // arrow-key pan: move the top-cam target in the camera's ground plane, clamped to island bounds.
  private panTopCam(dt: number): void {
    const a = this.topCam.alpha
    // ground-plane forward (screen "up") and right, derived from the orbit angle
    const fx = -Math.cos(a), fz = -Math.sin(a)
    const rx = Math.sin(a), rz = -Math.cos(a)
    let dx = 0, dz = 0
    if (this.panKeys.up) { dx += fx; dz += fz }
    if (this.panKeys.down) { dx -= fx; dz -= fz }
    if (this.panKeys.right) { dx += rx; dz += rz }
    if (this.panKeys.left) { dx -= rx; dz -= rz }
    if (dx === 0 && dz === 0) return
    const speed = this.topCam.radius * 0.9 * dt // pan faster when zoomed out
    const t = this.topCam.target
    t.x = Math.max(-this.panLimit, Math.min(this.panLimit, t.x + dx * speed))
    t.z = Math.max(-this.panLimit, Math.min(this.panLimit, t.z + dz * speed))
  }

  // set how far arrow-key pan can drift from centre (per-map island half-extent)
  setPanLimit(limit: number): void { this.panLimit = limit }
  setHeroPosition(p: Vec3) { this.syncHero(p) }
  get heroPosition(): Vec3 { const v = this.heroCam.target; return { x: v.x, y: v.y, z: v.z } }
}
