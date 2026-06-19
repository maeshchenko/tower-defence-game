// Central Web Audio mixer: one AudioContext, three gain buses (music + sfx -> master
// -> speakers). Volumes persist to localStorage. The context is created lazily and
// resumed on the first user gesture (autoplay policy). No asset files.
export type Channel = 'master' | 'music' | 'sfx'

interface Volumes { master: number; music: number; sfx: number; muted: boolean }
const KEY = 'td.audio'
const DEFAULTS: Volumes = { master: 0.8, music: 0.45, sfx: 0.8, muted: false }

export class AudioBus {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private vol: Volumes = { ...DEFAULTS }

  constructor() { this.vol = this.load() }

  private init(): void {
    if (this.ctx) return
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.musicBus = this.ctx.createGain()
    this.sfxBus = this.ctx.createGain()
    this.musicBus.connect(this.master)
    this.sfxBus.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.apply()
  }

  // resume audio from a user gesture (first click/keypress)
  unlock(): void { this.init(); if (this.ctx!.state === 'suspended') void this.ctx!.resume() }

  get context(): AudioContext { this.init(); return this.ctx! }
  get sfxOut(): GainNode { this.init(); return this.sfxBus }
  get musicOut(): GainNode { this.init(); return this.musicBus }

  get muted(): boolean { return this.vol.muted }
  getVolume(ch: Channel): number { return this.vol[ch] }
  setVolume(ch: Channel, v: number): void { this.vol[ch] = Math.max(0, Math.min(1, v)); this.apply(); this.save() }
  toggleMute(): void { this.vol.muted = !this.vol.muted; this.apply(); this.save() }

  private apply(): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.02)
    this.musicBus.gain.setTargetAtTime(this.vol.music, t, 0.02)
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.02)
  }

  private load(): Volumes {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
      if (!raw) return { ...DEFAULTS }
      const p = JSON.parse(raw)
      return {
        master: clamp(p.master, DEFAULTS.master), music: clamp(p.music, DEFAULTS.music),
        sfx: clamp(p.sfx, DEFAULTS.sfx), muted: typeof p.muted === 'boolean' ? p.muted : false,
      }
    } catch { return { ...DEFAULTS } }
  }
  private save(): void {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(this.vol)) } catch { /* ignore */ }
  }
}

function clamp(v: unknown, fallback: number): number {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback
}
