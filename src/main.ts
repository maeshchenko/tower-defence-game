import '@babylonjs/loaders/glTF'
import { Engine, Scene, HemisphericLight, MeshBuilder, Vector3, Color3, Color4, StandardMaterial, Mesh, Matrix, TransformNode, DynamicTexture, Texture, TrailMesh, LinesMesh, ParticleSystem, PointerEventTypes } from '@babylonjs/core'
import { Environment } from './rendering/Environment'
import { loadPreset, savePreset, resolveQuality, QualityPreset } from './rendering/Quality'
import { Screenshake } from './fx/Screenshake'
import { Hitstop } from './fx/Hitstop'
import { burst } from './fx/Particles'
import { attachTrail } from './fx/Trail'
import { AssetManager } from './rendering/AssetManager'
import { ClipPlayer } from './rendering/ClipPlayer'
import { AudioBus } from './audio/AudioBus'
import { Sfx } from './audio/Sfx'
import { Music } from './audio/Music'
import { Settings } from './ui/Settings'
import { EventBus } from './core/EventBus'
import { Vec3 } from './core/Vec3'
import { GameState } from './core/GameState'
import { Level } from './world/Level'
import { generateDecor, Prop, Obstacle } from './world/Decor'
import { buildIsland } from './world/Island'
import { Sky } from './rendering/Sky'
import { CameraRig } from './camera/CameraRig'
import { HeroState } from './hero/HeroState'
import { HeroWeapon } from './hero/HeroWeapon'
import { HeroController, HeroShot } from './hero/HeroController'
import { WaveManager } from './enemies/WaveManager'
import { EnemyView } from './enemies/EnemyView'
import { Enemy } from './enemies/Enemy'
import { EnemyKind } from './enemies/EnemyTypes'
import { TowerManager } from './towers/TowerManager'
import { TowerView, TowerViewHooks } from './towers/TowerView'
import { Tower } from './towers/Tower'
import { TowerKind, TOWER_DEFS } from './towers/TowerTypes'
import { HUD } from './ui/HUD'
import { BuildMenu } from './ui/BuildMenu'
import { Speed } from './ui/Speed'
import { TowerPanel } from './ui/TowerPanel'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)
const assets = new AssetManager()
const audio = new AudioBus()
const sfx = new Sfx(audio)
const music = new Music(audio)

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

// procedural grass texture: mottled green noise drawn on a canvas, tiled across
// the ground so it reads as a living field rather than a flat plastic plate
function makeGrassTexture(): DynamicTexture {
  const S = 512
  const tex = new DynamicTexture('grass', { width: S, height: S }, scene, false)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#3e6b30'
  ctx.fillRect(0, 0, S, S)
  // broad soft patches for large-scale colour variation
  const patches = ['#456f32', '#37602a', '#4f7a38', '#335b26']
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = patches[(Math.random() * patches.length) | 0]
    ctx.globalAlpha = 0.25
    const r = 30 + Math.random() * 70
    ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2); ctx.fill()
  }
  // fine blade strokes for close-up grass detail
  ctx.globalAlpha = 0.5
  const blades = ['#4a7d3a', '#5b8a3c', '#356026', '#6f8f3f', '#2f5722']
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * S, y = Math.random() * S
    ctx.strokeStyle = blades[(Math.random() * blades.length) | 0]
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() * 2 - 1), y - (1 + Math.random() * 3)); ctx.stroke()
  }
  ctx.globalAlpha = 1
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.uScale = 9; tex.vScale = 9 // tile the 512px patch across the 40u field
  return tex
}

const ground = MeshBuilder.CreateGround('ground', { width: 80, height: 80 }, scene)
const gm = new StandardMaterial('g', scene)
gm.diffuseTexture = makeGrassTexture()
gm.specularColor = new Color3(0, 0, 0) // matte: no plastic glare under the sun
ground.material = gm; ground.checkCollisions = true; ground.receiveShadows = true

// per-map play boundary (invisible containment walls + visual cliff-lip rim),
// rebuilt to each map's size in rebuildBoundary() — see below.
let boundaryWalls: Mesh[] = []
let rimRocks: TransformNode[] = []

// stylized-toon render env (sun, soft shadows, glow, post-fx, fog) — quality-gated
let quality: QualityPreset = loadPreset()
const env = new Environment(scene, light, resolveQuality(quality))
env.setReceiver(ground)
const island = buildIsland(scene) // floating mesa under the play plane; visual only
void island
const sky = new Sky(scene)
env.setHorizonColor(sky.horizonColor) // fog fades to the horizon haze, not flat blue
sky.setClouds(resolveQuality(quality).clouds)
sky.setDistantIslands(resolveQuality(quality).distant)

// faint floating motes (pollen/sparkle) for atmosphere — med/high only
function buildAmbientMotes() {
  if (resolveQuality(quality).preset === 'low') return
  const tex = new DynamicTexture('moteTex', { width: 32, height: 32 }, scene, false)
  const c = tex.getContext() as CanvasRenderingContext2D
  const g = c.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g; c.fillRect(0, 0, 32, 32); tex.update(); tex.hasAlpha = true
  const ps = new ParticleSystem('motes', 120, scene)
  ps.particleTexture = tex
  ps.emitter = new Vector3(0, 4, 0)
  ps.minEmitBox = new Vector3(-35, 0, -35); ps.maxEmitBox = new Vector3(35, 8, 35)
  ps.color1 = new Color4(1, 1, 0.85, 0.12); ps.color2 = new Color4(1, 1, 1, 0.07)
  ps.colorDead = new Color4(1, 1, 1, 0)
  ps.minSize = 0.04; ps.maxSize = 0.1
  ps.minLifeTime = 4; ps.maxLifeTime = 8
  ps.emitRate = 10
  ps.direction1 = new Vector3(-0.2, 0.4, -0.2); ps.direction2 = new Vector3(0.2, 0.6, 0.2)
  ps.gravity = new Vector3(0, 0.02, 0)
  ps.start()
}
buildAmbientMotes()

// rebuild the play boundary for a map of half-extent `half`: invisible containment
// walls at the edge (hero can't leave) + scattered cliff-lip rocks just inside, so
// third-person never shows a bare slab edge. Sized per map so big maps are fully
// walkable and small maps aren't ringed far out in empty grass.
function rebuildBoundary(half: number) {
  for (const w of boundaryWalls) w.dispose(); boundaryWalls = []
  for (const r of rimRocks) { env.removeShadowCaster(r); r.dispose(false, true) } rimRocks = []
  const t = 1
  for (const [x, z, w, d] of [[0, half, 2 * half, t], [0, -half, 2 * half, t], [half, 0, t, 2 * half], [-half, 0, t, 2 * half]] as const) {
    const wall = MeshBuilder.CreateBox('wall', { width: w, height: 4, depth: d }, scene)
    wall.position.set(x, 2, z); wall.checkCollisions = true; wall.isVisible = false
    boundaryWalls.push(wall)
  }
  const B = half - 0.5, step = 3
  for (let p = -B; p <= B; p += step) {
    for (const [x, z] of [[p, B], [p, -B], [B, p], [-B, p]] as const) {
      const rock = assets.instance('prop.rock')
      rock.position.set(x, -0.2, z)
      rock.rotation.y = x + z // pseudo-varied yaw
      const s = rock.scaling.x * (0.7 + (Math.abs(x * 7 + z * 3) % 5) / 8)
      rock.scaling.set(s, s, s)
      rock.getChildMeshes().forEach((m) => (m.isPickable = false))
      env.addShadowCaster(rock); rimRocks.push(rock)
    }
  }
}

const bus = new EventBus()
const MAPS = Level.maps()
const state = new GameState(bus, { totalWaves: 10 }) // 10 waves per map

// shared material factory (used by the spawn hut)
const mat = (name: string, r: number, g: number, b: number) => { const m = new StandardMaterial(name, scene); m.diffuseColor = new Color3(r, g, b); m.specularColor = new Color3(0, 0, 0); return m }
// build-slot pad: flat translucent blue square on the grass — clearly a build tile,
// no glow/portal look. Lit normally, semi-transparent so it sits on the field.
const padMat = new StandardMaterial('padmat', scene)
padMat.diffuseColor = new Color3(0.32, 0.58, 0.9); padMat.emissiveColor = new Color3(0.12, 0.28, 0.5)
padMat.alpha = 0.6; padMat.specularColor = new Color3(0, 0, 0)
// brighter pad shown while a build kind is armed — signals "place here"
const padMatArmed = new StandardMaterial('padmatArmed', scene)
padMatArmed.diffuseColor = new Color3(0.5, 0.85, 1); padMatArmed.emissiveColor = new Color3(0.35, 0.7, 1)
padMatArmed.alpha = 0.85; padMatArmed.specularColor = new Color3(0, 0, 0)
const pads = new Map<string, Mesh>() // cell id -> its pad mesh (rebuilt per map)
function updatePadVisuals() {
  const armed = buildMenu.armed != null
  for (const c of level.cells) {
    const m = pads.get(c.id); if (!m) continue
    m.setEnabled(!c.occupied)                 // hide a pad once a tower occupies it
    m.material = armed ? padMatArmed : padMat // brighten every free pad while arming
  }
}

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
const speed = new Speed()
const hud = new HUD(state, heroState, speed); hud.mount()
const towerPanel = new TowerPanel(); towerPanel.mount()
const settings = new Settings(audio, {
  get: () => quality,
  set: (p) => { quality = p; env.applyQuality(resolveQuality(p)); sky.setClouds(resolveQuality(p).clouds); sky.setDistantIslands(resolveQuality(p).distant); savePreset(p) },
}); settings.mount()

// KayKit Knight model — created after assets are preloaded in boot()
// The Knight's visual front is local +Z and heroCtrl.yaw = atan2(aim.x, aim.z)
// already points +Z at the cursor, so no extra offset is needed to face the aim.
const HERO_FACING_OFFSET = 0
let heroBody!: TransformNode
let heroClips: ClipPlayer | undefined
let heroLast: { x: number; z: number } | null = null
let heroBusy = false // an attack one-shot is playing; don't override with locomotion

function makeHero() {
  heroBody = assets.instance('hero.knight')
  heroBody.getChildMeshes().forEach((m) => (m.isPickable = false))
  env.addShadowCaster(heroBody)
  heroClips = new ClipPlayer(assets.getAnimationGroups(heroBody))
  heroClips.play(/idle/i)
}

// play the hero's swing once when a shot is fired, then resume locomotion
function heroAttackAnim() {
  if (!heroClips) return
  heroBusy = true
  heroClips.play(/melee_attack/i, { loop: false, force: true, onEnd: () => { heroBusy = false; heroClips!.reset() } })
}

function syncHero() {
  const p = heroCtrl.pos
  heroBody.position.set(p.x, 0, p.z)
  heroBody.rotation.y = heroCtrl.yaw + HERO_FACING_OFFSET
  // visible from above when alive; hidden in first-person or while respawning
  heroBody.setEnabled(heroState.alive) // visible in both top-down and third-person
  if (heroClips && !heroBusy) {
    const moving = heroLast ? (p.x - heroLast.x) ** 2 + (p.z - heroLast.z) ** 2 > 1e-6 : false
    heroClips.play(moving ? /running_a$/i : /idle/i)
  }
  heroLast = { x: p.x, z: p.z }
  rig.syncHero(heroCtrl.pos)
}

let selectedKind: TowerKind | null = null
const BUILD_COSTS: Record<TowerKind, number> = {
  cannon: TOWER_DEFS.cannon[0].cost, slow: TOWER_DEFS.slow[0].cost, sniper: TOWER_DEFS.sniper[0].cost,
  mortar: TOWER_DEFS.mortar[0].cost, tesla: TOWER_DEFS.tesla[0].cost,
}
const buildMenu = new BuildMenu((k) => { selectedKind = k; deselectTower(); updatePadVisuals(); refreshBuildBanner() }, BUILD_COSTS)
buildMenu.mount()
// banner that names the armed tower + how to place/cancel; null hides it
function refreshBuildBanner() {
  const k = buildMenu.armed
  hud.setBuildBanner(k ? `СТРОИМ: ${k.toUpperCase()} (${BUILD_COSTS[k]}з) · клик по клетке · ПКМ/Esc отмена · Shift — подряд` : null)
}

const views = new Map<Enemy, EnemyView>()
const corpses: EnemyView[] = [] // dying enemies playing their death clip before disposal
const towerViews = new Map<Tower, TowerView>()
// shadow (de)registration for the tower mesh, which is swapped out on each upgrade
const towerHooks: TowerViewHooks = { add: (n) => env.addShadowCaster(n), remove: (n) => env.removeShadowCaster(n) }
let over = false
let started = false // gates wave start until the player presses Play on the title screen

// place a footprint-scaled tile model (ground/road/spawn) at x,z; y is baked by instance()
function placeTile(key: string, x: number, z: number) {
  const t = assets.instance(key)
  t.position.x = x; t.position.z = z
  t.getChildMeshes().forEach((m) => (m.isPickable = false))
  envProps.push(t)
}

// a little hut at the entry so enemies emerge from a doorway instead of thin air.
// offset back along the path so the doorway opening lands on the spawn point.
function buildSpawnHut() {
  const s = level.spawn
  const next = level.path[1] ?? { x: s.x, z: s.z + 1 }
  const dx = next.x - s.x, dz = next.z - s.z
  const len = Math.hypot(dx, dz) || 1
  const ux = dx / len, uz = dz / len
  const yaw = Math.atan2(dx, dz) // doorway (+Z local) faces along the path
  const W = 3.2, H = 2.4, D = 3.2
  const hut = new TransformNode('spawnHut', scene)
  hut.position.set(s.x - ux * (D / 2), 0, s.z - uz * (D / 2))
  hut.rotation.y = yaw
  const wood = mat('hutWood', 0.36, 0.27, 0.19)
  const roof = mat('hutRoof', 0.34, 0.2, 0.18) // weathered dark red-brown, not bright red
  const dark = mat('hutDoor', 0.05, 0.05, 0.07)
  const body = MeshBuilder.CreateBox('hutBody', { width: W, height: H, depth: D }, scene)
  body.material = wood; body.position.y = H / 2; body.parent = hut; body.isPickable = false
  // peaked roof: a 4-sided pyramid turned 45° to sit square on the body
  const r = MeshBuilder.CreateCylinder('hutRoofTop', { diameterTop: 0, diameterBottom: W * 1.5, height: 1.6, tessellation: 4 }, scene)
  r.material = roof; r.rotation.y = Math.PI / 4; r.position.y = H + 0.7; r.parent = hut; r.isPickable = false
  // dark doorway on the front (+Z) face that the enemies walk out of
  const door = MeshBuilder.CreateBox('hutDoorPanel', { width: 1.5, height: 1.9, depth: 0.25 }, scene)
  door.material = dark; door.position.set(0, 0.95, D / 2 + 0.02); door.parent = hut; door.isPickable = false
  envProps.push(hut)
  env.addShadowCaster(hut)
}

// build the road, build-cell pads and base for the current level (the green
// 'ground' plane stays as the clean grass surface + aim-pick / collision target)
function buildEnvironment() {
  // road: dirt tiles stepped along each axis-aligned path segment, raised just
  // above the ground plane so they don't z-fight it
  for (let i = 0; i < level.path.length - 1; i++) {
    const a = level.path[i], b = level.path[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(1, Math.round(len / 2.0))
    for (let k = 0; k <= n; k++) {
      const x = a.x + (b.x - a.x) * (k / n), z = a.z + (b.z - a.z) * (k / n)
      placeTile('tile.road', x, z)
    }
  }
  placeTile('tile.spawn', level.spawn.x, level.spawn.z) // mark the entry tile
  buildSpawnHut() // structure enemies emerge from

  pads.clear()
  for (const c of level.cells) {
    // flat square build pad, lifted clear of the ground so it never z-fights/flickers
    const pad = MeshBuilder.CreateBox('cell', { width: 2.0, height: 0.12, depth: 2.0 }, scene)
    pad.position.set(c.pos.x, 0.1, c.pos.z)
    pad.material = padMat; pad.isPickable = false
    envMeshes.push(pad); pads.set(c.id, pad)
  }
  const keep = assets.instance('base.keep')
  keep.position.set(level.base.x, 0, level.base.z)
  keep.getChildMeshes().forEach((m) => (m.isPickable = false))
  env.addShadowCaster(keep)
  envProps.push(keep)

  // scatter decor + obstacles to make the field feel like a real place
  const decor = generateDecor(level, mapIndex)
  for (const p of decor.props) buildProp(p)
  obstacles = decor.obstacles
  heroCtrl.setObstacles(obstacles)
}

let patchTick = 0
function buildProp(p: Prop) {
  const SOLID_KEY: Record<string, string> = { wall: 'prop.wall', rock: 'prop.rock', crate: 'prop.crate', tree: 'prop.tree' }
  const key = SOLID_KEY[p.kind]
  if (key) {
    const node = assets.instance(key)
    node.position.set(p.x, 0, p.z)
    node.rotation.y = p.rot
    const base = node.scaling.x
    node.scaling.set(base * (p.w / 1.5), base * (p.h / 1.5), base * (p.d / 1.5))
    node.getChildMeshes().forEach((m) => { m.isPickable = false })
    env.addShadowCaster(node)
    envProps.push(node)
    return
  }
  if (p.kind === 'bush') {
    const key = p.w > 1.5 ? 'decor.bushLarge' : p.w > 1.0 ? 'decor.bush' : 'decor.bushSmall'
    const node = assets.instance(key)
    node.position.set(p.x, 0, p.z); node.rotation.y = p.rot
    node.getChildMeshes().forEach((m) => (m.isPickable = false))
    env.addShadowCaster(node); envProps.push(node)
  } else if (p.kind === 'mound') {
    const node = assets.instance('decor.grassLarge') // leafy grass clump instead of a squashed sphere
    node.position.set(p.x, 0, p.z); node.rotation.y = p.rot
    node.getChildMeshes().forEach((m) => (m.isPickable = false))
    envProps.push(node)
  } else { // patch — scatter grass tufts / flowers instead of a flat coloured box
    const keys = ['decor.grass', 'decor.flowerRed', 'decor.flowerYellow', 'decor.flowerPurple'] as const
    const node = assets.instance(keys[(patchTick++) % keys.length])
    node.position.set(p.x, 0, p.z); node.rotation.y = p.rot
    node.getChildMeshes().forEach((m) => (m.isPickable = false))
    envProps.push(node)
  }
}

// tear down the current map and load map i (gold/lives carry over via shared GameState)
// per-map fresh budget (no carry-over). Tight gold + many cells = strategy: you
// can't fill/max every pad, so you choose what to build, where, and what to upgrade.
const START_LIVES = 20
const MAP_START_GOLD = (i: number) => 120 + i * 15 // map1 120 ... map10 255
function loadMap(i: number) {
  deselectTower(); hoveredView = null; updateBuildPreview(null) // clear UI selection from the old map
  for (const v of views.values()) { env.removeShadowCaster(v.mesh); v.dispose() } views.clear()
  for (const c of corpses) { env.removeShadowCaster(c.mesh); c.dispose() } corpses.length = 0
  clearHealthBars()
  for (const v of towerViews.values()) { env.removeShadowCaster(v.mesh); v.dispose() } towerViews.clear()
  for (const p of projectiles) killProjectile(p); projectiles.length = 0
  for (const z of zaps) z.mesh.dispose(); zaps.length = 0
  for (const m of envMeshes) m.dispose(); envMeshes = []
  for (const n of envProps) { env.removeShadowCaster(n); n.dispose(false, true) } envProps = []
  mapIndex = i
  level = MAPS[i]
  state.beginMap(MAP_START_GOLD(i), START_LIVES) // fresh gold + lives each map (no carry-over)
  wm = new WaveManager(level.path, WaveManager.mapWaves(i), 1 + i * 0.06) // per-map HP ramp (sim-tuned, see SIM_HP_SCALE)
  tm = new TowerManager(state, level)
  buildEnvironment()
  heroCtrl.pos = { x: level.base.x, y: 0, z: level.base.z - 3 }
  syncHero()
  // frame the camera to this map's size (small maps zoom in, big ±30 maps zoom out)
  const ext = Math.max(...level.path.flatMap((p) => [Math.abs(p.x), Math.abs(p.z)]))
  rig.setFrameRadius(Math.max(42, Math.min(95, ext * 2.8)))
  // size the world to THIS map: ground + island + boundary walls + rim all track
  // the map's extent, so small maps don't float on a giant island and big maps are
  // fully walkable (no walls cutting through the middle).
  const half = Math.max(21, ext + 6)
  const worldScale = half / 40 // base ground is 80 (half 40); island built to match
  ground.scaling.set(worldScale, 1, worldScale)
  island.scaling.set(worldScale, 1, worldScale)
  rebuildBoundary(half)
  rig.playIntro() // short establishing zoom-in on each map load
  selectedKind = null
  awaitStart = true; nextWaveTimer = 0 // first wave of this map waits for Enter
}

bus.on('gameOver', ({ victory }) => {
  if (victory && mapIndex < MAPS.length - 1) { state.nextMap(); loadMap(mapIndex + 1); return }
  over = true; hud.showEnd(victory); showEndButtons(); music.silence()
})
// on death, send the hero back to the base to respawn there
bus.on('heroDied', () => { heroCtrl.pos = { x: level.base.x, y: 0, z: level.base.z - 3 } })

// projectiles: tower and hero shots are GLB models (see fireTowerShot / fireHeroShot);
// only enemy shots are still plain spheres.
const enemyShotMat = new StandardMaterial('shot_enemy', scene)
enemyShotMat.emissiveColor = new Color3(1, 0.25, 0.2); enemyShotMat.diffuseColor = new Color3(1, 0.25, 0.2)

const SHOT_FX: Record<TowerKind, Color3> = {
  cannon: new Color3(1, 0.8, 0.3), slow: new Color3(0.5, 0.8, 1), sniper: new Color3(1, 0.5, 0.4),
  mortar: new Color3(1, 0.55, 0.2), tesla: new Color3(0.7, 0.5, 1),
}
const HERO_SHOT_COLOR = new Color3(0.6, 0.95, 1)
const ENEMY_SHOT_COLOR = new Color3(1, 0.3, 0.25)

// juice controllers: trauma-based screenshake + hitstop on big events
const shake = new Screenshake(2.8) // faster decay: each punch settles quickly so sustained fire/deaths don't pin the camera and blur the field
const hitstop = new Hitstop()
const SHAKE_AMP = 0.28 // peak camera targetScreenOffset; scaled down in third-person

// a projectile homes onto a target enemy (tower shot, damage applied on arrival),
// flies straight and hits enemies (hero shot), or flies straight at the hero (enemy shot).
interface Projectile { mesh: TransformNode; target?: Enemy; dir?: Vector3; ttl: number; damage?: number; slow?: number; vsHero?: boolean; speed?: number; trail?: TrailMesh; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number; arc?: { h: number; d0: number } }
const projectiles: Projectile[] = []
function killProjectile(p: Projectile) { p.trail?.dispose(); p.mesh.dispose(false, true) }
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
const AMMO_KEY: Record<TowerKind, string> = {
  cannon: 'ammo.cannon', sniper: 'ammo.sniper', slow: 'ammo.slow', mortar: 'ammo.mortar', tesla: 'ammo.tesla',
}
function fireTowerShot(from: { x: number; z: number }, target: Enemy, kind: TowerKind, damage: number, slow?: number, splashRadius?: number, chainCount?: number, chainRange?: number, lob?: boolean, pierce?: number) {
  const ball = spawnModelShot(AMMO_KEY[kind], from.x, 1.2, from.z)
  aimProjectile(ball, { x: target.pos.x - from.x, y: 0.8 - 1.2, z: target.pos.z - from.z })
  burst(scene, 'muzzle', from.x, 1.4, from.z, SHOT_FX[kind]) // muzzle puff
  const trail = attachTrail(scene, ball, SHOT_FX[kind])
  sfx.shoot()
  // mortar lobs: a parabolic arc instead of a flat homing shot
  const arc = lob ? { h: Math.max(2, Math.min(5, Math.hypot(target.pos.x - from.x, target.pos.z - from.z) * 0.35)), d0: Math.max(0.5, Math.hypot(target.pos.x - from.x, target.pos.z - from.z)) } : undefined
  projectiles.push({ mesh: ball, target, ttl: 3, damage, slow, trail, splashRadius, chainCount, chainRange, pierce, arc })
}
// actual body radius per enemy kind (capsule radius), for tight hit detection
const ENEMY_RADIUS: Record<EnemyKind, number> = { normal: 0.4, fast: 0.3, tank: 0.7, rogue: 0.35, brute: 0.6, healer: 0.4, boss: 1.1 }
const PROJ_HIT = 0.15 // projectile radius added to the target's radius
function fireHeroShot(from: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, damage: number) {
  const ball = spawnModelShot('ammo.sniper', from.x, from.y, from.z)
  aimProjectile(ball, dir)
  const trail = attachTrail(scene, ball, HERO_SHOT_COLOR)
  // hero shots pierce ALL armor — he's the mobile anti-armor finisher (his niche)
  projectiles.push({ mesh: ball, dir: new Vector3(dir.x, dir.y, dir.z).normalize(), ttl: 1.5, damage, trail, pierce: 999 })
}
// enemy fires a straight (non-homing) shot at where the hero is now — dodge by moving
function fireEnemyShot(from: { x: number; z: number }, heroPos: Vec3, damage: number) {
  const ball = spawnBall(from.x, 0.8, from.z, enemyShotMat, 0.3)
  const d = new Vector3(heroPos.x - from.x, 1.0 - 0.8, heroPos.z - from.z).normalize()
  const trail = attachTrail(scene, ball, ENEMY_SHOT_COLOR)
  projectiles.push({ mesh: ball, dir: d, ttl: 2.5, damage, vsHero: true, speed: ENEMY_SHOT_SPEED, trail })
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
// floating enemy health bars (DOM elements projected above each live enemy)
const healthBars = new Map<Enemy, HTMLDivElement>()
function updateHealthBar(e: Enemy) {
  if (e.hp >= e.maxHp) { const b = healthBars.get(e); if (b) b.style.display = 'none'; return } // only when damaged
  const cam = scene.activeCamera; if (!cam) return
  const w = engine.getRenderWidth(), h = engine.getRenderHeight()
  const p = Vector3.Project(new Vector3(e.pos.x, 2.1, e.pos.z), Matrix.Identity(), scene.getTransformMatrix(), cam.viewport.toGlobal(w, h))
  let bar = healthBars.get(e)
  if (p.z < 0 || p.z > 1) { if (bar) bar.style.display = 'none'; return }
  const rect = canvas.getBoundingClientRect()
  if (!bar) {
    const bw = e.kind === 'boss' ? 80 : e.kind === 'tank' || e.kind === 'brute' ? 48 : 34
    const bh = e.kind === 'boss' ? 8 : 5
    bar = document.createElement('div')
    bar.style.cssText = `position:fixed;width:${bw}px;height:${bh}px;background:#300;border:1px solid #000;` +
      'transform:translate(-50%,-50%);pointer-events:none;z-index:4'
    const fill = document.createElement('div'); fill.style.cssText = 'height:100%;width:100%;background:#3c3'
    bar.appendChild(fill)
    if (e.armor > 0) { // total information: show armor value so the counter is obvious
      const badge = document.createElement('div')
      badge.textContent = `🛡${e.armor}`
      badge.style.cssText = 'position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:4px;' +
        'font:11px monospace;color:#bcd;white-space:nowrap;text-shadow:0 0 3px #000'
      bar.appendChild(badge)
    }
    document.body.appendChild(bar); healthBars.set(e, bar)
  }
  bar.style.display = 'block'
  bar.style.left = `${rect.left + p.x * rect.width / w}px`
  bar.style.top = `${rect.top + p.y * rect.height / h}px`
  const frac = Math.max(0, e.hp / e.maxHp)
  const fill = bar.firstElementChild as HTMLDivElement
  fill.style.width = `${frac * 100}%`
  fill.style.background = frac > 0.5 ? '#3c3' : frac > 0.25 ? '#cc3' : '#c33'
}
function removeHealthBar(e: Enemy) { const b = healthBars.get(e); if (b) { b.remove(); healthBars.delete(e) } }
function clearHealthBars() { for (const b of healthBars.values()) b.remove(); healthBars.clear() }

const HEAVY: Partial<Record<EnemyKind, boolean>> = { tank: true, brute: true, boss: true }
// core damage to one enemy (no sfx) — used by the primary hit and by splash/chain
function damageEnemy(target: Enemy, damage: number, slow?: number, pierce = 0) {
  if (!views.has(target)) return
  target.takeDamage(damage, pierce)
  floatText(target.pos.x, 1.7, target.pos.z, `-${damage} (${target.hp}/${target.maxHp})`, '#ffe27a')
  burst(scene, 'impact', target.pos.x, 1.0, target.pos.z, new Color3(1, 0.9, 0.55))
  shake.addTrauma(0.025) // small per-hit; kept low so sustained fire (tesla chains, mortar splash, 3×) doesn't pin the camera and blur the field. Death/boss punches stay big.
  if (slow) target.applySlow(slow, 1.5)
  if (!target.alive) {
    state.addGold(target.bounty); bus.emit('enemyKilled', { bounty: target.bounty }); sfx.death()
    const v = views.get(target)!; views.delete(target); wm.remove(target); removeHealthBar(target)
    env.removeShadowCaster(v.mesh)
    const heavy = !!HEAVY[target.kind]
    burst(scene, 'death', target.pos.x, 1.0, target.pos.z, new Color3(1, 0.55, 0.3))
    shake.addTrauma(target.kind === 'boss' ? 0.7 : heavy ? 0.4 : 0.15)
    if (heavy) hitstop.trigger(target.kind === 'boss' ? 110 : 70)
    corpses.push(v); v.die(() => { const i = corpses.indexOf(v); if (i >= 0) corpses.splice(i, 1) })
  }
}
// damage applied when a projectile reaches its target; mortar splashes, tesla chains
function applyHit(target: Enemy, damage: number, slow?: number, aoe?: { splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number }) {
  if (!views.has(target)) return
  sfx.hit()
  const cx = target.pos.x, cz = target.pos.z
  damageEnemy(target, damage, slow, aoe?.pierce)
  if (aoe?.splashRadius) { // mortar: full damage to everyone else in the blast
    const r2 = aoe.splashRadius * aoe.splashRadius
    burst(scene, 'death', cx, 0.8, cz, new Color3(1, 0.5, 0.2))
    for (const e of [...views.keys()]) {
      if (e === target) continue
      const dx = e.pos.x - cx, dz = e.pos.z - cz
      if (dx * dx + dz * dz <= r2) damageEnemy(e, damage, undefined, aoe.pierce)
    }
  }
  if (aoe?.chainCount && aoe.chainRange) { // tesla: arc to the nearest few for 60% damage
    const near = [...views.keys()]
      .filter((e) => e !== target && e.alive)
      .map((e) => ({ e, d: Math.hypot(e.pos.x - cx, e.pos.z - cz) }))
      .filter((x) => x.d <= aoe.chainRange!)
      .sort((a, b) => a.d - b.d)
      .slice(0, aoe.chainCount)
    for (const { e } of near) { burst(scene, 'impact', e.pos.x, 1.0, e.pos.z, new Color3(0.7, 0.5, 1)); damageEnemy(e, Math.round(damage * 0.6), undefined, aoe.pierce) }
  }
}
// tesla chain lightning: jagged glowing line between two points, fades fast
interface Zap { mesh: LinesMesh; age: number; ttl: number }
const zaps: Zap[] = []
function zap(a: { x: number; z: number }, b: { x: number; z: number }, color: Color3, y = 1.2) {
  const steps = 6, pts: Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const j = i > 0 && i < steps ? 0.55 : 0
    pts.push(new Vector3(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * 0.5, a.z + (b.z - a.z) * t + (Math.random() - 0.5) * j))
  }
  const m = MeshBuilder.CreateLines('zap', { points: pts }, scene)
  m.color = color; m.isPickable = false
  zaps.push({ mesh: m, age: 0, ttl: 0.12 })
}
function updateZaps(dt: number) {
  for (let i = zaps.length - 1; i >= 0; i--) {
    const z = zaps[i]; z.age += dt
    if (z.age >= z.ttl) { z.mesh.dispose(); zaps.splice(i, 1); continue }
    z.mesh.alpha = 1 - z.age / z.ttl
  }
}
// the nearest live enemies to `origin` within `range`, up to `count` (for tesla arcs)
function chainTargets(origin: { x: number; z: number }, count: number, range: number, exclude: Enemy): Enemy[] {
  return [...views.keys()]
    .filter((e) => e !== exclude && e.alive)
    .map((e) => ({ e, d: Math.hypot(e.pos.x - origin.x, e.pos.z - origin.z) }))
    .filter((x) => x.d <= range)
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.e)
}

function updateProjectiles(dt: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    p.ttl -= dt
    if (p.ttl <= 0) { killProjectile(p); projectiles.splice(i, 1); continue }
    const step = (p.speed ?? SHOT_SPEED) * dt
    if (p.target && p.arc) {
      // mortar lob: home horizontally, height follows a parabola
      const dx = p.target.pos.x - p.mesh.position.x, dz = p.target.pos.z - p.mesh.position.z
      const horiz = Math.hypot(dx, dz)
      if (horiz <= step) {
        if (p.damage != null) applyHit(p.target, p.damage, p.slow, { splashRadius: p.splashRadius, pierce: p.pierce })
        killProjectile(p); projectiles.splice(i, 1); continue
      }
      const nx = p.mesh.position.x + dx / horiz * step, nz = p.mesh.position.z + dz / horiz * step
      const prog = Math.max(0, Math.min(1, 1 - horiz / p.arc.d0))
      p.mesh.position.set(nx, 0.6 + p.arc.h * Math.sin(prog * Math.PI), nz)
      p.mesh.rotation.x += dt * 6 // tumble the boulder
    } else if (p.target) {
      const tgt = new Vector3(p.target.pos.x, 0.8, p.target.pos.z) // follow the moving target
      const dir = tgt.subtract(p.mesh.position)
      aimProjectile(p.mesh, dir) // keep the model's nose on the (moving) target
      if (dir.length() <= step) { // arrived — deal damage now
        if (p.damage != null) applyHit(p.target, p.damage, p.slow, { splashRadius: p.splashRadius, chainCount: p.chainCount, chainRange: p.chainRange, pierce: p.pierce })
        killProjectile(p); projectiles.splice(i, 1); continue
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
          heroState.takeDamage(p.damage ?? 0); sfx.heroHurt()
          floatText(heroCtrl.pos.x, 2.0, heroCtrl.pos.z, `-${p.damage}`, '#ff6b6b')
          killProjectile(p); projectiles.splice(i, 1); continue
        }
      } else if (p.damage != null) {
        // hero ballistic shot vs enemies — hit by the enemy's actual body (radius + height)
        for (const e of views.keys()) {
          const ep = e.pos
          const r = ENEMY_RADIUS[e.kind] + PROJ_HIT
          const hdx = ep.x - pp.x, hdz = ep.z - pp.z
          if (hdx * hdx + hdz * hdz < r * r && Math.abs(pp.y - 0.8) < 0.95) {
            applyHit(e, p.damage, undefined, { pierce: p.pierce }); killProjectile(p); projectiles.splice(i, 1); break
          }
        }
      }
    }
    // walls and other solid props stop projectiles (no damage)
    if (projectiles[i] === p && inObstacle(p.mesh.position.x, p.mesh.position.z)) {
      killProjectile(p); projectiles.splice(i, 1)
    }
  }
}

// hero shot handling: spawn its visible projectile; damage lands on arrival (applyHit)
function processHeroShot(shot: HeroShot | null) {
  if (!shot) return
  heroAttackAnim()
  sfx.shoot()
  burst(scene, 'muzzle', shot.from.x, shot.from.y, shot.from.z, HERO_SHOT_COLOR)
  shake.addTrauma(0.15) // recoil kick
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

// auto-advance waves: a countdown runs during build phase; Enter starts immediately.
// The FIRST wave of each map waits for an explicit Enter (awaitStart) — no auto-timer —
// so the player always gets time to place towers before the map begins.
let nextWaveTimer = 0
let awaitStart = true // first wave of the current map; cleared on the first startNextWave
// the keep defends itself: auto-fires at the nearest enemy in range (covers the
// gap while the hero is respawning, and adds a last line of defence)
const BASE_RANGE = 6, BASE_DMG = 5, BASE_RATE = 1 // keep: short last-ditch line (was 12/8 — covered whole small maps)
let baseFireTimer = 0
function startNextWave() {
  if (!started || over || state.phase !== 'build') return
  awaitStart = false // first explicit start clears the manual gate
  if (nextWaveTimer > 0) { // reward starting early: 1 gold per second skipped
    const bonus = Math.ceil(nextWaveTimer)
    state.addGold(bonus); flash(`+${bonus}з за ранний старт`)
  }
  state.startWave(); wm.startWave(state.wave - 1); nextWaveTimer = -1; sfx.waveStart(); music.setState('tense')
}

// input: Tab toggle, Enter start wave now
addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault(); rig.toggle()
    hud.setCrosshair(false); buildMenu.setVisible(rig.mode === 'top')
    syncRotBar() // rotate buttons only make sense top-down
    env.setDofEnabled(rig.mode === 'top' && resolveQuality(quality).dof) // toy-diorama DOF top-down only
  }
  if (e.key === 'Enter') startNextWave()
  if (e.key === 'Escape' && selectedKind) { selectedKind = null; buildMenu.disarm(); deselectTower(); updatePadVisuals(); refreshBuildBanner() }
  if (e.key === ' ') { e.preventDefault(); speed.togglePause(); hud.update() } // Space = pause
  if (e.key === 'm' || e.key === 'M' || e.key === 'ь') audio.toggleMute() // mute toggle
  // Q/E rotate the fixed-iso camera between its 4 preset corners (quality lives in the gear panel now)
  if (e.key === 'q' || e.key === 'Q' || e.key === 'й') rig.rotatePreset(-1)
  if (e.key === 'e' || e.key === 'E' || e.key === 'у') rig.rotatePreset(1)
})

// build / upgrade on click in top mode
// --- tower selection + hover rings + build-range preview (P4 readability) ---
let selectedTower: Tower | null = null
let hoveredView: TowerView | null = null
function refreshRings() { for (const [t, v] of towerViews) v.setRingVisible(t === selectedTower || v === hoveredView) }
function refreshTowerPanel() {
  if (!selectedTower) { towerPanel.hide(); return }
  const t = selectedTower, s = t.stats, defs = TOWER_DEFS[t.kind]
  const upgradeCost = t.level < defs.length - 1 ? defs[t.level + 1].cost : null
  towerPanel.show(
    { kind: t.kind, level: t.level, maxLevel: t.maxLevel, damage: s.damage, range: s.range, fireRate: s.fireRate, slow: s.slow, pierce: s.pierce, targetMode: t.targetMode, upgradeCost, sellValue: tm.sellValue(t) },
    () => { if (tm.upgrade(t)) { towerViews.get(t)?.sync(); refreshTowerPanel() } else { flash('Не хватает золота'); sfx.deny() } },
    () => {
      tm.sell(t); const v = towerViews.get(t)
      if (v) { env.removeShadowCaster(v.mesh); v.dispose(); towerViews.delete(t) }
      selectedTower = null; towerPanel.hide(); refreshRings(); sfx.build(); updatePadVisuals()
    },
    () => { t.cycleTargetMode(); refreshTowerPanel() },
  )
}
function selectTower(t: Tower) { selectedTower = t; refreshRings(); refreshTowerPanel() }
function deselectTower() { selectedTower = null; towerPanel.hide(); refreshRings() }

// translucent ring that previews the selected tower kind's range at the hovered cell
let previewRing: Mesh | null = null
const previewMat = new StandardMaterial('previewRing', scene)
previewMat.emissiveColor = new Color3(0.6, 0.9, 1); previewMat.disableLighting = true; previewMat.alpha = 0.5
function updateBuildPreview(point: { x: number; z: number } | null) {
  const cell = selectedKind && point ? level.cellAt(point.x, point.z, 2) : undefined
  if (!cell || cell.occupied) { if (previewRing) previewRing.isVisible = false; return }
  if (!previewRing) {
    previewRing = MeshBuilder.CreateTorus('previewRing', { diameter: 2, thickness: 0.08, tessellation: 48 }, scene)
    previewRing.material = previewMat; previewRing.isPickable = false
  }
  const r = TOWER_DEFS[selectedKind!][0].range
  previewRing.position.set(cell.pos.x, 0.12, cell.pos.z)
  previewRing.scaling.set(r, 1, r)
  previewRing.isVisible = true
}

function towerAt(pick: { pickedMesh: unknown } | null | undefined): Tower | null {
  if (!pick?.pickedMesh) return null
  const hit = [...towerViews].find(([, v]) => { let n = pick.pickedMesh as any; while (n) { if (n === v.mesh) return true; n = n.parent } return false })
  return hit?.[0] ?? null
}

scene.onPointerMove = (_evt, pick) => {
  if (rig.mode !== 'top') return
  const t = towerAt(pick)
  hoveredView = t ? towerViews.get(t) ?? null : null
  refreshRings()
  updateBuildPreview(pick?.pickedPoint ?? null)
}

scene.onPointerDown = (evt, pick) => {
  if (rig.mode !== 'top' || over) return
  if (!pick?.pickedPoint) return
  const clicked = towerAt(pick)
  if (clicked) { selectTower(clicked); return } // select -> panel shows upgrade/sell
  if (selectedKind) {
    const cell = level.cellAt(pick.pickedPoint.x, pick.pickedPoint.z, 2)
    if (!cell) { deselectTower(); return }
    if (cell.occupied) { flash('Клетка занята'); sfx.deny(); return }
    const t = tm.build(selectedKind, cell)
    if (t) {
      towerViews.set(t, new TowerView(scene, assets, t, towerHooks)); sfx.build()
      selectTower(t) // focus jumps to the new tower (panel shows its upgrade/sell)
      if (!(evt as PointerEvent)?.shiftKey) { selectedKind = null; buildMenu.disarm() } // one-shot; Shift keeps arming
      updatePadVisuals(); refreshBuildBanner()
    } else { flash('Не хватает золота'); sfx.deny() }
    return
  }
  if (selectedTower) { deselectTower(); return } // click away to deselect
  heroCtrl.triggerFire() // otherwise the hero shoots toward the click
}
// right-click cancels an armed build
scene.onPointerObservable.add((info) => {
  if (info.type === PointerEventTypes.POINTERDOWN && (info.event as PointerEvent).button === 2 && selectedKind) {
    selectedKind = null; buildMenu.disarm(); updatePadVisuals(); refreshBuildBanner()
  }
})

scene.onBeforeRenderObservable.add(() => {
  // real time drives FX (shake/particles); sim dt is frozen to 0 during a hitstop
  const realDt = engine.getDeltaTime() / 1000
  rig.update(realDt) // ease the top camera toward its preset angle / intro radius
  sky.update(realDt) // drift the clouds
  const simScale = hitstop.update(realDt * 1000)
  const dt = realDt * simScale * speed.scale // pause (0) / 1×/2×/3× scale the sim; FX stay real-time
  heroState.tick(dt)
  heroCtrl.setActive(heroState.alive && !speed.paused) // dead OR paused -> no move/aim/shoot
  updateProjectiles(dt)
  updateZaps(realDt)
  if (!over && state.phase === 'wave') {
    for (const e of wm.update(dt)) { const v = new EnemyView(scene, assets, e); env.addShadowCaster(v.mesh); views.set(e, v) }
    for (const e of [...wm.active]) {
      e.update(dt)
      if (e.reachedBase) { state.damageBase(e.leak); shake.addTrauma(0.5); hitstop.trigger(80); removeHealthBar(e); const rv = views.get(e); if (rv) { env.removeShadowCaster(rv.mesh); rv.dispose() } views.delete(e); wm.remove(e); continue }
      views.get(e)?.sync()
      updateHealthBar(e)
      const atk = e.attack(dt, heroCtrl.pos) // returns damage when in range + off cooldown
      if (atk != null && heroState.alive) fireEnemyShot(e.pos, heroCtrl.pos, atk)
      const pulse = e.healPulse(dt) // healer: top up nearby wounded allies
      if (pulse) for (const o of wm.active) {
        if (o === e || !o.alive || o.hp >= o.maxHp) continue
        if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) <= pulse.range) { o.heal(pulse.amount); floatText(o.pos.x, 1.9, o.pos.z, `+${pulse.amount}`, '#7dff7d') }
      }
    }
    for (const shot of tm.update(dt, wm.active)) {
      if (shot.aura) { // slow field: slow every enemy in range this tick, no projectile
        for (const e of wm.active) {
          if (e.alive && Math.hypot(e.pos.x - shot.from.x, e.pos.z - shot.from.z) <= shot.aura.range) e.applySlow(shot.aura.slow, 0.3)
        }
        continue
      }
      const target = shot.target!, damage = shot.damage!
      const firing = [...towerViews.keys()].find((t) => t.pos === shot.from)
      const kind = firing?.kind ?? 'cannon'
      if (kind === 'tesla') {
        // instant chain lightning: bolt tower -> target -> nearest others
        sfx.shoot()
        zap(shot.from, target.pos, SHOT_FX.tesla, 1.4)
        damageEnemy(target, damage)
        let prev = { x: target.pos.x, z: target.pos.z }
        for (const e of chainTargets(target.pos, shot.chainCount ?? 0, shot.chainRange ?? 0, target)) {
          zap(prev, e.pos, SHOT_FX.tesla, 1.2); damageEnemy(e, Math.round(damage * 0.6)); prev = { x: e.pos.x, z: e.pos.z }
        }
      } else if (kind === 'mortar') {
        fireTowerShot(shot.from, target, kind, damage, shot.slow, shot.splashRadius, undefined, undefined, true, shot.pierce) // lobbed
      } else {
        fireTowerShot(shot.from, target, kind, damage, shot.slow, shot.splashRadius, shot.chainCount, shot.chainRange, false, shot.pierce)
      }
      if (firing) towerViews.get(firing)?.kickback() // recoil pulse
    }
    for (const [t, v] of towerViews) v.applyYaw(t.yaw) // rotate barrels toward their targets
    // keep auto-fire: shoot the nearest enemy within range
    baseFireTimer -= dt
    if (baseFireTimer <= 0) {
      let nearest: Enemy | undefined, nd = BASE_RANGE
      for (const e of views.keys()) {
        const d = Math.hypot(e.pos.x - level.base.x, e.pos.z - level.base.z)
        if (d < nd) { nd = d; nearest = e }
      }
      if (nearest) { fireTowerShot(level.base, nearest, 'sniper', BASE_DMG); baseFireTimer = 1 / BASE_RATE }
    }
    processHeroShot(heroCtrl.update(dt))
    if (wm.cleared()) {
      state.addGold(12 + state.wave * 2); state.endWave()
      const phaseAfter: string = state.phase
      if (phaseAfter === 'build') { nextWaveTimer = 5; music.setState('calm') } // breather before next wave
    }
  } else {
    processHeroShot(heroCtrl.update(dt))
    // first wave of the map (awaitStart) never auto-starts — only Enter begins it
    if (started && !over && state.phase === 'build' && !awaitStart && nextWaveTimer > 0) {
      nextWaveTimer -= dt
      if (nextWaveTimer <= 0) startNextWave()
    }
  }
  syncHero()
  // apply screenshake to the active camera (third-person shakes softer to avoid nausea)
  const off = shake.step(realDt, rig.mode === 'hero' ? SHAKE_AMP * 0.4 : SHAKE_AMP)
  const activeCam = scene.activeCamera as { targetScreenOffset?: { set(x: number, y: number): void } } | null
  activeCam?.targetScreenOffset?.set(off.x, off.y)
  mapInfo.textContent = `Карта ${mapIndex + 1}/${MAPS.length}`
  const showPreview = !over && state.phase === 'build' && (awaitStart || nextWaveTimer > 0)
  // Infinity countdown tells the HUD to show "press Enter" instead of a ticking timer
  hud.setWavePreview(showPreview ? wm.peek(state.wave).map((g) => ({ kind: g.kind, count: g.count })) : null, state.wave + 1, awaitStart ? Infinity : nextWaveTimer)
  hud.update()
})

// map indicator (top center)
const mapInfo = document.createElement('div')
mapInfo.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);color:#fff;font-family:monospace;font-size:16px;text-shadow:0 0 4px #000;pointer-events:none'
document.body.appendChild(mapInfo)

// controls + cost legend
const legend = document.createElement('div')
legend.style.cssText = 'position:fixed;top:8px;right:8px;color:#fff;font-family:monospace;font-size:13px;line-height:1.5;text-align:right;text-shadow:0 0 3px #000;pointer-events:none'
legend.innerHTML =
  `выбери башню → клик по клетке — строить<br>клик по башне — инфо · улучшить · продать<br>` +
  `без выбора: клик = выстрел героя · WASD — бег<br>` +
  `Space — пауза · 1/2/3× — скорость · Enter — волна<br>Tab — вид · Q/E — поворот · M — звук`
document.body.appendChild(legend)

// camera rotate buttons (top-down only)
const rotBar = document.createElement('div')
rotBar.style.cssText = 'position:fixed;left:8px;bottom:60px;display:flex;gap:6px;z-index:6'
for (const [label, dir] of [['⟲', -1], ['⟳', 1]] as const) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = 'font-family:monospace;font-size:18px;width:38px;height:38px;cursor:pointer;' +
    'border:2px solid #ffd24d;background:#1b2330;color:#ffd24d;border-radius:6px'
  b.onclick = () => rig.rotatePreset(dir)
  rotBar.appendChild(b)
}
document.body.appendChild(rotBar)
// hide rotate buttons in third-person (called from the Tab handler)
function syncRotBar() { rotBar.style.display = rig.mode === 'top' ? 'flex' : 'none' }

// --- front-end menus (title screen + restart) ---
function menuButton(label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = 'font-family:monospace;font-size:20px;padding:10px 30px;cursor:pointer;' +
    'border:2px solid #ffd24d;background:#1b2330;color:#ffd24d;border-radius:6px'
  return b
}
function showTitle() {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:20px;background:rgba(16,20,28,0.93);z-index:60;font-family:monospace;color:#fff'
  const title = document.createElement('div')
  title.textContent = 'TOWER DEFENCE'
  title.style.cssText = 'font-size:48px;font-weight:bold;letter-spacing:4px;color:#ffd24d;text-shadow:0 0 14px #000'
  const sub = document.createElement('div')
  sub.textContent = 'Защити крепость · WASD — бег · Tab — вид · клик — строить/стрелять · M — звук'
  sub.style.cssText = 'font-size:15px;opacity:0.85;text-align:center;max-width:640px'
  const play = menuButton('Играть')
  play.onclick = () => { started = true; ov.remove(); audio.unlock(); music.start(); music.setState('calm'); sfx.waveStart() } // first gesture unlocks audio + starts music
  ov.append(title, sub, play)
  document.body.appendChild(ov)
}
// add Restart / Next-map buttons onto the end screen
function showEndButtons() {
  const host = document.getElementById('endscreen')
  if (!host || host.querySelector('button')) return
  host.style.flexDirection = 'column'
  const restart = menuButton('Заново')
  restart.style.marginTop = '24px'
  restart.onclick = () => location.reload()
  host.appendChild(restart)
}

async function boot() {
  const overlay = showLoading()
  await assets.preload(scene)
  overlay.remove()
  makeHero()
  loadMap(0)
  engine.runRenderLoop(() => scene.render())
  addEventListener('resize', () => engine.resize())
  buildMenu.setVisible(true)
  showTitle()
}
boot()
