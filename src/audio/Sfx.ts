import { AudioBus } from './AudioBus'
import { VoiceLimiter } from './VoiceLimiter'
import { DuckController } from './DuckController'
import { randRange, semitoneToRate } from './variation'

// Synthesized SFX routed through the shared AudioBus (sfx channel). Each trigger
// is pitch/volume randomized to avoid fatigue, and gated by a VoiceLimiter so
// rapid fire / many towers don't stack into clipping. Public method names are
// unchanged so main.ts callsites stay put.
export class Sfx {
  private vl = new VoiceLimiter({ defaultMax: 6, defaultCooldownMs: 35 })
  private duckCtl = new DuckController(0.45)
  constructor(private bus: AudioBus) {}

  private now(): number { return this.bus.context.currentTime * 1000 }

  // short oscillator blip with exponential decay + optional pitch slide, varied
  private blip(key: string, freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, max = 6, cd = 35) {
    if (!this.vl.request(key, this.now(), { max, cooldownMs: cd })) return
    const ctx = this.bus.context, t = ctx.currentTime
    const rate = semitoneToRate(randRange(-1.5, 1.5))
    const v = vol * randRange(0.7, 1.0)
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq * rate, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo * rate), t + dur)
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.bus.sfxOut); o.start(t); o.stop(t + dur)
    o.onended = () => this.vl.release(key)
  }
  // decaying white-noise burst (impacts / death), varied volume
  private noise(key: string, dur: number, vol: number, max = 6, cd = 35) {
    if (!this.vl.request(key, this.now(), { max, cooldownMs: cd })) return
    const ctx = this.bus.context, t = ctx.currentTime
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = ctx.createBufferSource(); src.buffer = buf
    const g = ctx.createGain(); g.gain.value = vol * randRange(0.7, 1.0)
    src.connect(g).connect(this.bus.sfxOut); src.start(t)
    src.onended = () => this.vl.release(key)
  }

  // duck the music bus for a big event, restore after `ms` (refcounted)
  duck(ms = 500): void {
    const ctx = this.bus.context, t = ctx.currentTime
    const m = this.duckCtl.push()
    this.bus.musicOut.gain.cancelScheduledValues(t)
    this.bus.musicOut.gain.setTargetAtTime(this.bus.getVolume('music') * m, t, 0.05)
    setTimeout(() => {
      const t2 = ctx.currentTime, mm = this.duckCtl.pop()
      this.bus.musicOut.gain.setTargetAtTime(this.bus.getVolume('music') * mm, t2, 0.4)
    }, ms)
  }

  shoot() { this.blip('shoot', 660, 0.08, 'square', 0.05, 240) }
  hit() { this.blip('hit', 320, 0.06, 'sawtooth', 0.07, 150); this.noise('hit', 0.04, 0.04) }
  death() { this.noise('death', 0.22, 0.14, 4, 25) }
  build() { this.blip('build', 440, 0.1, 'triangle', 0.12, 880, 3, 60) }
  deny() { this.blip('deny', 160, 0.16, 'square', 0.1, undefined, 2, 120) }
  heroHurt() { this.blip('heroHurt', 200, 0.2, 'sawtooth', 0.14, 70, 2, 120) }
  waveStart() { this.blip('waveStart', 330, 0.12, 'triangle', 0.12, 520, 1, 200); this.blip('waveStart2', 495, 0.18, 'triangle', 0.08, 660, 1, 200) }
}
