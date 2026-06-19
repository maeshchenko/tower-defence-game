import { Engine, Scene, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial, Mesh } from '@babylonjs/core'
import { EventBus } from './core/EventBus'
import { GameState } from './core/GameState'
import { Level } from './world/Level'
import { CameraRig } from './camera/CameraRig'
import { HeroState } from './hero/HeroState'
import { HeroWeapon } from './hero/HeroWeapon'
import { HeroController, HeroShot } from './hero/HeroController'
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
const MAPS = Level.maps()
const state = new GameState(bus, { totalWaves: 2 }) // 2 waves per map

// shared environment materials
const roadMat = new StandardMaterial('roadmat', scene); roadMat.diffuseColor = new Color3(0.35, 0.3, 0.25)
const cellMat = new StandardMaterial('cellmat', scene); cellMat.diffuseColor = new Color3(0.3, 0.55, 0.8); cellMat.alpha = 0.85
const baseMat = new StandardMaterial('bm', scene); baseMat.diffuseColor = new Color3(0.2, 0.4, 0.9)
const ROAD_W = 2.2

let mapIndex = 0
let level!: Level
let wm!: WaveManager
let tm!: TowerManager
let envMeshes: Mesh[] = []

const rig = new CameraRig(scene, canvas, { x: 0, y: 0, z: 0 })
const heroState = new HeroState(bus)
const heroWeapon = new HeroWeapon()
const heroCtrl = new HeroController(scene, rig, heroWeapon)
const hud = new HUD(state, heroState); hud.mount()

let selectedKind: TowerKind | null = null
const buildMenu = new BuildMenu((k) => { selectedKind = k }); buildMenu.mount()

const views = new Map<Enemy, EnemyView>()
const towerViews = new Map<Tower, TowerView>()
let over = false

// build the road, build-cell pads and base marker for the current level
function buildEnvironment() {
  for (let i = 0; i < level.path.length - 1; i++) {
    const a = level.path[i], b = level.path[i + 1]
    const horizontal = Math.abs(b.x - a.x) > Math.abs(b.z - a.z)
    const len = Math.hypot(b.x - a.x, b.z - a.z) + ROAD_W // overlap corners
    const seg = MeshBuilder.CreateBox('road', { width: horizontal ? len : ROAD_W, height: 0.1, depth: horizontal ? ROAD_W : len }, scene)
    seg.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2); seg.material = roadMat
    envMeshes.push(seg)
  }
  for (const c of level.cells) {
    const pad = MeshBuilder.CreateBox('cell', { size: 2.2 }, scene)
    pad.position.set(c.pos.x, 0.06, c.pos.z); pad.scaling.y = 0.04; pad.material = cellMat
    envMeshes.push(pad)
  }
  const baseMesh = MeshBuilder.CreateBox('base', { size: 2 }, scene)
  baseMesh.position.set(level.base.x, 1, level.base.z); baseMesh.material = baseMat
  envMeshes.push(baseMesh)
}

// tear down the current map and load map i (gold/lives carry over via shared GameState)
function loadMap(i: number) {
  for (const v of views.values()) v.dispose(); views.clear()
  for (const v of towerViews.values()) v.dispose(); towerViews.clear()
  for (const p of projectiles) p.mesh.dispose(); projectiles.length = 0
  for (const m of envMeshes) m.dispose(); envMeshes = []
  mapIndex = i
  level = MAPS[i]
  wm = new WaveManager(level.path, WaveManager.mapWaves(i))
  tm = new TowerManager(state, level)
  buildEnvironment()
  rig.setHeroPosition({ x: level.base.x, y: 0, z: level.base.z - 3 })
  selectedKind = null
  nextWaveTimer = 8
}

bus.on('gameOver', ({ victory }) => {
  if (victory && mapIndex < MAPS.length - 1) { state.nextMap(); loadMap(mapIndex + 1); return }
  over = true; hud.showEnd(victory)
})

// projectiles: small spheres a tower fires that home onto the (moving) target
const SHOT_COLOR: Record<TowerKind, Color3> = {
  cannon: new Color3(1, 0.8, 0.2), slow: new Color3(0.4, 0.7, 1), sniper: new Color3(1, 0.3, 0.3),
}
const SHOT_MAT: Record<TowerKind, StandardMaterial> = {} as Record<TowerKind, StandardMaterial>
for (const k of ['cannon', 'slow', 'sniper'] as TowerKind[]) {
  const m = new StandardMaterial('shot_' + k, scene); m.emissiveColor = SHOT_COLOR[k]; m.diffuseColor = SHOT_COLOR[k]
  SHOT_MAT[k] = m
}
const heroShotMat = new StandardMaterial('shot_hero', scene)
heroShotMat.emissiveColor = new Color3(0.6, 1, 0.5); heroShotMat.diffuseColor = new Color3(0.6, 1, 0.5)

// a projectile either homes onto a target enemy, or flies straight along dir until ttl runs out
interface Projectile { mesh: Mesh; target?: Enemy; dir?: Vector3; ttl: number }
const projectiles: Projectile[] = []
const SHOT_SPEED = 18
function spawnBall(x: number, y: number, z: number, mat: StandardMaterial, diameter: number): Mesh {
  const ball = MeshBuilder.CreateSphere('proj', { diameter, segments: 6 }, scene)
  ball.material = mat; ball.isPickable = false; ball.position.set(x, y, z)
  return ball
}
function fireTowerShot(from: { x: number; z: number }, target: Enemy, kind: TowerKind) {
  const ball = spawnBall(from.x, 1.2, from.z, SHOT_MAT[kind], kind === 'sniper' ? 0.35 : 0.5)
  projectiles.push({ mesh: ball, target, ttl: 3 })
}
function fireHeroShot(from: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, hit: Enemy | null) {
  const ball = spawnBall(from.x, from.y, from.z, heroShotMat, 0.22)
  if (hit) projectiles.push({ mesh: ball, target: hit, ttl: 3 })
  else projectiles.push({ mesh: ball, dir: new Vector3(dir.x, dir.y, dir.z).normalize(), ttl: 0.6 })
}
function updateProjectiles(dt: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    p.ttl -= dt
    if (p.ttl <= 0) { p.mesh.dispose(); projectiles.splice(i, 1); continue }
    if (p.target) {
      const tgt = new Vector3(p.target.pos.x, 0.8, p.target.pos.z) // follow the moving target
      const dir = tgt.subtract(p.mesh.position)
      const step = SHOT_SPEED * dt
      if (dir.length() <= step) { p.mesh.dispose(); projectiles.splice(i, 1); continue }
      p.mesh.position.addInPlace(dir.normalize().scale(step))
    } else if (p.dir) {
      p.mesh.position.addInPlace(p.dir.scale(SHOT_SPEED * dt))
    }
  }
}

// hero shot handling: spawn its visible projectile and apply damage on a hit
function processHeroShot(shot: HeroShot | null) {
  if (!shot) return
  fireHeroShot(shot.from, shot.dir, shot.hit)
  if (shot.hit) {
    shot.hit.takeDamage(shot.damage)
    if (!shot.hit.alive && views.has(shot.hit)) {
      state.addGold(shot.hit.bounty); bus.emit('enemyKilled', { bounty: shot.hit.bounty })
      views.get(shot.hit)!.dispose(); views.delete(shot.hit); wm.remove(shot.hit)
    }
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

// auto-advance waves: a countdown runs during build phase; Enter starts immediately
let nextWaveTimer = 8 // seconds before the first wave
function startNextWave() {
  if (over || state.phase !== 'build') return
  state.startWave(); wm.startWave(state.wave - 1); nextWaveTimer = -1
}

// input: Tab toggle, Enter start wave now
addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault(); rig.toggle()
    hud.setCrosshair(rig.mode === 'hero'); buildMenu.setVisible(rig.mode === 'top')
  }
  if (e.key === 'Enter') startNextWave()
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
      fireTowerShot(shot.from, shot.target, firing?.kind ?? 'cannon')
      shot.target.takeDamage(shot.damage)
      if (shot.slow) shot.target.applySlow(shot.slow, 1.5)
      if (!shot.target.alive && !shot.target.reachedBase && views.has(shot.target)) {
        state.addGold(shot.target.bounty); bus.emit('enemyKilled', { bounty: shot.target.bounty })
        views.get(shot.target)!.dispose(); views.delete(shot.target); wm.remove(shot.target)
      }
    }
    processHeroShot(heroCtrl.update(dt, [...views].map(([enemy, view]) => ({ enemy, view }))))
    if (wm.cleared()) {
      state.addGold(20 + state.wave * 5); state.endWave()
      const phaseAfter: string = state.phase
      if (phaseAfter === 'build') nextWaveTimer = 5 // auto-start the next wave after a short break
    }
  } else {
    processHeroShot(heroCtrl.update(dt, []))
    if (!over && state.phase === 'build' && nextWaveTimer > 0) {
      nextWaveTimer -= dt
      if (nextWaveTimer <= 0) startNextWave()
    }
  }
  mapInfo.textContent = `Карта ${mapIndex + 1}/${MAPS.length}`
  waveInfo.textContent = (!over && state.phase === 'build' && nextWaveTimer > 0)
    ? `Волна ${state.wave + 1} через ${Math.ceil(nextWaveTimer)}с — Enter, чтобы раньше`
    : ''
  hud.update()
})

// map indicator + next-wave countdown banner (top center)
const mapInfo = document.createElement('div')
mapInfo.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);color:#fff;font-family:monospace;font-size:16px;text-shadow:0 0 4px #000;pointer-events:none'
document.body.appendChild(mapInfo)
const waveInfo = document.createElement('div')
waveInfo.style.cssText = 'position:fixed;top:34px;left:50%;transform:translateX(-50%);color:#ffd24d;font-family:monospace;font-size:15px;text-shadow:0 0 4px #000;pointer-events:none'
document.body.appendChild(waveInfo)

// controls + cost legend
const legend = document.createElement('div')
legend.style.cssText = 'position:fixed;top:8px;right:8px;color:#fff;font-family:monospace;font-size:13px;line-height:1.5;text-align:right;text-shadow:0 0 3px #000;pointer-events:none'
legend.innerHTML =
  `cannon ${TOWER_DEFS.cannon[0].cost}g · slow ${TOWER_DEFS.slow[0].cost}g · sniper ${TOWER_DEFS.sniper[0].cost}g<br>` +
  `выбери башню → клик по синей клетке<br>клик по башне = апгрейд<br>волны идут сами · Enter — начать сразу<br>Tab — герой/обзор · в герое: WASD + мышь + ЛКМ`
document.body.appendChild(legend)

loadMap(0)
engine.runRenderLoop(() => scene.render())
addEventListener('resize', () => engine.resize())
buildMenu.setVisible(true)
