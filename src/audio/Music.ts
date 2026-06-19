import { AudioBus } from './AudioBus'

export type MusicState = 'calm' | 'tense'

// Procedural background music: two always-running layers (a soft pad for the build
// phase, a driving pulse for waves) routed to the music bus. setState crossfades
// between them. No asset files — pure oscillators.
export class Music {
  private started = false
  private calmGain!: GainNode  // outer crossfade gain for the calm layer
  private tenseGain!: GainNode // outer crossfade gain for the tense layer
  private state: MusicState = 'calm'

  constructor(private bus: AudioBus) {}

  start(): void {
    if (this.started) return
    this.started = true
    const ctx = this.bus.context
    this.calmGain = ctx.createGain(); this.calmGain.gain.value = 0.0001; this.calmGain.connect(this.bus.musicOut)
    this.tenseGain = ctx.createGain(); this.tenseGain.gain.value = 0.0001; this.tenseGain.connect(this.bus.musicOut)
    // calm: soft Am-ish pad with a slow tremolo
    this.buildLayer(ctx, [110, 164.81, 220, 261.63], 'sine', this.calmGain, 0.5, 0.12, 0.25)
    // tense: low power chord with a fast rhythmic pulse
    this.buildLayer(ctx, [55, 82.41, 110], 'sawtooth', this.tenseGain, 0.4, 2.2, 0.5)
    this.setState(this.state, true)
  }

  // oscillators -> inner gain (tremolo/pulse via LFO) -> outer crossfade gain
  private buildLayer(ctx: AudioContext, freqs: number[], type: OscillatorType, outer: GainNode, base: number, lfoFreq: number, lfoDepth: number): void {
    const inner = ctx.createGain(); inner.gain.value = base; inner.connect(outer)
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 1 / freqs.length
      o.connect(g).connect(inner); o.start()
    }
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = lfoFreq
    const depth = ctx.createGain(); depth.gain.value = lfoDepth
    lfo.connect(depth).connect(inner.gain); lfo.start() // modulates inner gain around `base`
  }

  setState(s: MusicState, immediate = false): void {
    this.state = s
    if (!this.started) return
    const ctx = this.bus.context, t = ctx.currentTime, tc = immediate ? 0.01 : 1.2
    this.calmGain.gain.setTargetAtTime(s === 'calm' ? 0.5 : 0.0001, t, tc)
    this.tenseGain.gain.setTargetAtTime(s === 'tense' ? 0.5 : 0.0001, t, tc)
  }

  // fade both layers out (game over / victory)
  silence(): void {
    if (!this.started) return
    const ctx = this.bus.context, t = ctx.currentTime
    this.calmGain.gain.setTargetAtTime(0.0001, t, 0.8)
    this.tenseGain.gain.setTargetAtTime(0.0001, t, 0.8)
  }
}
