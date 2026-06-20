// Hitstop / hit-pause: briefly freeze the SIMULATION on big impacts so they read
// as weighty. FX and the render loop keep running on real time — only gameplay dt
// is scaled to 0. Pure logic, unit-tested.
export class Hitstop {
  private remainingMs = 0

  // request a freeze; overlapping triggers extend to the longer of the two
  trigger(ms: number): void {
    if (ms > this.remainingMs) this.remainingMs = ms
  }

  // advance by the real elapsed ms; returns the sim time scale (0 while frozen, 1 otherwise)
  update(realDtMs: number): number {
    if (this.remainingMs <= 0) return 1
    this.remainingMs -= realDtMs
    return 0
  }

  get frozen(): boolean { return this.remainingMs > 0 }
}
