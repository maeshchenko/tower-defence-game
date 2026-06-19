import '@babylonjs/loaders/glTF'
import { Engine, Scene, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial, Mesh, Matrix, TransformNode } from '@babylonjs/core'
import { AssetManager } from './rendering/AssetManager'
import { EventBus } from './core/EventBus'
import { Vec3 } from './core/Vec3'
import { GameState } from './core/GameState'
import { Level } from './world/Level'
import { generateDecor, Prop, Obstacle } from './world/Decor'
import { CameraRig } from './camera/CameraRig'
import { HeroState } from './hero/HeroState'
import { HeroWeapon } from './hero/HeroWeapon'
import { HeroController, HeroShot } from './hero/HeroController'
import { WaveManager } from './enemies/WaveManager'
import { EnemyView } from './enemies/EnemyView'
import { Enemy } from './enemies/Enemy'
import { EnemyKind } from './enemies/EnemyTypes'
import { TowerManager } from './towers/TowerManager'
import { TowerView } from './towers/TowerView'
import { Tower } from './towers/Tower'
import { TowerKind, TOWER_DEFS } from './towers/TowerTypes'
import { HUD } from './ui/HUD'
import { BuildMenu } from './ui/BuildMenu'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
const assets = new AssetManager()

function showLoading(): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = 'Загрузка моделей…'
  el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#10141c;color:#ffd24d;font-family:monospace;font-size:22px;z-index:50'
  document.body.appendChild(el)
  return el
}

const light = new HemisphericLight('l', new Vector3(0, 1, 0), scene)
light.specular = new Color3(0, 0, 0) // no shiny glare on the ground

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
const state = new GameState(bus, { totalWaves: 10 }) // 10 waves per map

// shared environment materials
const roadMat = new StandardMaterial('roadmat', scene); roadMat.diffuseColor = new Color3(0.35, 0.3, 0.25)
const cellMat = new StandardMaterial('cellmat', scene); cellMat.diffuseColor = new Color3(0.3, 0.55, 0.8); cellMat.alpha = 0.85
const ROAD_W = 2.2
// decor materials (shared)
const mat = (name: string, r: number, g: number, b: number) => { const m = new StandardMaterial(name, scene); m.diffuseColor = new Color3(r, g, b); m.specularColor = new Color3(0, 0, 0); return m }
const bushMat = mat('bush', 0.22, 0.5, 0.22)
const moundMat = mat('mound', 0.32, 0.42, 0.2)
const patchMats = [mat('p0', 0.3, 0.4, 0.18), mat('p1', 0.38, 0.32, 0.2), mat('p2', 0.16, 0.38, 0.16)]

let mapIndex = 0
let level!: Level
let wm!: WaveManager
let tm!: TowerManager
let envMeshes: Mesh[] = []
let envProps: TransformNode[] = []
let obstacles: Obstacle[] = [] // solid props that block movement AND projectiles
const PROJ_R = 0.2
function inObstacle(x: number, z: number): boolean {
  for (const o of obstacles) {
    if (Math.abs(x - o.x) < o.hw + PROJ_R && Math.abs(z - o.z) < o.hd + PROJ_R) return true
  }
  return false
}

const rig = new CameraRig(scene, canvas, { x: 0, y: 0, z: 0 })
const heroState = new HeroState(bus)
const heroWeapon = new HeroWeapon()
const heroCtrl = new HeroController(scene, rig, heroWeapon)
const hud = new HUD(state, heroState); hud.mount()

// KayKit Knight model — created after assets are preloaded in boot()
// The Knight's visual front is local +Z and heroCtrl.yaw = atan2(aim.x, aim.z)
// already points +Z at the cursor, so no extra offset is needed to face the aim.
const HERO_FACING_OFFSET = 0
let heroBody!: TransformNode

function makeHero() {
  heroBody = assets.instance('hero.knight')
  heroBody.getChildMeshes().forEach((m) => (m.isPickable = false))
  assets.playIdle(heroBody)
}

function syncHero() {
  heroBody.position.set(heroCtrl.pos.x, 0, heroCtrl.pos.z)
  heroBody.rotation.y = heroCtrl.yaw + HERO_FACING_OFFSET
  // visible from above when alive; hidden in first-person or while respawning
  heroBody.setEnabled(rig.mode !== 'hero' && heroState.alive)
  rig.syncHero(heroCtrl.pos)
}

let selectedKind: TowerKind | null = null
const buildMenu = new BuildMenu((k) => { selectedKind = k }, {
  cannon: TOWER_DEFS.cannon[0].cost, slow: TOWER_DEFS.slow[0].cost, sniper: TOWER_DEFS.sniper[0].cost,
}); buildMenu.mount()

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
  const keep = assets.instance('base.keep')
  keep.position.set(level.base.x, 0, level.base.z)
  keep.getChildMeshes().forEach((m) => (m.isPickable = false))
  envProps.push(keep)

  // scatter decor + obstacles to make the field feel like a real place
  const decor = generateDecor(level, mapIndex)
  for (const p of decor.props) buildProp(p)
  obstacles = decor.obstacles
  heroCtrl.setObstacles(obstacles)
}

let patchTick = 0
function buildProp(p: Prop) {
  const add = (m: Mesh) => { m.isPickable = false; envMeshes.push(m) }
  const SOLID_KEY: Record<string, string> = { wall: 'prop.wall', rock: 'prop.rock', crate: 'prop.crate', tree: 'prop.tree' }
  const key = SOLID_KEY[p.kind]
  if (key) {
    const node = assets.instance(key)
    node.position.set(p.x, 0, p.z)
    node.rotation.y = p.rot
    const base = node.scaling.x
    node.scaling.set(base * (p.w / 1.5), base * (p.h / 1.5), base * (p.d / 1.5))
    node.getChildMeshes().forEach((m) => { m.isPickable = false })
    envProps.push(node)
    return
  }
  if (p.kind === 'bush') {
    const m = MeshBuilder.CreateSphere('bush', { diameter: p.w, segments: 6 }, scene)
    m.position.set(p.x, p.w * 0.3, p.z); m.scaling.y = 0.6; m.material = bushMat; add(m)
  } else if (p.kind === 'mound') {
    const m = MeshBuilder.CreateSphere('mound', { diameter: p.w, segments: 10 }, scene)
    m.position.set(p.x, 0, p.z); m.scaling.y = 0.22; m.material = moundMat; add(m)
  } else { // patch
    const m = MeshBuilder.CreateBox('patch', { width: p.w, height: 0.06, depth: p.d }, scene)
    m.position.set(p.x, 0.04, p.z); m.rotation.y = p.rot; m.material = patchMats[(patchTick++) % patchMats.length]; add(m)
  }
}

// tear down the current map and load map i (gold/lives carry over via shared GameState)
function loadMap(i: number) {
  for (const v of views.values()) v.dispose(); views.clear()
  for (const v of towerViews.values()) v.dispose(); towerViews.clear()
  for (const p of projectiles) p.mesh.dispose(false, true); projectiles.length = 0
  for (const m of envMeshes) m.dispose(); envMeshes = []
  for (const n of envProps) n.dispose(false, true); envProps = []
  mapIndex = i
  level = MAPS[i]
  wm = new WaveManager(level.path, WaveManager.mapWaves(i))
  tm = new TowerManager(state, level)
  buildEnvironment()
  heroCtrl.pos = { x: level.base.x, y: 0, z: level.base.z - 3 }
  syncHero()
  selectedKind = null
  nextWaveTimer = 8
}

bus.on('gameOver', ({ victory }) => {
  if (victory && mapIndex < MAPS.length - 1) { state.nextMap(); loadMap(mapIndex + 1); return }
  over = true; hud.showEnd(victory)
})
// on death, send the hero back to the base to respawn there
bus.on('heroDied', () => { heroCtrl.pos = { x: level.base.x, y: 0, z: level.base.z - 3 } })

// projectiles: tower and hero shots are GLB models (see fireTowerShot / fireHeroShot);
// only enemy shots are still plain spheres.
const enemyShotMat = new StandardMaterial('shot_enemy', scene)
enemyShotMat.emissiveColor = new Color3(1, 0.25, 0.2); enemyShotMat.diffuseColor = new Color3(1, 0.25, 0.2)

// a projectile homes onto a target enemy (tower shot, damage applied on arrival),
// flies straight and hits enemies (hero shot), or flies straight at the hero (enemy shot).
interface Projectile { mesh: TransformNode; target?: Enemy; dir?: Vector3; ttl: number; damage?: number; slow?: number; vsHero?: boolean; speed?: number }
const projectiles: Projectile[] = []
const SHOT_SPEED = 18
const ENEMY_SHOT_SPEED = 9 // slower so the hero can dodge by moving
function spawnBall(x: number, y: number, z: number, mat: StandardMaterial, diameter: number): Mesh {
  const ball = MeshBuilder.CreateSphere('proj', { diameter, segments: 6 }, scene)
  ball.material = mat; ball.isPickable = false; ball.position.set(x, y, z)
  return ball
}
function spawnModelShot(key: string, x: number, y: number, z: number): TransformNode {
  const node = assets.instance(key)
  node.position.set(x, y, z)
  node.getChildMeshes().forEach((m) => (m.isPickable = false))
  return node
}
// Point a projectile model's nose (local +Z, e.g. the arrow shaft) along its velocity.
const TMP_AIM = new Vector3()
function aimProjectile(node: TransformNode, dir: { x: number; y: number; z: number }) {
  TMP_AIM.set(dir.x, dir.y, dir.z)
  if (TMP_AIM.lengthSquared() < 1e-8) return
  node.lookAt(node.position.add(TMP_AIM)) // lookAt aligns local +Z to the target
}
function fireTowerShot(from: { x: number; z: number }, target: Enemy, kind: TowerKind, damage: number, slow?: number) {
  const key = kind === 'cannon' ? 'ammo.cannon' : kind === 'sniper' ? 'ammo.sniper' : 'ammo.slow'
  const ball = spawnModelShot(key, from.x, 1.2, from.z)
  aimProjectile(ball, { x: target.pos.x - from.x, y: 0.8 - 1.2, z: target.pos.z - from.z })
  projectiles.push({ mesh: ball, target, ttl: 3, damage, slow })
}
// actual body radius per enemy kind (capsule radius), for tight hit detection
const ENEMY_RADIUS: Record<EnemyKind, number> = { normal: 0.4, fast: 0.3, tank: 0.7 }
const PROJ_HIT = 0.15 // projectile radius added to the target's radius
function fireHeroShot(from: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, damage: number) {
  const ball = spawnModelShot('ammo.sniper', from.x, from.y, from.z)
  aimProjectile(ball, dir)
  projectiles.push({ mesh: ball, dir: new Vector3(dir.x, dir.y, dir.z).normalize(), ttl: 1.5, damage })
}
// enemy fires a straight (non-homing) shot at where the hero is now — dodge by moving
function fireEnemyShot(from: { x: number; z: number }, heroPos: Vec3, damage: number) {
  const ball = spawnBall(from.x, 0.8, from.z, enemyShotMat, 0.3)
  const d = new Vector3(heroPos.x - from.x, 1.0 - 0.8, heroPos.z - from.z).normalize()
  projectiles.push({ mesh: ball, dir: d, ttl: 2.5, damage, vsHero: true, speed: ENEMY_SHOT_SPEED })
}

// RPG-style floating damage number at a world position
function floatText(x: number, y: number, z: number, text: string, color: string) {
  const cam = scene.activeCamera; if (!cam) return
  const w = engine.getRenderWidth(), h = engine.getRenderHeight()
  const p = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), scene.getTransformMatrix(), cam.viewport.toGlobal(w, h))
  if (p.z < 0 || p.z > 1) return // behind the camera
  const rect = canvas.getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'dmgnum'
  el.textContent = text
  el.style.cssText = `position:fixed;left:${rect.left + p.x * rect.width / w}px;top:${rect.top + p.y * rect.height / h}px;` +
    `transform:translate(-50%,-50%);color:${color};font-family:monospace;font-weight:bold;font-size:15px;` +
    `text-shadow:0 0 3px #000;pointer-events:none;transition:transform .7s ease-out,opacity .7s;z-index:5`
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-160%)'; el.style.opacity = '0' })
  setTimeout(() => el.remove(), 720)
}
// damage is applied here, when a projectile reaches its target — not when fired
function applyHit(target: Enemy, damage: number, slow?: number) {
  if (!views.has(target)) return // already dead or leaked
  target.takeDamage(damage)
  floatText(target.pos.x, 1.7, target.pos.z, `-${damage} (${target.hp}/${target.maxHp})`, '#ffe27a')
  if (slow) target.applySlow(slow, 1.5)
  if (!target.alive) {
    state.addGold(target.bounty); bus.emit('enemyKilled', { bounty: target.bounty })
    views.get(target)!.dispose(); views.delete(target); wm.remove(target)
  }
}
function updateProjectiles(dt: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    p.ttl -= dt
    if (p.ttl <= 0) { p.mesh.dispose(false, true); projectiles.splice(i, 1); continue }
    const step = (p.speed ?? SHOT_SPEED) * dt
    if (p.target) {
      const tgt = new Vector3(p.target.pos.x, 0.8, p.target.pos.z) // follow the moving target
      const dir = tgt.subtract(p.mesh.position)
      aimProjectile(p.mesh, dir) // keep the model's nose on the (moving) target
      if (dir.length() <= step) { // arrived — deal damage now
        if (p.damage != null) applyHit(p.target, p.damage, p.slow)
        p.mesh.dispose(false, true); projectiles.splice(i, 1); continue
      }
      p.mesh.position.addInPlace(dir.normalize().scale(step))
    } else if (p.dir) {
      p.mesh.position.addInPlace(p.dir.scale(step))
      const pp = p.mesh.position
      if (p.vsHero) {
        // enemy shot vs the hero — by the hero's actual body (radius + height)
        const hdx = heroCtrl.pos.x - pp.x, hdz = heroCtrl.pos.z - pp.z
        const r = 0.4 + PROJ_HIT
        if (hdx * hdx + hdz * hdz < r * r && Math.abs(pp.y - 0.7) < 0.8 && heroState.alive) {
          heroState.takeDamage(p.damage ?? 0)
          floatText(heroCtrl.pos.x, 2.0, heroCtrl.pos.z, `-${p.damage}`, '#ff6b6b')
          p.mesh.dispose(false, true); projectiles.splice(i, 1); continue
        }
      } else if (p.damage != null) {
        // hero ballistic shot vs enemies — hit by the enemy's actual body (radius + height)
        for (const e of views.keys()) {
          const ep = e.pos
          const r = ENEMY_RADIUS[e.kind] + PROJ_HIT
          const hdx = ep.x - pp.x, hdz = ep.z - pp.z
          if (hdx * hdx + hdz * hdz < r * r && Math.abs(pp.y - 0.8) < 0.95) {
            applyHit(e, p.damage); p.mesh.dispose(false, true); projectiles.splice(i, 1); break
          }
        }
      }
    }
    // walls and other solid props stop projectiles (no damage)
    if (projectiles[i] === p && inObstacle(p.mesh.position.x, p.mesh.position.z)) {
      p.mesh.dispose(false, true); projectiles.splice(i, 1)
    }
  }
}

// hero shot handling: spawn its visible projectile; damage lands on arrival (applyHit)
function processHeroShot(shot: HeroShot | null) {
  if (!shot) return
  fireHeroShot(shot.from, shot.dir, shot.damage)
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
  if (nextWaveTimer > 0) { // reward starting early: 1 gold per second skipped
    const bonus = Math.ceil(nextWaveTimer)
    state.addGold(bonus); flash(`+${bonus}з за ранний старт`)
  }
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
  const clickedTower = [...towerViews].find(([, v]) => {
    let n = pick.pickedMesh as any
    while (n) { if (n === v.mesh) return true; n = n.parent }
    return false
  })
  if (clickedTower) { if (tm.upgrade(clickedTower[0])) clickedTower[1].sync(); return }
  if (!selectedKind) { heroCtrl.triggerFire(); return } // no tower selected -> hero shoots toward the click
  const cell = level.cellAt(pick.pickedPoint.x, pick.pickedPoint.z, 2)
  if (!cell) return
  if (cell.occupied) { flash('Клетка занята'); return }
  const t = tm.build(selectedKind, cell)
  if (t) towerViews.set(t, new TowerView(scene, assets, t))
  else flash('Не хватает золота')
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000
  heroState.tick(dt)
  updateProjectiles(dt)
  if (!over && state.phase === 'wave') {
    for (const e of wm.update(dt)) views.set(e, new EnemyView(scene, assets, e))
    for (const e of [...wm.active]) {
      e.update(dt)
      if (e.reachedBase) { state.damageBase(1); views.get(e)?.dispose(); views.delete(e); wm.remove(e); continue }
      views.get(e)?.sync()
      const atk = e.attack(dt, heroCtrl.pos) // returns damage when in range + off cooldown
      if (atk != null && heroState.alive) fireEnemyShot(e.pos, heroCtrl.pos, atk)
    }
    for (const shot of tm.update(dt, wm.active)) {
      const firing = [...towerViews.keys()].find((t) => t.pos === shot.from)
      fireTowerShot(shot.from, shot.target, firing?.kind ?? 'cannon', shot.damage, shot.slow) // damage lands on arrival
    }
    processHeroShot(heroCtrl.update(dt))
    if (wm.cleared()) {
      state.addGold(20 + state.wave * 5); state.endWave()
      const phaseAfter: string = state.phase
      if (phaseAfter === 'build') nextWaveTimer = 5 // auto-start the next wave after a short break
    }
  } else {
    processHeroShot(heroCtrl.update(dt))
    if (!over && state.phase === 'build' && nextWaveTimer > 0) {
      nextWaveTimer -= dt
      if (nextWaveTimer <= 0) startNextWave()
    }
  }
  syncHero()
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
  `башня выбрана → клик по клетке строит<br>клик по башне = апгрейд<br>без выбора башни: клик = выстрел героя<br>WASD — бег героя (в любом виде)<br>волны сами · Enter — сразу · Tab — сверху/от лица`
document.body.appendChild(legend)

async function boot() {
  const overlay = showLoading()
  await assets.preload(scene)
  overlay.remove()
  makeHero()
  loadMap(0)
  engine.runRenderLoop(() => scene.render())
  addEventListener('resize', () => engine.resize())
  buildMenu.setVisible(true)
}
boot()
