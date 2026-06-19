import { Engine, Scene, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial } from '@babylonjs/core'
import { EventBus } from './core/EventBus'
import { GameState } from './core/GameState'
import { Level } from './world/Level'
import { CameraRig } from './camera/CameraRig'
import { HeroState } from './hero/HeroState'
import { HeroWeapon } from './hero/HeroWeapon'
import { HeroController } from './hero/HeroController'
import { WaveManager } from './enemies/WaveManager'
import { EnemyView } from './enemies/EnemyView'
import { Enemy } from './enemies/Enemy'
import { TowerManager } from './towers/TowerManager'
import { TowerView } from './towers/TowerView'
import { Tower } from './towers/Tower'
import { TowerKind } from './towers/TowerTypes'
import { HUD } from './ui/HUD'
import { BuildMenu } from './ui/BuildMenu'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
new HemisphericLight('l', new Vector3(0,1,0), scene)

const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene)
const gm = new StandardMaterial('g', scene); gm.diffuseColor = new Color3(0.2,0.45,0.2)
ground.material = gm; ground.checkCollisions = true

// perimeter walls (invisible) so hero can't leave
for (const [x,z,w,d] of [[0,20,40,1],[0,-20,40,1],[20,0,1,40],[-20,0,1,40]] as const) {
  const wall = MeshBuilder.CreateBox('wall', { width: w, height: 4, depth: d }, scene)
  wall.position.set(x, 2, z); wall.checkCollisions = true; wall.isVisible = false
}

const bus = new EventBus()
const state = new GameState(bus)
const level = Level.demo()

// draw path as a strip of dark boxes (visual aid)
for (const p of level.path) {
  const m = MeshBuilder.CreateBox('node', { size: 1.5 }, scene)
  m.position.set(p.x, 0.05, p.z); m.scaling.y = 0.05
  const mat = new StandardMaterial('pm', scene); mat.diffuseColor = new Color3(0.35,0.3,0.25); m.material = mat
}
// base marker
const baseMesh = MeshBuilder.CreateBox('base', { size: 2 }, scene)
baseMesh.position.set(level.base.x, 1, level.base.z)
const bmat = new StandardMaterial('bm', scene); bmat.diffuseColor = new Color3(0.2,0.4,0.9); baseMesh.material = bmat

const rig = new CameraRig(scene, canvas, { x: level.base.x, y: 0, z: level.base.z - 3 })
const heroState = new HeroState(bus)
const heroWeapon = new HeroWeapon()
const heroCtrl = new HeroController(scene, rig, heroWeapon)
const wm = new WaveManager(level.path, WaveManager.demoWaves())
const tm = new TowerManager(state, level)
const hud = new HUD(state, heroState); hud.mount()

let selectedKind: TowerKind | null = null
const buildMenu = new BuildMenu((k) => { selectedKind = k }); buildMenu.mount()

const views = new Map<Enemy, EnemyView>()
const towerViews = new Map<Tower, TowerView>()
let over = false
bus.on('gameOver', ({ victory }) => { over = true; hud.showEnd(victory) })

// input: Tab toggle, Enter start wave
addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault(); rig.toggle()
    hud.setCrosshair(rig.mode === 'hero'); buildMenu.setVisible(rig.mode === 'top')
  }
  if (e.key === 'Enter' && state.phase === 'build') {
    state.startWave(); wm.startWave(state.wave - 1)
  }
})

// build / upgrade on click in top mode
scene.onPointerDown = (_evt, pick) => {
  if (rig.mode !== 'top' || over) return
  if (!pick?.pickedPoint) return
  // upgrade if clicked an existing tower
  const clickedTower = [...towerViews].find(([, v]) => v.mesh === pick.pickedMesh)
  if (clickedTower) { if (tm.upgrade(clickedTower[0])) clickedTower[1].sync(); return }
  if (!selectedKind) return
  const cell = level.cellAt(pick.pickedPoint.x, pick.pickedPoint.z, 2)
  if (!cell) return
  const t = tm.build(selectedKind, cell)
  if (t) towerViews.set(t, new TowerView(scene, t))
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000
  heroState.tick(dt)
  if (!over && state.phase === 'wave') {
    for (const e of wm.update(dt)) views.set(e, new EnemyView(scene, e))
    for (const e of [...wm.active]) {
      e.update(dt)
      if (e.reachedBase) { state.damageBase(1); views.get(e)?.dispose(); views.delete(e); wm.remove(e); continue }
      views.get(e)?.sync()
    }
    for (const shot of tm.update(dt, wm.active)) {
      shot.target.takeDamage(shot.damage)
      if (shot.slow) shot.target.applySlow(shot.slow, 1.5)
      if (!shot.target.alive && !shot.target.reachedBase && views.has(shot.target)) {
        state.addGold(shot.target.bounty); bus.emit('enemyKilled', { bounty: shot.target.bounty })
        views.get(shot.target)!.dispose(); views.delete(shot.target); wm.remove(shot.target)
      }
    }
    const hit = heroCtrl.update(dt, [...views].map(([enemy, view]) => ({ enemy, view })))
    if (hit) {
      hit.hit.takeDamage(hit.damage)
      if (!hit.hit.alive) {
        state.addGold(hit.hit.bounty); bus.emit('enemyKilled', { bounty: hit.hit.bounty })
        views.get(hit.hit)?.dispose(); views.delete(hit.hit); wm.remove(hit.hit)
      }
    }
    if (wm.cleared()) { state.addGold(20 + state.wave * 5); state.endWave() }
  } else {
    heroCtrl.update(dt, [])
  }
  hud.update()
})

engine.runRenderLoop(() => scene.render())
addEventListener('resize', () => engine.resize())
buildMenu.setVisible(true)
