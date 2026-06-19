import { TowerKind } from '../towers/TowerTypes'

export class BuildMenu {
  private root!: HTMLElement
  private selected: TowerKind | null = null
  // costs: build price per tower kind, shown on each button
  constructor(private onSelect: (k: TowerKind | null) => void, private costs: Record<TowerKind, number>) {}
  mount() {
    this.root = document.getElementById('buildmenu')!
    const kinds: TowerKind[] = ['cannon', 'slow', 'sniper']
    for (const k of kinds) {
      const b = document.createElement('button')
      b.innerHTML = `${k}<br><b>${this.costs[k]}</b>`
      b.style.cssText = 'padding:8px 14px;font-family:monospace;cursor:pointer;text-align:center;line-height:1.3'
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
