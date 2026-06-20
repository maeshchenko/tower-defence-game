// Trauma-based screenshake (Vlambeer "Art of Screenshake"). Events add trauma in
// [0,1]; perceived shake = trauma² so small knocks barely register and big ones
// punch. Trauma decays continuously. Pure logic — no Babylon — so it unit-tests.
export class Screenshake {
  private trauma = 0
  private seed = 1
  private readonly decayPerSec: number

  constructor(decayPerSec = 1.5) { this.decayPerSec = decayPerSec }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, Math.max(0, this.trauma + amount))
  }

  get value(): number { return this.trauma }
  intensity(): number { return this.trauma * this.trauma }

  // deterministic pseudo-random in [-1,1] (LCG) so tests are stable and the shake
  // doesn't need Math.random
  private noise(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed / 2147483647) * 2 - 1
  }

  // advance one frame: returns the screen offset to apply this frame, then decays.
  // maxAmp is the peak offset (in camera targetScreenOffset units).
  step(dt: number, maxAmp: number): { x: number; y: number } {
    const i = this.intensity()
    const off = { x: maxAmp * i * this.noise(), y: maxAmp * i * this.noise() }
    this.trauma = Math.max(0, this.trauma - this.decayPerSec * dt)
    return off
  }
}
