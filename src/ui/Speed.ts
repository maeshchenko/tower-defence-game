// Game-speed / pause controller (Defender's Quest "focus & thinking": a TD must
// let the player slow down and think, and speed up the boring stretches). Pure
// logic — multiplies the sim dt; render/FX keep real time. Unit-tested.
export const SPEED_STEPS = [1, 2, 3] as const

export class Speed {
  private mult = 1
  private _paused = false

  get paused(): boolean { return this._paused }
  get multiplier(): number { return this.mult }
  // the factor to multiply sim dt by this frame (0 while paused)
  get scale(): number { return this._paused ? 0 : this.mult }

  // pick an explicit speed; choosing a speed also unpauses
  setMultiplier(m: number): void {
    this.mult = SPEED_STEPS.includes(m as 1 | 2 | 3) ? m : 1
    this._paused = false
  }
  // cycle 1 → 2 → 3 → 1 (unpauses)
  cycle(): void {
    const i = SPEED_STEPS.indexOf(this.mult as 1 | 2 | 3)
    this.mult = SPEED_STEPS[(i + 1) % SPEED_STEPS.length]
    this._paused = false
  }
  togglePause(): void { this._paused = !this._paused }
  setPaused(v: boolean): void { this._paused = v }
}
