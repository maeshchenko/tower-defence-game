export class HeroWeapon {
  private damage: number
  private cd: number
  private cooldown = 0
  constructor(opts?: { damage?: number; fireRate?: number }) {
    this.damage = opts?.damage ?? 25
    this.cd = 1 / (opts?.fireRate ?? 4)
  }
  tick(dt: number) { this.cooldown = Math.max(0, this.cooldown - dt) }
  canFire(): boolean { return this.cooldown <= 0 }
  fire(): number | null {
    if (!this.canFire()) return null
    this.cooldown = this.cd
    return this.damage
  }
}
