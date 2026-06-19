// TEMPORARY visual checkpoint (after Task 11). Throwaway — deleted before Task 17.
// Proves the real logic modules (Level, WaveManager, Enemy) drive on-screen movement.
import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial, Mesh } from '@babylonjs/core'
import { Level } from './world/Level'
import { WaveManager } from './enemies/WaveManager'
import { Enemy } from './enemies/Enemy'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)

const cam = new ArcRotateCamera('top', -Math.PI / 2, 0.7, 55, Vector3.Zero(), scene)
cam.attachControl(canvas, true)
new HemisphericLight('l', new Vector3(0, 1, 0), scene)

const ground = MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, scene)
const gm = new StandardMaterial('g', scene); gm.diffuseColor = new Color3(0.2, 0.45, 0.2)
ground.material = gm

const level = Level.demo()

// draw the path as connecting road segments
for (let i = 0; i < level.path.length - 1; i++) {
  const a = level.path[i], b = level.path[i + 1]
  const mid = new Vector3((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2)
  const len = Math.hypot(b.x - a.x, b.z - a.z) + 2
  const horizontal = Math.abs(b.x - a.x) > Math.abs(b.z - a.z)
  const seg = MeshBuilder.CreateBox('road', { width: horizontal ? len : 2, height: 0.1, depth: horizontal ? 2 : len }, scene)
  seg.position = mid
  const rm = new StandardMaterial('rm', scene); rm.diffuseColor = new Color3(0.35, 0.3, 0.25); seg.material = rm
}
// spawn + base markers
const spawnMark = MeshBuilder.CreateBox('spawn', { size: 2 }, scene)
spawnMark.position.set(level.spawn.x, 1, level.spawn.z)
const sm = new StandardMaterial('sm', scene); sm.diffuseColor = new Color3(0.9, 0.6, 0.1); spawnMark.material = sm
const baseMark = MeshBuilder.CreateBox('base', { size: 2.5 }, scene)
baseMark.position.set(level.base.x, 1.25, level.base.z)
const bm = new StandardMaterial('bm', scene); bm.diffuseColor = new Color3(0.2, 0.4, 0.9); baseMark.material = bm

const STYLE: Record<string, { color: Color3; h: number; d: number }> = {
  normal: { color: new Color3(0.75, 0.75, 0.75), h: 1.6, d: 0.8 },
  fast: { color: new Color3(0.9, 0.85, 0.2), h: 1.1, d: 0.6 },
  tank: { color: new Color3(0.8, 0.2, 0.2), h: 1.9, d: 1.4 },
}

const wm = new WaveManager(level.path, WaveManager.demoWaves())
const views = new Map<Enemy, Mesh>()
let wave = 0
wm.startWave(wave)

const hud = document.getElementById('hud')!

function spawnView(e: Enemy): Mesh {
  const s = STYLE[e.kind]
  const m = MeshBuilder.CreateCapsule('enemy', { height: s.h, radius: s.d / 2 }, scene)
  const mat = new StandardMaterial('em', scene); mat.diffuseColor = s.color; m.material = mat
  return m
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000
  for (const e of wm.update(dt)) views.set(e, spawnView(e))
  for (const e of [...wm.active]) {
    e.update(dt)
    if (e.reachedBase) { views.get(e)?.dispose(); views.delete(e); wm.remove(e); continue }
    const v = views.get(e)
    if (v) v.position.set(e.pos.x, STYLE[e.kind].h / 2, e.pos.z)
  }
  // auto-advance waves so escalation (fast at w2, tank at w4) is visible; loop at end
  if (wm.cleared()) { wave = (wave + 1) % 10; wm.startWave(wave) }
  hud.innerHTML = `CHECKPOINT DEMO (Task 11)<br>Wave: ${wave + 1}/10<br>Active enemies: ${wm.active.length}`
})

engine.runRenderLoop(() => scene.render())
addEventListener('resize', () => engine.resize())
