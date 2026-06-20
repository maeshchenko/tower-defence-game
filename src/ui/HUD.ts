import { GameState } from '../core/GameState'
import { HeroState } from '../hero/HeroState'
import { Speed } from './Speed'
import { EnemyKind } from '../enemies/EnemyTypes'

const ACCENT = '#ffd24d'
const PANEL = 'background:rgba(16,20,28,0.82);border:1px solid #2a3344;border-radius:8px;'
const ENEMY_ICON: Record<EnemyKind, string> = { normal: '🪖', fast: '🏃', tank: '🛡️', rogue: '🗡️', brute: '🪓', healer: '➕', boss: '💀' }
const ENEMY_LABEL: Record<EnemyKind, string> = { normal: 'обычные', fast: 'быстрые', tank: 'танки', rogue: 'разбойники', brute: 'громилы', healer: 'лекари', boss: 'БОСС' }

// HUD owns the stats card, the pause/speed bar and the next-wave preview. It reads
// GameState/HeroState/Speed each frame; the speed buttons drive the Speed controller.
export class HUD {
  private cross!: HTMLElement
  private end!: HTMLElement
  private stats!: HTMLDivElement
  private speedBar!: HTMLDivElement
  private preview!: HTMLDivElement
  private pauseTag!: HTMLDivElement
  private speedBtns: Record<string, HTMLButtonElement> = {}

  constructor(private state: GameState, private hero: HeroState, private speed: Speed) {}

  mount() {
    this.cross = document.getElementById('crosshair')!
    this.cross.style.display = 'none'
    this.end = document.getElementById('endscreen')!

    // stats card (top-left), replacing the old plain text in #hud
    const host = document.getElementById('hud')!
    host.style.cssText = 'position:fixed;top:8px;left:8px;font-family:monospace;z-index:6'
    this.stats = document.createElement('div')
    this.stats.style.cssText = PANEL + 'padding:10px 14px;color:#fff;font-size:15px;line-height:1.7;min-width:150px'
    host.appendChild(this.stats)

    // speed / pause bar (bottom-left)
    this.speedBar = document.createElement('div')
    this.speedBar.style.cssText = 'position:fixed;bottom:12px;left:12px;display:flex;gap:6px;' +
      'font-family:monospace;z-index:6;' + PANEL + 'padding:6px'
    for (const [key, label] of [['pause', '⏸'], ['1', '1×'], ['2', '2×'], ['3', '3×']] as const) {
      const b = document.createElement('button')
      b.textContent = label
      b.style.cssText = 'font-family:monospace;font-size:15px;min-width:38px;padding:6px 4px;cursor:pointer;' +
        'border:1px solid #3a4860;background:#1b2330;color:#cfe;border-radius:5px'
      b.onclick = () => { key === 'pause' ? this.speed.togglePause() : this.speed.setMultiplier(Number(key)); this.update() }
      this.speedBtns[key] = b
      this.speedBar.appendChild(b)
    }
    document.body.appendChild(this.speedBar)

    // next-wave preview (top center, build phase only)
    this.preview = document.createElement('div')
    this.preview.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);' +
      'font-family:monospace;font-size:14px;color:#fff;z-index:6;display:none;' + PANEL + 'padding:8px 14px;text-align:center'
    document.body.appendChild(this.preview)

    // pause banner (center)
    this.pauseTag = document.createElement('div')
    this.pauseTag.textContent = '⏸ ПАУЗА'
    this.pauseTag.style.cssText = 'position:fixed;top:46%;left:50%;transform:translate(-50%,-50%);' +
      `font-family:monospace;font-size:40px;font-weight:bold;color:${ACCENT};text-shadow:0 0 16px #000;` +
      'z-index:6;display:none;pointer-events:none;letter-spacing:3px'
    document.body.appendChild(this.pauseTag)
  }

  setCrosshair(v: boolean) { this.cross.style.display = v ? 'block' : 'none' }

  // a coloured HP bar fragment
  private bar(frac: number, color: string): string {
    const w = Math.round(Math.max(0, Math.min(1, frac)) * 100)
    return `<div style="display:inline-block;width:70px;height:8px;background:#311;border:1px solid #000;vertical-align:middle;border-radius:3px;overflow:hidden">` +
      `<div style="height:100%;width:${w}%;background:${color}"></div></div>`
  }

  update() {
    const hp = this.hero.alive ? this.hero.hp : 0
    const hpColor = hp > 50 ? '#3c3' : hp > 25 ? '#cc3' : '#c33'
    this.stats.innerHTML =
      `<div>💰 <b style="color:${ACCENT}">${this.state.gold}</b></div>` +
      `<div>❤ <b>${this.state.lives}</b></div>` +
      `<div>🌊 Волна <b>${this.state.wave}/${this.state.totalWaves}</b></div>` +
      `<div>🦸 ${this.hero.alive ? this.bar(hp / 100, hpColor) + ` ${hp}` : '<span style="color:#c33">респаун…</span>'}</div>`

    // highlight the active speed button (pause shown when paused)
    for (const [key, b] of Object.entries(this.speedBtns)) {
      const active = key === 'pause' ? this.speed.paused : (!this.speed.paused && this.speed.multiplier === Number(key))
      b.style.background = active ? ACCENT : '#1b2330'
      b.style.color = active ? '#1b2330' : '#cfe'
    }
    this.pauseTag.style.display = this.speed.paused ? 'block' : 'none'
  }

  // show what the upcoming wave contains during the build countdown; null hides it
  setWavePreview(entries: { kind: EnemyKind; count: number }[] | null, waveNumber: number, countdown: number) {
    if (!entries || entries.length === 0) { this.preview.style.display = 'none'; return }
    const parts = entries.map((e) => `${ENEMY_ICON[e.kind]}×${e.count} ${ENEMY_LABEL[e.kind]}`).join('  ·  ')
    this.preview.style.display = 'block'
    this.preview.innerHTML = `<b style="color:${ACCENT}">Волна ${waveNumber}</b> через ${Math.ceil(countdown)}с ` +
      `<span style="opacity:.7">(Enter — раньше)</span><br>${parts}`
  }

  showEnd(victory: boolean) {
    this.end.style.display = 'flex'
    this.end.textContent = victory ? 'VICTORY' : 'GAME OVER'
  }
}
