import { TowerKind } from '../towers/TowerTypes'

export class BuildMenu {
  private root!: HTMLElement
  private selected: TowerKind | null = null
  // costs: build price per tower kind, shown on each button
  constructor(private onSelect: (k: TowerKind | null) => void, private costs: Record<TowerKind, number>) {}
  mount() {
    this.root = document.getElementById('buildmenu')!
    const kinds: TowerKind[] = ['cannon', 'slow', 'sniper', 'mortar', 'tesla']
    for (const k of kinds) {
      const b = document.createElement('button')
      b.innerHTML = `${k}<br><b style="color:#ffd24d">${this.costs[k]}</b>`
      b.style.cssText = 'padding:9px 16px;font-family:monospace;font-size:14px;cursor:pointer;text-align:center;line-height:1.4;' +
        'border:1px solid #3a4860;background:rgba(16,20,28,0.82);color:#cfe;border-radius:6px;text-transform:uppercase'
      b.onclick = () => {
        this.selected = this.selected === k ? null : k
        this.onSelect(this.selected)
        this.render()
      }
      b.dataset.kind = k
      this.root.appendChild(b)
    }
  }
  private render() {
    for (const b of Array.from(this.root.children) as HTMLButtonElement[]) {
      b.style.outline = b.dataset.kind === this.selected ? '2px solid #ff0' : 'none'
    }
  }
  setVisible(v: boolean) { this.root.style.display = v ? 'flex' : 'none' }
}
