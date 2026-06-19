// Tiny synthesized sound effects via the Web Audio API — no asset files, so
// nothing to download or load. The AudioContext is created lazily and resumed
// on the first call (which happens from a user gesture, satisfying autoplay rules).
export class Sfx {
  private ctx: AudioContext | null = null
  muted = false
  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }
  // a short oscillator blip with an exponential decay (and optional pitch slide)
  private blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    if (this.muted) return
    const ctx = this.ensure(); const t = ctx.currentTime
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur)
  }
  // a burst of decaying white noise (impacts / death)
  private noise(dur: number, vol: number) {
    if (this.muted) return
    const ctx = this.ensure(); const t = ctx.currentTime
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = ctx.createBufferSource(); src.buffer = buf
    const g = ctx.createGain(); g.gain.value = vol
    src.connect(g).connect(ctx.destination); src.start(t)
  }
  shoot() { this.blip(660, 0.08, 'square', 0.05, 240) }
  hit() { this.blip(320, 0.06, 'sawtooth', 0.07, 150) }
  death() { this.noise(0.22, 0.14) }
  build() { this.blip(440, 0.1, 'triangle', 0.12, 880) }
  deny() { this.blip(160, 0.16, 'square', 0.1) }
  heroHurt() { this.blip(200, 0.2, 'sawtooth', 0.14, 70) }
  waveStart() { this.blip(330, 0.12, 'triangle', 0.12, 520) }
}
