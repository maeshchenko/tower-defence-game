import { TowerKind } from '../towers/TowerTypes'

export class BuildMenu {
  private root!: HTMLElement
  private selected: TowerKind | null = null
  constructor(private onSelect: (k: TowerKind | null) => void) {}
  mount() {
    this.root = document.getElementById('buildmenu')!
    const kinds: TowerKind[] = ['cannon', 'slow', 'sniper']
    for (const k of kinds) {
      const b = document.createElement('button')
      b.textContent = k
      b.style.cssText = 'padding:8px 12px;font-family:monospace;cursor:pointer'
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
