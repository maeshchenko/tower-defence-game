import { AudioBus } from './AudioBus'

export type MusicState = 'calm' | 'tense'

// MIDI note -> frequency (A4 = 69 = 440 Hz)
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
// Walking bass on A-minor triad tones only (A1 C2 E2), so every note is consonant
// with the static A power-chord saw. Resolves back to A. Loops.
const BASS = [33, 36, 40, 36, 33, 40, 36, 33] // A C E C A E C A
const TENSE_LFO = 2.2        // tense layer's rhythmic pulse (Hz) — the existing "качание"
const PULSES_PER_NOTE = 2    // bass changes note every N pulses, locked to the pulse
const BASS_HOLD = PULSES_PER_NOTE / TENSE_LFO // seconds per bass note (multiple of the pulse)

// Procedural background music: two always-running layers (a soft pad for the build
// phase, a driving pulse for waves) routed to the music bus. setState crossfades
// between them. No asset files — pure oscillators.
export class Music {
  private started = false
  private calmGain!: GainNode  // outer crossfade gain for the calm layer
  private tenseGain!: GainNode // outer crossfade gain for the tense layer
  private bassGain!: GainNode  // walking bass (active in waves)
  private bassOsc!: OscillatorNode
  private bassTimer: ReturnType<typeof setInterval> | null = null
  private bassNext = 0
  private bassStep = 0
  private state: MusicState = 'calm'

  constructor(private bus: AudioBus) {}

  start(): void {
    if (this.started) return
    this.started = true
    const ctx = this.bus.context
    this.calmGain = ctx.createGain(); this.calmGain.gain.value = 0.0001; this.calmGain.connect(this.bus.musicOut)
    this.tenseGain = ctx.createGain(); this.tenseGain.gain.value = 0.0001; this.tenseGain.connect(this.bus.musicOut)
    // calm: soft Am-ish pad with a slow tremolo (unchanged)
    this.buildLayer(ctx, [110, 164.81, 220, 261.63], 'sine', this.calmGain, 0.5, 0.12, 0.25)
    // tense: upper power chord (the low root is now the walking bass below)
    this.buildLayer(ctx, [82.41, 110], 'sawtooth', this.tenseGain, 0.4, TENSE_LFO, 0.5)
    // walking bass: one filtered saw whose note steps along BASS, locked to the pulse
    this.bassGain = ctx.createGain(); this.bassGain.gain.value = 0.0001; this.bassGain.connect(this.bus.musicOut)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2
    this.bassOsc = ctx.createOscillator(); this.bassOsc.type = 'sawtooth'; this.bassOsc.frequency.value = mtof(BASS[0])
    this.bassOsc.connect(lp).connect(this.bassGain); this.bassOsc.start()
    this.bassNext = ctx.currentTime + 0.1
    this.bassTimer = setInterval(() => this.scheduleBass(), 50)
    this.setState(this.state, true)
  }

  // step the bass to its next note at each hold boundary (a multiple of the pulse),
  // with a short glide so it lands cleanly and then holds
  private scheduleBass(): void {
    const ctx = this.bus.context
    while (this.bassNext < ctx.currentTime + 0.15) {
      const f = mtof(BASS[this.bassStep % BASS.length])
      this.bassOsc.frequency.setTargetAtTime(f, this.bassNext, 0.03)
      this.bassStep++
      this.bassNext += BASS_HOLD
    }
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
    this.bassGain.gain.setTargetAtTime(s === 'tense' ? 0.34 : 0.0001, t, tc) // bass walks during waves
  }

  // fade both layers out (game over / victory)
  silence(): void {
    if (!this.started) return
    const ctx = this.bus.context, t = ctx.currentTime
    this.calmGain.gain.setTargetAtTime(0.0001, t, 0.8)
    this.tenseGain.gain.setTargetAtTime(0.0001, t, 0.8)
    this.bassGain.gain.setTargetAtTime(0.0001, t, 0.8)
    if (this.bassTimer) { clearInterval(this.bassTimer); this.bassTimer = null }
  }
}
