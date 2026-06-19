import { Engine, Scene, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial, Mesh } from '@babylonjs/core'
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
import { TowerKind, TOWER_DEFS } from './towers/TowerTypes'
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

// draw a continuous road by connecting consecutive waypoints with segments
const roadMat = new StandardMaterial('roadmat', scene); roadMat.diffuseColor = new Color3(0.35, 0.3, 0.25)
const ROAD_W = 2.2
for (let i = 0; i < level.path.length - 1; i++) {
  const a = level.path[i], b = level.path[i + 1]
  const horizontal = Math.abs(b.x - a.x) > Math.abs(b.z - a.z)
  const len = Math.hypot(b.x - a.x, b.z - a.z) + ROAD_W // overlap corners
  const seg = MeshBuilder.CreateBox('road', { width: horizontal ? len : ROAD_W, height: 0.1, depth: horizontal ? ROAD_W : len }, scene)
  seg.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2)
  seg.material = roadMat
}
// draw build cells as visible pads (where towers can be placed)
for (const c of level.cells) {
  const pad = MeshBuilder.CreateBox('cell', { size: 2.2 }, scene)
  pad.position.set(c.pos.x, 0.06, c.pos.z); pad.scaling.y = 0.04
  const pmat = new StandardMaterial('cellmat', scene)
  pmat.diffuseColor = new Color3(0.3, 0.55, 0.8); pmat.alpha = 0.85
  pad.material = pmat
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

// projectiles: small spheres a tower fires that home onto the (moving) target
const SHOT_COLOR: Record<TowerKind, Color3> = {
  cannon: new Color3(1, 0.8, 0.2), slow: new Color3(0.4, 0.7, 1), sniper: new Color3(1, 0.3, 0.3),
}
const SHOT_MAT: Record<TowerKind, StandardMaterial> = {} as Record<TowerKind, StandardMaterial>
for (const k of ['cannon', 'slow', 'sniper'] as TowerKind[]) {
  const m = new StandardMaterial('shot_' + k, scene); m.emissiveColor = SHOT_COLOR[k]; m.diffuseColor = SHOT_COLOR[k]
  SHOT_MAT[k] = m
}
interface Projectile { mesh: Mesh; target: Enemy }
const projectiles: Projectile[] = []
const SHOT_SPEED = 18
function fireProjectile(from: { x: number; z: number }, target: Enemy, kind: TowerKind) {
  const ball = MeshBuilder.CreateSphere('proj', { diameter: kind === 'sniper' ? 0.35 : 0.5, segments: 6 }, scene)
  ball.material = SHOT_MAT[kind]; ball.isPickable = false
  ball.position.set(from.x, 1.2, from.z)
  projectiles.push({ mesh: ball, target })
}
function updateProjectiles(dt: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    const tgt = new Vector3(p.target.pos.x, 0.8, p.target.pos.z) // follow the moving target
    const dir = tgt.subtract(p.mesh.position)
    const step = SHOT_SPEED * dt
    if (dir.length() <= step) { p.mesh.dispose(); projectiles.splice(i, 1); continue }
    p.mesh.position.addInPlace(dir.normalize().scale(step))
  }
}

// transient toast message (e.g. "Not enough gold")
const toast = document.createElement('div')
toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);color:#ffd24d;font-family:monospace;font-size:18px;text-shadow:0 0 4px #000;pointer-events:none;opacity:0;transition:opacity .2s'
document.body.appendChild(toast)
let toastTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  toast.textContent = msg; toast.style.opacity = '1'
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.style.opacity = '0' }, 1200)
}

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
  if (cell.occupied) { flash('Клетка занята'); return }
  const t = tm.build(selectedKind, cell)
  if (t) towerViews.set(t, new TowerView(scene, t))
  else flash('Не хватает золота')
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000
  heroState.tick(dt)
  updateProjectiles(dt)
  if (!over && state.phase === 'wave') {
    for (const e of wm.update(dt)) views.set(e, new EnemyView(scene, e))
    for (const e of [...wm.active]) {
      e.update(dt)
      if (e.reachedBase) { state.damageBase(1); views.get(e)?.dispose(); views.delete(e); wm.remove(e); continue }
      views.get(e)?.sync()
    }
    for (const shot of tm.update(dt, wm.active)) {
      const firing = [...towerViews.keys()].find((t) => t.pos === shot.from)
      fireProjectile(shot.from, shot.target, firing?.kind ?? 'cannon')
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

// controls + cost legend
const legend = document.createElement('div')
legend.style.cssText = 'position:fixed;top:8px;right:8px;color:#fff;font-family:monospace;font-size:13px;line-height:1.5;text-align:right;text-shadow:0 0 3px #000;pointer-events:none'
legend.innerHTML =
  `cannon ${TOWER_DEFS.cannon[0].cost}g · slow ${TOWER_DEFS.slow[0].cost}g · sniper ${TOWER_DEFS.sniper[0].cost}g<br>` +
  `выбери башню → клик по синей клетке<br>клик по башне = апгрейд<br>Enter — старт волны · Tab — герой/обзор<br>в герое: WASD + мышь + ЛКМ`
document.body.appendChild(legend)

engine.runRenderLoop(() => scene.render())
addEventListener('resize', () => engine.resize())
buildMenu.setVisible(true)
