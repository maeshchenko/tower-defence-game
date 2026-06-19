import { TowerKind } from '../towers/TowerTypes'

export interface TowerInfo {
  kind: TowerKind
  level: number
  maxLevel: number
  damage: number
  range: number
  fireRate: number
  slow?: number
  upgradeCost: number | null // null at max level
  sellValue: number
}

const PANEL = 'background:rgba(16,20,28,0.9);border:1px solid #2a3344;border-radius:8px;'
const ACCENT = '#ffd24d'

// Floating card for the currently-selected tower: stats + upgrade/sell actions.
export class TowerPanel {
  private root!: HTMLDivElement
  private body!: HTMLDivElement
  private upBtn!: HTMLButtonElement
  private sellBtn!: HTMLButtonElement
  private onUpgrade: (() => void) | null = null
  private onSell: (() => void) | null = null

  mount() {
    this.root = document.createElement('div')
    this.root.style.cssText = 'position:fixed;bottom:12px;right:12px;width:200px;display:none;z-index:7;' +
      'font-family:monospace;color:#fff;font-size:13px;' + PANEL + 'padding:12px'
    this.body = document.createElement('div')
    this.root.appendChild(this.body)
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:6px;margin-top:10px'
    this.upBtn = this.mkBtn('Улучшить', '#1b3320', '#9f9')
    this.sellBtn = this.mkBtn('Продать', '#331b1b', '#f99')
    this.upBtn.onclick = () => this.onUpgrade?.()
    this.sellBtn.onclick = () => this.onSell?.()
    row.append(this.upBtn, this.sellBtn)
    this.root.appendChild(row)
    document.body.appendChild(this.root)
  }

  private mkBtn(label: string, bg: string, fg: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText = `flex:1;font-family:monospace;font-size:12px;padding:7px 4px;cursor:pointer;` +
      `border:1px solid #3a4860;background:${bg};color:${fg};border-radius:5px`
    return b
  }

  show(info: TowerInfo, onUpgrade: () => void, onSell: () => void) {
    this.onUpgrade = onUpgrade
    this.onSell = onSell
    const slow = info.slow != null ? `<div>Замедление: <b>${Math.round((1 - info.slow) * 100)}%</b></div>` : ''
    this.body.innerHTML =
      `<div style="color:${ACCENT};font-size:15px;text-transform:uppercase;margin-bottom:6px">${info.kind} · ур.${info.level + 1}</div>` +
      `<div>Урон: <b>${info.damage}</b></div>` +
      `<div>Дальность: <b>${info.range}</b></div>` +
      `<div>Скорострел.: <b>${info.fireRate.toFixed(1)}/с</b></div>` + slow
    if (info.upgradeCost == null) {
      this.upBtn.textContent = 'МАКС'
      this.upBtn.disabled = true
      this.upBtn.style.opacity = '0.5'
    } else {
      this.upBtn.textContent = `Улучшить ${info.upgradeCost}`
      this.upBtn.disabled = false
      this.upBtn.style.opacity = '1'
    }
    this.sellBtn.textContent = `Продать ${info.sellValue}`
    this.root.style.display = 'block'
  }

  hide() { this.root.style.display = 'none'; this.onUpgrade = null; this.onSell = null }
  get visible() { return this.root.style.display === 'block' }
}
