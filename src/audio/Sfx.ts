import { AudioBus } from './AudioBus'

// Synthesized sound effects routed through the shared AudioBus (sfx channel), so
// the master/sfx volume sliders and mute apply. No asset files.
export class Sfx {
  constructor(private bus: AudioBus) {}

  // a short oscillator blip with an exponential decay (and optional pitch slide)
  private blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ctx = this.bus.context; const t = ctx.currentTime
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur)
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.bus.sfxOut); o.start(t); o.stop(t + dur)
  }
  // a burst of decaying white noise (impacts / death)
  private noise(dur: number, vol: number) {
    const ctx = this.bus.context; const t = ctx.currentTime
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = ctx.createBufferSource(); src.buffer = buf
    const g = ctx.createGain(); g.gain.value = vol
    src.connect(g).connect(this.bus.sfxOut); src.start(t)
  }
  shoot() { this.blip(660, 0.08, 'square', 0.05, 240) }
  hit() { this.blip(320, 0.06, 'sawtooth', 0.07, 150); this.noise(0.04, 0.04) }
  death() { this.noise(0.22, 0.14) }
  build() { this.blip(440, 0.1, 'triangle', 0.12, 880) }
  deny() { this.blip(160, 0.16, 'square', 0.1) }
  heroHurt() { this.blip(200, 0.2, 'sawtooth', 0.14, 70) }
  waveStart() { this.blip(330, 0.12, 'triangle', 0.12, 520); this.blip(495, 0.18, 'triangle', 0.08, 660) }
}
