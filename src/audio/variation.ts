// Pure helpers for SFX variation — no Web Audio, unit-testable under node.

// Convert a pitch offset in semitones to an AudioBufferSourceNode playbackRate.
export function semitoneToRate(semitones: number): number {
  return Math.pow(2, semitones / 12)
}

// Uniform value in [min, max]. rand injectable for deterministic tests.
export function randRange(min: number, max: number, rand: () => number = Math.random): number {
  return min + (max - min) * rand()
}

// Picks items avoiding an immediate repeat (round-robin variation).
export class RoundRobin<T> {
  private prev = -1
  constructor(private items: T[]) {}
  next(rand: () => number = Math.random): T {
    const n = this.items.length
    if (n === 1) return this.items[0]
    let i = Math.floor(rand() * n) % n
    if (i === this.prev) i = (i + 1) % n
    this.prev = i
    return this.items[i]
  }
}
