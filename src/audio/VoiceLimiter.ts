// Pure polyphony guard: caps concurrent voices per sound key and enforces a
// retrigger cooldown (also coalesces same-frame triggers). Clock is injected
// (nowMs) so it unit-tests with no AudioContext.
interface Opts { defaultMax?: number; defaultCooldownMs?: number }

export class VoiceLimiter {
  private active = new Map<string, number>()
  private last = new Map<string, number>()
  private defMax: number
  private defCd: number
  constructor(opts: Opts = {}) {
    this.defMax = opts.defaultMax ?? 8
    this.defCd = opts.defaultCooldownMs ?? 40
  }
  request(key: string, nowMs: number, opts: { max?: number; cooldownMs?: number } = {}): boolean {
    const max = opts.max ?? this.defMax
    const cd = opts.cooldownMs ?? this.defCd
    const last = this.last.get(key)
    if (last !== undefined && nowMs - last < cd) return false
    const cur = this.active.get(key) ?? 0
    if (cur >= max) return false
    this.active.set(key, cur + 1)
    this.last.set(key, nowMs)
    return true
  }
  release(key: string): void {
    const cur = this.active.get(key) ?? 0
    this.active.set(key, Math.max(0, cur - 1))
  }
}
