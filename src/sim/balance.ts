// Headless 2-D balance simulator. Reuses the REAL map geometry (Level.maps) and
// the proposed numbers (config.ts), runs a faithful tower-vs-wave combat loop
// (no rendering, no hero — tower-centric worst case), and reports whether the
// numbers produce a "tight but winnable" curve with no dominant tower.
//
// Simplifications (all conservative or neutral, noted so results are trusted):
//  - towers aim instantly (no barrel-turn delay) -> slight DPS overestimate.
//  - hero excluded -> towers must hold alone (worst case for the player).
//  - targeting = "first" (enemy furthest along the path / closest to base).
import { Vec3, dist } from '../core/Vec3'
import { PathFollower } from '../world/PathFollower'
import { Level } from '../world/Level'
import { TowerKind } from '../towers/TowerTypes'
import { EnemyKind } from '../enemies/EnemyTypes'
import { WaveManager } from '../enemies/WaveManager'
import { SIM_TOWERS, SIM_ENEMIES, SIM_ECONOMY, SIM_BASE, SIM_HERO, SimTowerLevel } from './config'

// ---- pure helpers (unit-tested) -------------------------------------------

/** Flat-armor damage model: armor subtracts per hit, pierce ignores armor, min 1. */
export function effectiveDamage(raw: number, armor: number, pierce = 0): number {
  return Math.max(1, raw - Math.max(0, armor - pierce))
}

/** Single-target sustained DPS of a tower level vs an enemy of given armor. */
export function singleDps(t: SimTowerLevel, armor: number): number {
  return effectiveDamage(t.damage, armor, t.pierce ?? 0) * t.fireRate
}

/** dense samples along the path polyline (for coverage scoring) */
export function pathSamples(path: Vec3[], step = 0.5): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const d = dist(a, b), n = Math.max(1, Math.ceil(d / step))
    for (let k = 0; k < n; k++) {
      const u = k / n
      out.push({ x: a.x + (b.x - a.x) * u, y: 0, z: a.z + (b.z - a.z) * u })
    }
  }
  out.push(path[path.length - 1])
  return out
}

/** how many path samples a cell covers at a given range (placement quality) */
export function coverage(cellPos: Vec3, range: number, samples: Vec3[]): number {
  let c = 0
  for (const s of samples) if (dist(cellPos, s) <= range) c++
  return c
}

// ---- sim entities ----------------------------------------------------------

class SimEnemy {
  private f: PathFollower
  hp: number; readonly maxHp: number; readonly armor: number
  readonly bounty: number; readonly leak: number; readonly kind: EnemyKind
  traveled = 0
  private slowFactor = 1; private slowTimer = 0
  private heal?: { amount: number; range: number; rate: number }
  private healCd = 0
  constructor(kind: EnemyKind, path: Vec3[]) {
    const d = SIM_ENEMIES[kind]
    this.f = new PathFollower(path, d.speed)
    this.hp = d.hp; this.maxHp = d.hp; this.armor = d.armor
    this.bounty = d.bounty; this.leak = d.leak; this.kind = kind
    this.heal = d.heal; this.healCd = d.heal ? 1 / d.heal.rate : 0
  }
  get pos(): Vec3 { return this.f.pos }
  get alive(): boolean { return this.hp > 0 && !this.f.done }
  get reachedBase(): boolean { return this.f.done && this.hp > 0 }
  applySlow(factor: number, dur: number) { this.slowFactor = Math.min(this.slowFactor, factor); this.slowTimer = Math.max(this.slowTimer, dur) }
  takeDamage(n: number, pierce = 0) { this.hp = Math.max(0, this.hp - effectiveDamage(n, this.armor, pierce)) }
  step(dt: number) {
    const eff = this.slowFactor
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1 }
    const before = this.f.pos
    this.f.advance(dt * eff)
    this.traveled += dist(before, this.f.pos)
  }
  healPulse(dt: number): { amount: number; range: number } | null {
    if (!this.heal || !this.alive) return null
    this.healCd -= dt
    if (this.healCd > 0) return null
    this.healCd += 1 / this.heal.rate
    return { amount: this.heal.amount, range: this.heal.range }
  }
  healBy(n: number) { if (this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + n) }
}

interface SimTower { kind: TowerKind; level: number; pos: Vec3; cooldown: number }

function towerStats(t: SimTower): SimTowerLevel { return SIM_TOWERS[t.kind][t.level] }

/** target = enemy furthest along the path ("first"), within range */
function pickFirst(pos: Vec3, range: number, enemies: SimEnemy[]): SimEnemy | null {
  let best: SimEnemy | null = null
  for (const e of enemies) {
    if (!e.alive) continue
    if (dist(e.pos, pos) > range) continue
    if (!best || e.traveled > best.traveled) best = e
  }
  return best
}

/** one tower's action this tick; mutates enemies. Returns nothing. */
function fireTower(t: SimTower, dt: number, enemies: SimEnemy[]) {
  const s = towerStats(t)
  if (s.aura) { // slow tower: persistent field, re-applied each tick
    // NB: aura DoT must NOT use the min-1 per-hit floor (it would turn 0 dmg into
    // 1/tick = a huge blanket). Subtract raw, ignore armor (tiny), floor at 0.
    for (const e of enemies) if (e.alive && dist(e.pos, t.pos) <= s.range) {
      e.applySlow(s.slow!, 0.3)
      if (s.damage > 0) e.hp = Math.max(0, e.hp - s.damage * dt)
    }
    return
  }
  t.cooldown -= dt
  if (t.cooldown > 0) return
  const target = pickFirst(t.pos, s.range, enemies)
  if (!target) return
  t.cooldown = 1 / s.fireRate
  target.takeDamage(s.damage, s.pierce ?? 0)
  if (s.splashRadius) { // mortar: full damage to others in blast
    for (const e of enemies) if (e !== target && e.alive && dist(e.pos, target.pos) <= s.splashRadius) e.takeDamage(s.damage)
  }
  if (s.chainCount && s.chainRange) { // tesla: arc to nearest few for 60%
    const near = enemies.filter((e) => e !== target && e.alive && dist(e.pos, target.pos) <= s.chainRange!)
      .sort((a, b) => dist(a.pos, target.pos) - dist(b.pos, target.pos)).slice(0, s.chainCount)
    for (const e of near) e.takeDamage(s.damage * 0.6)
  }
}

function fireBase(cooldownRef: { c: number }, base: Vec3, dt: number, enemies: SimEnemy[]) {
  cooldownRef.c -= dt
  if (cooldownRef.c > 0) return
  const target = pickFirst(base, SIM_BASE.range, enemies)
  if (!target) return
  cooldownRef.c = 1 / SIM_BASE.fireRate
  target.takeDamage(SIM_BASE.damage, SIM_BASE.pierce)
}

// ---- wave runner ------------------------------------------------------------

export interface WaveResult { leaks: number; livesLost: number; bountyEarned: number; kills: number; durationS: number }

/** run a single wave to completion; mutates lives via return. dt fixed step. */
export function runWave(path: Vec3[], towers: SimTower[], wave: { kind: EnemyKind; count: number; interval: number }[], dt = 0.05, hero = false): WaveResult {
  // build spawn schedule
  const queue = wave.map((g) => ({ kind: g.kind, interval: g.interval, remaining: g.count, timer: 0 }))
  const enemies: SimEnemy[] = []
  const baseCd = { c: 0 }
  const heroCd = { c: 0 }
  const base = path[path.length - 1]
  // hero "stands" mid-path (covers the most lane); free, always firing at first
  const heroPos = path[Math.floor(path.length / 2)]
  for (const t of towers) t.cooldown = 0
  let leaks = 0, livesLost = 0, bountyEarned = 0, kills = 0, time = 0
  const MAX = 400 // s safety cap (raised; slowed enemies take longer to cross)
  while (time < MAX) {
    // spawn
    for (const g of queue) {
      g.timer -= dt
      while (g.remaining > 0 && g.timer <= 0) { enemies.push(new SimEnemy(g.kind, path)); g.remaining -= 1; g.timer += g.interval }
    }
    // healers
    for (const h of enemies) {
      const p = h.healPulse(dt)
      if (p) for (const e of enemies) if (e !== h && e.alive && dist(e.pos, h.pos) <= p.range) e.healBy(p.amount)
    }
    // towers + base fire
    for (const t of towers) fireTower(t, dt, enemies)
    fireBase(baseCd, base, dt, enemies)
    if (hero) { // hero shooter: 100 dps single-target, generous reach
      heroCd.c -= dt
      if (heroCd.c <= 0) {
        const tgt = pickFirst(heroPos, SIM_HERO.range, enemies)
        if (tgt) { heroCd.c = 1 / SIM_HERO.fireRate; tgt.takeDamage(SIM_HERO.damage, SIM_HERO.pierce) }
      }
    }
    // move + resolve deaths / leaks
    for (const e of enemies) {
      if (!e.alive && e.hp <= 0 && !(e as any)._counted) { (e as any)._counted = true; bountyEarned += e.bounty; kills++ }
      e.step(dt)
      if (e.reachedBase && !(e as any)._leaked) { (e as any)._leaked = true; leaks++; livesLost += e.leak }
    }
    // remove dead/leaked
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].hp <= 0 || enemies[i].reachedBase) enemies.splice(i, 1)
    const queueEmpty = queue.every((g) => g.remaining <= 0)
    if (queueEmpty && enemies.length === 0) break
    time += dt
  }
  // hit the time cap with enemies still alive: they never died, so they count as
  // leaks (a stalled wave = enemies that WOULD eventually get through).
  const queueLeft = queue.reduce((s, g) => s + Math.max(0, g.remaining), 0)
  for (const e of enemies) if (e.alive) { leaks++; livesLost += e.leak }
  leaks += queueLeft; livesLost += queueLeft // unspawned stragglers, worst case
  return { leaks, livesLost, bountyEarned, kills, durationS: time }
}

// ---- player strategies ------------------------------------------------------

export type Strategy = (ctx: BuildCtx) => void
export interface BuildCtx {
  gold: number
  cells: { pos: Vec3; occupied: boolean; tower?: SimTower }[]
  towers: SimTower[]
  samples: Vec3[]
  spend: (n: number) => boolean
}

function bestEmptyCell(ctx: BuildCtx, range: number): BuildCtx['cells'][number] | undefined {
  return ctx.cells.filter((c) => !c.occupied)
    .sort((a, b) => coverage(b.pos, range, ctx.samples) - coverage(a.pos, range, ctx.samples))[0]
}
function place(ctx: BuildCtx, kind: TowerKind): boolean {
  const cost = SIM_TOWERS[kind][0].cost
  const cell = bestEmptyCell(ctx, SIM_TOWERS[kind][0].range)
  if (!cell || ctx.gold < cost || !ctx.spend(cost)) return false
  const t: SimTower = { kind, level: 0, pos: cell.pos, cooldown: 0 }
  cell.occupied = true; cell.tower = t; ctx.towers.push(t); return true
}
function upgradeBest(ctx: BuildCtx): boolean {
  const up = ctx.towers.filter((t) => t.level < SIM_TOWERS[t.kind].length - 1)
    .sort((a, b) => SIM_TOWERS[a.kind][a.level + 1].cost - SIM_TOWERS[b.kind][b.level + 1].cost)[0]
  if (!up) return false
  const cost = SIM_TOWERS[up.kind][up.level + 1].cost
  if (ctx.gold < cost || !ctx.spend(cost)) return false
  up.level += 1; return true
}

/** only ever builds/upgrades one kind — used to probe for a dominant tower. */
export function monoStrategy(kind: TowerKind): Strategy {
  return (ctx) => { let guard = 50; while (guard-- > 0) { if (place(ctx, kind)) continue; if (upgradeBest(ctx)) continue; break } }
}

/** skilled play: cover armor (sniper), swarm (tesla+mortar), a slow, rest cannons; then upgrade. */
export const mixedStrategy: Strategy = (ctx) => {
  const has = (k: TowerKind) => ctx.towers.some((t) => t.kind === k)
  let guard = 60
  while (guard-- > 0) {
    if (!has('sniper') && place(ctx, 'sniper')) continue
    if (!has('tesla') && place(ctx, 'tesla')) continue
    if (!has('mortar') && place(ctx, 'mortar')) continue
    if (!has('slow') && place(ctx, 'slow')) continue
    // alternate: upgrade something cheap, else add a cannon
    if (ctx.gold > 120 && upgradeBest(ctx)) continue
    if (place(ctx, 'cannon')) continue
    if (upgradeBest(ctx)) continue
    break
  }
}

// ---- full map run -----------------------------------------------------------

export interface MapRun { mapIndex: number; strategy: string; won: boolean; livesLeft: number; waves: { wave: number; livesLost: number; goldAfter: number }[] }

export function runMap(mapIndex: number, level: Level, strategyName: string, strategy: Strategy, hero = false): MapRun {
  const waves = WaveManager.mapWaves(mapIndex)
  const samples = pathSamples(level.path)
  const cells = level.cells.map((c) => ({ pos: c.pos, occupied: false } as BuildCtx['cells'][number]))
  const towers: SimTower[] = []
  let gold = SIM_ECONOMY.startGold, lives = SIM_ECONOMY.startLives
  const log: MapRun['waves'] = []
  for (let i = 0; i < waves.length; i++) {
    // build phase
    const ctx: BuildCtx = { get gold() { return gold }, cells, towers, samples, spend: (n) => { if (n > gold) return false; gold -= n; return true } }
    strategy(ctx)
    // run wave
    const res = runWave(level.path, towers, waves[i].map((g) => ({ kind: g.kind, count: g.count, interval: g.interval })), 0.05, hero)
    gold += res.bountyEarned + SIM_ECONOMY.waveClear(i + 1)
    lives -= res.livesLost
    log.push({ wave: i + 1, livesLost: res.livesLost, goldAfter: gold })
    if (lives <= 0) return { mapIndex, strategy: strategyName, won: false, livesLeft: 0, waves: log }
  }
  return { mapIndex, strategy: strategyName, won: true, livesLeft: lives, waves: log }
}
