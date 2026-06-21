import { AudioBus, Channel } from '../audio/AudioBus'
import { QualityPreset } from '../rendering/Quality'
import { t } from '../i18n'

const PANEL = 'background:rgba(16,20,28,0.94);border:1px solid #2a3344;border-radius:8px;'
const ACCENT = '#ffd24d'

// Gear button (top-right) opening a panel with volume sliders, mute and the
// graphics-quality preset. Volumes persist via AudioBus; quality via the callback.
export class Settings {
  private panel!: HTMLDivElement
  constructor(
    private bus: AudioBus,
    private quality: { get: () => QualityPreset; set: (p: QualityPreset) => void },
  ) {}

  mount() {
    const gear = document.createElement('button')
    gear.textContent = '⚙'
    gear.title = t('settings.gearTitle')
    gear.style.cssText = 'position:fixed;top:8px;right:8px;z-index:8;font-size:20px;width:40px;height:40px;cursor:pointer;' +
      `border:1px solid #3a4860;background:rgba(16,20,28,0.82);color:${ACCENT};border-radius:8px`
    gear.onclick = () => { this.panel.style.display = this.panel.style.display === 'none' ? 'block' : 'none'; this.render() }
    document.body.appendChild(gear)

    this.panel = document.createElement('div')
    this.panel.style.cssText = 'position:fixed;top:56px;right:8px;width:230px;display:none;z-index:8;' +
      `font-family:monospace;color:#fff;font-size:13px;${PANEL}padding:14px`
    document.body.appendChild(this.panel)
  }

  private render() {
    const slider = (label: string, ch: Channel) =>
      `<div style="margin-bottom:10px"><div style="margin-bottom:3px">${label}: <b>${Math.round(this.bus.getVolume(ch) * 100)}</b></div>` +
      `<input data-vol="${ch}" type="range" min="0" max="100" value="${Math.round(this.bus.getVolume(ch) * 100)}" style="width:100%"></div>`
    const q = this.quality.get()
    const qBtn = (p: QualityPreset) =>
      `<button data-q="${p}" style="flex:1;font-family:monospace;font-size:12px;padding:6px 2px;cursor:pointer;border:1px solid #3a4860;border-radius:5px;` +
      `background:${p === q ? ACCENT : '#1b2330'};color:${p === q ? '#1b2330' : '#cfe'}">${t('settings.' + p)}</button>`
    this.panel.innerHTML =
      `<div style="color:${ACCENT};font-size:15px;margin-bottom:10px">${t('settings.title')}</div>` +
      slider(t('settings.master'), 'master') + slider(t('settings.music'), 'music') + slider(t('settings.sfx'), 'sfx') +
      `<label style="display:block;margin:6px 0 12px;cursor:pointer"><input data-mute type="checkbox" ${this.bus.muted ? 'checked' : ''}> ${t('settings.mute')}</label>` +
      `<div style="margin-bottom:6px">${t('settings.graphics')}</div><div style="display:flex;gap:6px">${qBtn('low')}${qBtn('med')}${qBtn('high')}</div>`

    this.panel.querySelectorAll('input[data-vol]').forEach((el) => {
      const inp = el as HTMLInputElement
      inp.oninput = () => { this.bus.setVolume(inp.dataset.vol as Channel, Number(inp.value) / 100); this.render() }
    })
    const mute = this.panel.querySelector('input[data-mute]') as HTMLInputElement
    mute.onchange = () => { this.bus.toggleMute(); this.render() }
    this.panel.querySelectorAll('button[data-q]').forEach((el) => {
      const b = el as HTMLButtonElement
      b.onclick = () => { this.quality.set(b.dataset.q as QualityPreset); this.render() }
    })
  }
}
