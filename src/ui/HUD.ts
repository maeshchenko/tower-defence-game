import { GameState } from '../core/GameState'
import { HeroState } from '../hero/HeroState'

export class HUD {
  private el!: HTMLElement
  private cross!: HTMLElement
  private end!: HTMLElement
  constructor(private state: GameState, private hero: HeroState) {}
  mount() {
    this.el = document.getElementById('hud')!
    this.cross = document.getElementById('crosshair')!
    this.cross.style.display = 'none' // no crosshair; hero shoots forward where it faces
    this.end = document.getElementById('endscreen')!
  }
  setCrosshair(v: boolean) { this.cross.style.display = v ? 'block' : 'none' }
  update() {
    this.el.innerHTML =
      `Gold: ${this.state.gold}<br>Lives: ${this.state.lives}<br>` +
      `Wave: ${this.state.wave}/${this.state.totalWaves}<br>` +
      `Hero HP: ${this.hero.alive ? this.hero.hp : 'respawning...'}`
  }
  showEnd(victory: boolean) {
    this.end.style.display = 'flex'
    this.end.textContent = victory ? 'VICTORY' : 'GAME OVER'
  }
}
