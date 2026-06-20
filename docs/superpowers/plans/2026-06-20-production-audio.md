# Production-Ready Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the game's audio from pure oscillators to production-ready sound — a master limiter safety chain, varied/voice-limited SFX, and real layered music stems — without rewriting the existing `AudioBus` plumbing or changing `main.ts` callsites.

**Architecture:** Keep the raw Web Audio `AudioBus` (master → {music, sfx} → destination). Extract all new *decision logic* (voice limiting, pitch/volume variation, round-robin, music intensity→gain mapping, duck reference-count, soft-clip curve) into small **pure modules** that unit-test under the node env with no `AudioContext`. Thin ctx-touching wiring in `AudioBus`/`Sfx`/`Music` consumes those modules and is verified manually in-browser. Music moves from 2 procedural oscillator layers to N decoded Opus stems mixed by vertical layering (gain ramps). SFX optionally move to a decoded audio sprite. Both keep their current public method names so `main.ts` is untouched.

**Tech Stack:** TypeScript, Web Audio API, Babylon.js `@babylonjs/core ^9.13`, Vite, Vitest (node env, `globals: true`).

## Global Constraints

- No new runtime audio library (no Howler / Tone.js / FMOD / Wwise). Raw Web Audio only.
- Tests run under `environment: 'node'` — no `AudioContext`, `window`, or DOM. New logic that must be tested goes in pure modules with `Math.random` / clock injected as parameters.
- Preserve existing public APIs so `src/main.ts` and `src/ui/Settings.ts` need no changes: `AudioBus` (`unlock`, `context`, `sfxOut`, `musicOut`, `muted`, `getVolume`, `setVolume`, `toggleMute`), `Sfx` (`shoot`, `hit`, `death`, `build`, `deny`, `heroHurt`, `waveStart`), `Music` (`start`, `setState`, `silence`).
- `MusicState` extends to `'calm' | 'tense' | 'boss'` (was `'calm' | 'tense'`). `setState('calm'|'tense')` callsites in `main.ts` keep working; `'boss'` is additive.
- Audio formats: Opus (`.opus`) primary — music 96 kbps stereo, SFX 64 kbps mono, `-ar 48000`. Normalize music to `loudnorm=I=-18:TP=-1:LRA=11`. Total compressed audio budget 5–12 MB.
- Use the `0.0001` floor + ramp idiom already in `Music.ts` (Web Audio `exponentialRamp` cannot reach 0).
- Run `npm test` (vitest run) and `npm run typecheck` (tsc --noEmit) green before each commit.
- Commit messages: do NOT add Co-Authored-By or any trailer unless asked. Plain conventional-commit subject.

---

## File Structure

New pure modules (unit-tested):
- `src/audio/variation.ts` — pitch/volume randomization + round-robin picker.
- `src/audio/VoiceLimiter.ts` — per-key concurrency cap + retrigger cooldown.
- `src/audio/intensity.ts` — `MusicState` type + state→per-stem gain mapping.
- `src/audio/DuckController.ts` — duck reference-count → music gain multiplier.
- `src/audio/softclip.ts` — pure `tanh` WaveShaper curve generator.

New ctx wiring / loaders (manual verify):
- `src/audio/limiter.ts` — builds the DynamicsCompressor + WaveShaper master chain.
- `src/audio/load.ts` — `loadAudioBuffer(ctx, url)` + audio-sprite loader (Phase 1/2).

Modified:
- `src/audio/AudioBus.ts` — insert master limiter chain, headroom, visibility resume.
- `src/audio/Sfx.ts` — consume variation + VoiceLimiter + DuckController; (Phase 1) sample playback.
- `src/audio/Music.ts` — consume intensity mapping; (Phase 2) layered stems.

New tests:
- `tests/audio/variation.test.ts`, `tests/audio/VoiceLimiter.test.ts`,
  `tests/audio/intensity.test.ts`, `tests/audio/DuckController.test.ts`,
  `tests/audio/softclip.test.ts`.

New assets (Phase 1/2, user-sourced):
- `public/audio/sfx.opus` + `public/audio/sfx.json` (sprite map).
- `public/audio/music/{base,drive,boss}.opus`.
- `docs/audio-credits.md`.

---

# PHASE 0 — Mixing safety + SFX variety (no assets)

Fully implementable now. Biggest quality win per effort; zero asset dependency.

### Task 1: Pure variation helpers

**Files:**
- Create: `src/audio/variation.ts`
- Test: `tests/audio/variation.test.ts`

**Interfaces:**
- Produces:
  - `semitoneToRate(semitones: number): number`
  - `randRange(min: number, max: number, rand?: () => number): number`
  - `class RoundRobin<T> { constructor(items: T[]); next(rand?: () => number): T }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/audio/variation.test.ts
import { describe, it, expect } from 'vitest'
import { semitoneToRate, randRange, RoundRobin } from '../../src/audio/variation'

describe('semitoneToRate', () => {
  it('returns 1 at 0 semitones', () => expect(semitoneToRate(0)).toBeCloseTo(1))
  it('returns 2 at +12 semitones', () => expect(semitoneToRate(12)).toBeCloseTo(2))
  it('returns 0.5 at -12 semitones', () => expect(semitoneToRate(-12)).toBeCloseTo(0.5))
})

describe('randRange', () => {
  it('maps rand=0 to min and rand→1 to max', () => {
    expect(randRange(0.7, 1.0, () => 0)).toBeCloseTo(0.7)
    expect(randRange(0.7, 1.0, () => 1)).toBeCloseTo(1.0)
    expect(randRange(-3, 0, () => 0.5)).toBeCloseTo(-1.5)
  })
})

describe('RoundRobin', () => {
  it('never returns the same item twice in a row over a long run', () => {
    const rr = new RoundRobin(['a', 'b', 'c'])
    let prev = ''
    let seq = 0
    const vals = [0, 0, 0, 0.5, 0.9, 0.1, 0.99, 0.34]
    for (let i = 0; i < 50; i++) {
      const v = rr.next(() => vals[seq++ % vals.length])
      expect(v).not.toBe(prev)
      prev = v
    }
  })
  it('returns the only item when length is 1', () => {
    const rr = new RoundRobin(['x'])
    expect(rr.next()).toBe('x')
    expect(rr.next()).toBe('x')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio/variation.test.ts`
Expected: FAIL — cannot find module `../../src/audio/variation`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/audio/variation.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio/variation.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/audio/variation.ts tests/audio/variation.test.ts
git commit -m "feat(audio): pure SFX variation helpers (pitch/volume/round-robin)"
```

---

### Task 2: VoiceLimiter (concurrency cap + cooldown)

**Files:**
- Create: `src/audio/VoiceLimiter.ts`
- Test: `tests/audio/VoiceLimiter.test.ts`

**Interfaces:**
- Produces:
  - `class VoiceLimiter`
    - `constructor(opts?: { defaultMax?: number; defaultCooldownMs?: number })`
    - `request(key: string, nowMs: number, opts?: { max?: number; cooldownMs?: number }): boolean`
    - `release(key: string): void`
  - `request` returns `true` and registers an active voice when the key is under its
    max AND past its cooldown since the last accepted trigger; otherwise `false`.
  - `release` decrements the active count for the key (floored at 0).

- [ ] **Step 1: Write the failing test**

```ts
// tests/audio/VoiceLimiter.test.ts
import { describe, it, expect } from 'vitest'
import { VoiceLimiter } from '../../src/audio/VoiceLimiter'

describe('VoiceLimiter', () => {
  it('rejects retriggers inside the cooldown window', () => {
    const vl = new VoiceLimiter({ defaultMax: 8, defaultCooldownMs: 40 })
    expect(vl.request('shoot', 0)).toBe(true)
    expect(vl.request('shoot', 20)).toBe(false) // within 40ms
    expect(vl.request('shoot', 41)).toBe(true)  // past cooldown
  })
  it('coalesces same-frame triggers to one (cooldown > 0)', () => {
    const vl = new VoiceLimiter({ defaultMax: 8, defaultCooldownMs: 40 })
    expect(vl.request('shoot', 100)).toBe(true)
    expect(vl.request('shoot', 100)).toBe(false)
    expect(vl.request('shoot', 100)).toBe(false)
  })
  it('caps concurrent active voices and recovers after release', () => {
    const vl = new VoiceLimiter({ defaultMax: 2, defaultCooldownMs: 0 })
    expect(vl.request('hit', 0)).toBe(true)
    expect(vl.request('hit', 1)).toBe(true)
    expect(vl.request('hit', 2)).toBe(false) // at cap
    vl.release('hit')
    expect(vl.request('hit', 3)).toBe(true)
  })
  it('honors per-call overrides', () => {
    const vl = new VoiceLimiter({ defaultMax: 8, defaultCooldownMs: 0 })
    expect(vl.request('boss', 0, { max: 1 })).toBe(true)
    expect(vl.request('boss', 0, { max: 1 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio/VoiceLimiter.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/audio/VoiceLimiter.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio/VoiceLimiter.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/audio/VoiceLimiter.ts tests/audio/VoiceLimiter.test.ts
git commit -m "feat(audio): VoiceLimiter — per-sound concurrency cap + cooldown"
```

---

### Task 3: DuckController (music ducking reference-count)

**Files:**
- Create: `src/audio/DuckController.ts`
- Test: `tests/audio/DuckController.test.ts`

**Interfaces:**
- Produces:
  - `class DuckController`
    - `constructor(duckLevel?: number)` — `duckLevel` is the music gain multiplier while ducked (default `0.4` ≈ −8 dB).
    - `push(): number` — increments active ducks, returns the current target multiplier.
    - `pop(): number` — decrements (floored at 0), returns the current target multiplier.
    - `get count(): number`
  - Target multiplier is `1` when `count === 0`, else `duckLevel`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/audio/DuckController.test.ts
import { describe, it, expect } from 'vitest'
import { DuckController } from '../../src/audio/DuckController'

describe('DuckController', () => {
  it('multiplier is 1 when no ducks active', () => {
    const d = new DuckController(0.4)
    expect(d.count).toBe(0)
    expect(d.pop()).toBe(1) // pop below zero stays at 1
  })
  it('ducks while at least one is active, restores when all released', () => {
    const d = new DuckController(0.4)
    expect(d.push()).toBeCloseTo(0.4)
    expect(d.push()).toBeCloseTo(0.4) // overlapping duck stays ducked
    expect(d.count).toBe(2)
    expect(d.pop()).toBeCloseTo(0.4)  // still one active
    expect(d.pop()).toBe(1)           // all released
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio/DuckController.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/audio/DuckController.ts
// Reference-counted ducking so overlapping big events don't fight: music stays
// ducked while count>0 and restores to full only when all ducks are released.
export class DuckController {
  private n = 0
  constructor(private duckLevel = 0.4) {}
  get count(): number { return this.n }
  private target(): number { return this.n > 0 ? this.duckLevel : 1 }
  push(): number { this.n++; return this.target() }
  pop(): number { this.n = Math.max(0, this.n - 1); return this.target() }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio/DuckController.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/audio/DuckController.ts tests/audio/DuckController.test.ts
git commit -m "feat(audio): DuckController — refcounted music ducking"
```

---

### Task 4: Soft-clip curve + limiter chain

**Files:**
- Create: `src/audio/softclip.ts`
- Create: `src/audio/limiter.ts`
- Test: `tests/audio/softclip.test.ts`

**Interfaces:**
- Produces:
  - `makeSoftClipCurve(samples?: number, k?: number): Float32Array` (pure, in `softclip.ts`)
  - `buildMasterChain(ctx: AudioContext, input: GainNode): AudioNode` (in `limiter.ts`) —
    connects `input → DynamicsCompressor → WaveShaper(softclip) → returns the WaveShaper`
    so the caller connects the returned node to `ctx.destination`.

- [ ] **Step 1: Write the failing test (pure curve only)**

```ts
// tests/audio/softclip.test.ts
import { describe, it, expect } from 'vitest'
import { makeSoftClipCurve } from '../../src/audio/softclip'

describe('makeSoftClipCurve', () => {
  it('is symmetric, monotonic, and bounded within [-1,1]', () => {
    const c = makeSoftClipCurve(1025)
    expect(c.length).toBe(1025)
    expect(c[0]).toBeLessThan(0)
    expect(c[c.length - 1]).toBeGreaterThan(0)
    expect(c[(c.length - 1) / 2]).toBeCloseTo(0, 5) // midpoint maps ~0
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1])
    for (const v of c) expect(Math.abs(v)).toBeLessThanOrEqual(1)
  })
  it('tames values past unity (soft clip, not hard)', () => {
    const c = makeSoftClipCurve(1025, 2)
    expect(Math.abs(c[c.length - 1])).toBeLessThan(1) // tanh asymptote < 1
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio/softclip.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementations**

```ts
// src/audio/softclip.ts
// Pure tanh soft-clip transfer curve for a WaveShaperNode. Rounds off transients
// the compressor lets through instead of hard digital clipping.
export function makeSoftClipCurve(samples = 1025, k = 1.5): Float32Array {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1 // -1..1
    curve[i] = Math.tanh(k * x)
  }
  return curve
}
```

```ts
// src/audio/limiter.ts
// Master safety chain: input -> compressor (limiter) -> waveshaper (soft clip).
// Not a guaranteed brickwall (compressor ratio caps at 20:1, no lookahead) — a
// glue/safety net layered on top of headroom + voice limiting.
import { makeSoftClipCurve } from './softclip'

export function buildMasterChain(ctx: AudioContext, input: GainNode): AudioNode {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -3
  comp.knee.value = 0
  comp.ratio.value = 20
  comp.attack.value = 0.003
  comp.release.value = 0.05
  const shaper = ctx.createWaveShaper()
  shaper.curve = makeSoftClipCurve()
  shaper.oversample = '4x'
  input.connect(comp)
  comp.connect(shaper)
  return shaper
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio/softclip.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/audio/softclip.ts src/audio/limiter.ts tests/audio/softclip.test.ts
git commit -m "feat(audio): soft-clip curve + master limiter chain"
```

---

### Task 5: Wire limiter + headroom + visibility resume into AudioBus

**Files:**
- Modify: `src/audio/AudioBus.ts` (`init` ~19-30, `apply` ~44-50, add unlock listener)
- Test: `tests/audio/AudioBus.test.ts` (existing — must still pass; add one assertion)

**Interfaces:**
- Consumes: `buildMasterChain` from Task 4.
- Produces: unchanged public API. New private const `MASTER_HEADROOM = 0.6`.

- [ ] **Step 1: Update the existing test to lock headroom default**

Add to `tests/audio/AudioBus.test.ts` inside the `describe('AudioBus', ...)` block:

```ts
  it('exposes the nominal master volume unchanged by headroom', () => {
    const b = new AudioBus()
    // headroom is applied at the graph level, not to the stored/displayed volume
    expect(b.getVolume('master')).toBeCloseTo(0.8)
  })
```

- [ ] **Step 2: Run to verify current suite still green**

Run: `npx vitest run tests/audio/AudioBus.test.ts`
Expected: PASS (no ctx touched).

- [ ] **Step 3: Implement — insert master chain, headroom, visibility resume**

In `src/audio/AudioBus.ts`, add the import at top:

```ts
import { buildMasterChain } from './limiter'
```

Add a module const near `KEY`/`DEFAULTS`:

```ts
const MASTER_HEADROOM = 0.6 // leave ~4.4 dB before the limiter
```

Replace the `init` body's destination wiring (currently `this.master.connect(this.ctx.destination)`):

```ts
  private init(): void {
    if (this.ctx) return
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.musicBus = this.ctx.createGain()
    this.sfxBus = this.ctx.createGain()
    this.musicBus.connect(this.master)
    this.sfxBus.connect(this.master)
    buildMasterChain(this.ctx, this.master).connect(this.ctx.destination)
    this.apply()
  }
```

In `apply`, scale the master target by headroom (mute still wins):

```ts
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master * MASTER_HEADROOM, t, 0.02)
```

Extend `unlock` to also re-resume when the tab returns:

```ts
  unlock(): void {
    this.init()
    if (this.ctx!.state === 'suspended') void this.ctx!.resume()
    if (!this.visBound && typeof document !== 'undefined') {
      this.visBound = true
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
      })
    }
  }
```

Add the field near the other privates:

```ts
  private visBound = false
```

- [ ] **Step 4: Run full audio suite + typecheck**

Run: `npx vitest run tests/audio && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual browser verify**

Run: `npm run dev`. Open the game, click Play. Stack many enemies + towers firing. Expected: louder mix but no harsh crackle/clipping at peaks; mute still silences; switch tabs and back → audio resumes.

- [ ] **Step 6: Commit**

```bash
git add src/audio/AudioBus.ts tests/audio/AudioBus.test.ts
git commit -m "feat(audio): master limiter + headroom + tab-return resume in AudioBus"
```

---

### Task 6: Apply variation + voice limiting + duck to procedural Sfx

**Files:**
- Modify: `src/audio/Sfx.ts` (whole class — keep public method names)

**Interfaces:**
- Consumes: `semitoneToRate`/`randRange` (Task 1), `VoiceLimiter` (Task 2), `DuckController` (Task 3).
- Produces: same 7 public methods + new `duck(ms?: number): void` for big events.

- [ ] **Step 1: Implement — wrap blip/noise with variation + limiting**

Replace `src/audio/Sfx.ts` with:

```ts
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
```

- [ ] **Step 2: Typecheck + run suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS (no test imports the ctx-touching Sfx methods; pure deps already covered).

- [ ] **Step 3: Manual browser verify**

Run: `npm run dev`. Fire many towers at once. Expected: shots sound slightly different each time (pitch wobble), no machine-gun clipping when 10 towers fire, death/hero-hurt still audible.

- [ ] **Step 4: Optional — wire `duck()` to a big event (no API break)**

In `src/main.ts`, at the boss-spawn / wave-clear point (search for `music.setState('tense')` near `main.ts:676` and the wave-clear path near `main.ts:826`), add `sfx.duck(700)` on boss spawn. Manual verify music dips briefly then returns.

- [ ] **Step 5: Commit**

```bash
git add src/audio/Sfx.ts
git commit -m "feat(audio): varied + voice-limited procedural SFX with ducking"
```

---

# PHASE 1 — Sample-based SFX (optional; toward full produced audio)

> **PREREQUISITE (manual, user):** Source CC0/licensed SFX (Kenney CC0 + ElevenLabs paid for gaps). Build a sprite: `npx audiosprite --format howler --output public/audio/sfx --export opus -b 64 -c 1 shoot1.wav shoot2.wav hit1.wav ... ` producing `public/audio/sfx.opus` + `public/audio/sfx.json`. Normalize sources first with `ffmpeg -i in.wav -af loudnorm=I=-18:TP=-1:LRA=11 -ar 48000 out.wav`. Log each asset in `docs/audio-credits.md` (source URL + license). If assets are not ready, **skip Phase 1** — Phase 0 procedural SFX remain in use.

### Task 7: Audio buffer + sprite loader

**Files:**
- Create: `src/audio/load.ts`
- Test: `tests/audio/load.test.ts` (pure sprite-map parsing only)

**Interfaces:**
- Produces:
  - `loadAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer>`
  - `parseSpriteMap(json: unknown): Record<string, { offset: number; duration: number }>`
    — converts the audiosprite `{ sprite: { name: [startMs, durMs] } }` shape into seconds.

- [ ] **Step 1: Write the failing test (pure parse)**

```ts
// tests/audio/load.test.ts
import { describe, it, expect } from 'vitest'
import { parseSpriteMap } from '../../src/audio/load'

describe('parseSpriteMap', () => {
  it('converts howler ms pairs to {offset,duration} seconds', () => {
    const m = parseSpriteMap({ sprite: { shoot: [0, 300], hit: [400, 120] } })
    expect(m.shoot).toEqual({ offset: 0, duration: 0.3 })
    expect(m.hit).toEqual({ offset: 0.4, duration: 0.12 })
  })
  it('returns empty map for malformed input', () => {
    expect(parseSpriteMap(null)).toEqual({})
    expect(parseSpriteMap({})).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/audio/load.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
// src/audio/load.ts
// Async asset loaders. parseSpriteMap is pure (unit-tested); loadAudioBuffer
// touches network + ctx and is verified in-browser.
export async function loadAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  const arr = await res.arrayBuffer()
  return await ctx.decodeAudioData(arr)
}

export function parseSpriteMap(json: unknown): Record<string, { offset: number; duration: number }> {
  const out: Record<string, { offset: number; duration: number }> = {}
  const sprite = (json as any)?.sprite
  if (!sprite || typeof sprite !== 'object') return out
  for (const [k, v] of Object.entries(sprite as Record<string, unknown>)) {
    if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number') {
      out[k] = { offset: v[0] / 1000, duration: v[1] / 1000 }
    }
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/audio/load.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/audio/load.ts tests/audio/load.test.ts
git commit -m "feat(audio): audio buffer + sprite-map loader"
```

---

### Task 8: Sample playback path in Sfx (sprite-backed, procedural fallback)

**Files:**
- Modify: `src/audio/Sfx.ts` (add sprite load + slice playback; keep procedural as fallback)

**Interfaces:**
- Consumes: `loadAudioBuffer`, `parseSpriteMap` (Task 7); `RoundRobin` (Task 1).
- Produces: new `async loadSamples(opusUrl: string, jsonUrl: string): Promise<void>` on `Sfx`;
  when loaded, public methods play sprite slices, else fall back to existing synth.

- [ ] **Step 1: Implement sprite playback with fallback**

Add to the `Sfx` class (fields + methods); keep all existing procedural methods as the fallback path:

```ts
  // sprite state (empty until loadSamples resolves)
  private buffer: AudioBuffer | null = null
  private sprite: Record<string, { offset: number; duration: number }> = {}
  private rr = new Map<string, import('./variation').RoundRobin<string>>()

  async loadSamples(opusUrl: string, jsonUrl: string): Promise<void> {
    const { loadAudioBuffer, parseSpriteMap } = await import('./load')
    const { RoundRobin } = await import('./variation')
    const [buf, mapJson] = await Promise.all([
      loadAudioBuffer(this.bus.context, opusUrl),
      fetch(jsonUrl).then(r => r.json()),
    ])
    this.buffer = buf
    this.sprite = parseSpriteMap(mapJson)
    // group sprite keys like 'shoot1','shoot2' under base name 'shoot'
    const groups = new Map<string, string[]>()
    for (const k of Object.keys(this.sprite)) {
      const base = k.replace(/\d+$/, '')
      ;(groups.get(base) ?? groups.set(base, []).get(base)!).push(k)
    }
    for (const [base, keys] of groups) this.rr.set(base, new RoundRobin(keys))
  }

  // play a sprite slice for `base` with pitch/volume variation; return true if played
  private playSample(base: string, vol = 1): boolean {
    const picker = this.rr.get(base)
    if (!this.buffer || !picker) return false
    const key = picker.next()
    const slice = this.sprite[key]
    if (!slice) return false
    if (!this.vl.request(base, this.now())) return true // limited, but "handled"
    const ctx = this.bus.context, t = ctx.currentTime
    const src = ctx.createBufferSource(); src.buffer = this.buffer
    src.playbackRate.value = semitoneToRate(randRange(-1.5, 1.5))
    const g = ctx.createGain(); g.gain.value = vol * randRange(0.7, 1.0)
    src.connect(g).connect(this.bus.sfxOut)
    src.start(t, slice.offset, slice.duration)
    src.onended = () => this.vl.release(base)
    return true
  }
```

Then make each public method try the sample first, fall back to synth. Example for `shoot`/`hit` (apply the same `if (this.playSample(...)) return` guard to the others):

```ts
  shoot() { if (this.playSample('shoot', 0.5)) return; this.blip('shoot', 660, 0.08, 'square', 0.05, 240) }
  hit() { if (this.playSample('hit', 0.6)) return; this.blip('hit', 320, 0.06, 'sawtooth', 0.07, 150); this.noise('hit', 0.04, 0.04) }
  death() { if (this.playSample('death', 0.8)) return; this.noise('death', 0.22, 0.14, 4, 25) }
  build() { if (this.playSample('build', 0.8)) return; this.blip('build', 440, 0.1, 'triangle', 0.12, 880, 3, 60) }
  deny() { if (this.playSample('deny', 0.8)) return; this.blip('deny', 160, 0.16, 'square', 0.1, undefined, 2, 120) }
  heroHurt() { if (this.playSample('heroHurt', 0.9)) return; this.blip('heroHurt', 200, 0.2, 'sawtooth', 0.14, 70, 2, 120) }
  waveStart() { if (this.playSample('waveStart', 0.9)) return; this.blip('waveStart', 330, 0.12, 'triangle', 0.12, 520, 1, 200); this.blip('waveStart2', 495, 0.18, 'triangle', 0.08, 660, 1, 200) }
```

- [ ] **Step 2: Wire load call in main.ts (after unlock)**

In `src/main.ts` near `audio.unlock(); music.start()` (~main.ts:896), add (fire-and-forget; fallback covers the gap before it resolves):

```ts
  void sfx.loadSamples('/audio/sfx.opus', '/audio/sfx.json')
```

- [ ] **Step 3: Typecheck + run suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Manual browser verify**

With assets in `public/audio/`, run `npm run dev`. Expected: real SFX play with per-shot variation; with assets removed, game still plays procedural SFX (no errors in console).

- [ ] **Step 5: Commit**

```bash
git add src/audio/Sfx.ts src/main.ts
git commit -m "feat(audio): sprite-backed SFX with procedural fallback"
```

---

# PHASE 2 — Layered music stems (core "more real" win)

> **REQUIRED before activating `duck()` (Phase 0 final-review finding #1/#2):**
> `Sfx.duck()` currently writes `bus.musicOut.gain` directly, the same AudioParam
> `AudioBus.apply()` writes on every `setVolume('music')`/mute. Two owners of one
> param → a slider/mute during a duck clobbers it. This is dormant in Phase 0
> (no `duck()` callsite). When Task 10 rewrites `Music`, insert a **dedicated
> `duckGain` node** between the stem/layer outputs and `bus.musicOut`, and change
> `Sfx.duck()` to ramp `duckGain.gain` (target = duck multiplier `0.45`→`1`),
> NOT `musicOut.gain`. Then `apply()` solely owns `musicBus.gain` and `duck()`
> solely owns `duckGain.gain` — no shared param, and `duck()` no longer needs to
> read `getVolume('music')` (so mute becomes orthogonal). Expose the node from
> `Music` (e.g. `Music.duckGain` or a `bus.duckOut`) for `Sfx` to target. Wire
> the boss-spawn `duck()` callsite in `main.ts` only after this is in place.

> **PREREQUISITE (manual, user):** Source 3 intensity stems sharing tempo/length/loop points (commissioned, or single-author CC e.g. Incompetech with credits). Export each to Opus: `ffmpeg -i base.wav -af loudnorm=I=-18:TP=-1:LRA=11 -ar 48000 -c:a libopus -b:a 96k public/audio/music/base.opus` (repeat for `drive.opus`, `boss.opus`). Loops must be sample-trimmed to a bar boundary (no MP3). Log in `docs/audio-credits.md`. If stems aren't ready, **skip Phase 2** — procedural music remains.

### Task 9: Intensity → stem-gain mapping (pure)

**Files:**
- Create: `src/audio/intensity.ts`
- Test: `tests/audio/intensity.test.ts`

**Interfaces:**
- Produces:
  - `type MusicState = 'calm' | 'tense' | 'boss'`
  - `type StemName = 'base' | 'drive' | 'boss'`
  - `const STEMS: StemName[]`
  - `stemGains(state: MusicState): Record<StemName, number>` — vertical layering:
    base always present; drive adds at tense; boss adds at boss. Off = `0.0001` (ramp floor).

- [ ] **Step 1: Write the failing test**

```ts
// tests/audio/intensity.test.ts
import { describe, it, expect } from 'vitest'
import { stemGains, STEMS } from '../../src/audio/intensity'

describe('stemGains (vertical layering)', () => {
  it('calm: only base audible', () => {
    const g = stemGains('calm')
    expect(g.base).toBeGreaterThan(0.1)
    expect(g.drive).toBeLessThan(0.01)
    expect(g.boss).toBeLessThan(0.01)
  })
  it('tense: base + drive audible, boss silent', () => {
    const g = stemGains('tense')
    expect(g.base).toBeGreaterThan(0.1)
    expect(g.drive).toBeGreaterThan(0.1)
    expect(g.boss).toBeLessThan(0.01)
  })
  it('boss: all three audible', () => {
    const g = stemGains('boss')
    expect(g.base).toBeGreaterThan(0.05)
    expect(g.drive).toBeGreaterThan(0.1)
    expect(g.boss).toBeGreaterThan(0.1)
  })
  it('STEMS lists every stem the map returns', () => {
    for (const s of STEMS) expect(stemGains('boss')[s]).toBeTypeOf('number')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/audio/intensity.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
// src/audio/intensity.ts
// Vertical-layering map: each game intensity state -> per-stem gain. base is the
// always-on pad; drive adds for waves; boss adds for the finale. 0.0001 = the
// Web Audio exponential-ramp floor (can't ramp to a true 0).
export type MusicState = 'calm' | 'tense' | 'boss'
export type StemName = 'base' | 'drive' | 'boss'
export const STEMS: StemName[] = ['base', 'drive', 'boss']
const OFF = 0.0001

export function stemGains(state: MusicState): Record<StemName, number> {
  switch (state) {
    case 'calm':  return { base: 0.5, drive: OFF, boss: OFF }
    case 'tense': return { base: 0.4, drive: 0.5, boss: OFF }
    case 'boss':  return { base: 0.3, drive: 0.5, boss: 0.6 }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/audio/intensity.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/audio/intensity.ts tests/audio/intensity.test.ts
git commit -m "feat(audio): intensity->stem-gain mapping for layered music"
```

---

### Task 10: Rewrite Music to layered stems (procedural fallback)

**Files:**
- Modify: `src/audio/Music.ts` (whole class — keep `start`/`setState`/`silence`)

**Interfaces:**
- Consumes: `MusicState`/`StemName`/`STEMS`/`stemGains` (Task 9), `loadAudioBuffer` (Task 7).
- Produces: unchanged method shapes; `setState` accepts `'boss'`. `start` triggers async stem
  load; until stems resolve, the existing procedural layers play (no silence gap).

- [ ] **Step 1: Implement layered Music with procedural fallback**

Replace `src/audio/Music.ts` with:

```ts
import { AudioBus } from './AudioBus'
import { MusicState, StemName, STEMS, stemGains } from './intensity'
import { loadAudioBuffer } from './load'

export type { MusicState }

// Background music. Preferred path: N decoded Opus stems, all started phase-locked
// and looped; setState ramps each stem's gain by intensity (vertical layering).
// Until stems load (or if absent), a procedural fallback (the original calm/tense
// oscillator layers) plays so there's never a silent gap.
export class Music {
  private started = false
  private state: MusicState = 'calm'
  // stem path
  private stemGainNodes = new Map<StemName, GainNode>()
  private stemsReady = false
  // fallback path
  private calmGain?: GainNode
  private tenseGain?: GainNode

  constructor(private bus: AudioBus, private baseUrl = '/audio/music') {}

  start(): void {
    if (this.started) return
    this.started = true
    this.startFallback()        // immediate sound
    void this.startStems()      // swap in when ready
  }

  private startFallback(): void {
    const ctx = this.bus.context
    this.calmGain = ctx.createGain(); this.calmGain.gain.value = 0.0001; this.calmGain.connect(this.bus.musicOut)
    this.tenseGain = ctx.createGain(); this.tenseGain.gain.value = 0.0001; this.tenseGain.connect(this.bus.musicOut)
    this.buildLayer(ctx, [110, 164.81, 220, 261.63], 'sine', this.calmGain, 0.5, 0.12, 0.25)
    this.buildLayer(ctx, [55, 82.41, 110], 'sawtooth', this.tenseGain, 0.4, 2.2, 0.5)
    this.applyFallback(true)
  }

  private buildLayer(ctx: AudioContext, freqs: number[], type: OscillatorType, outer: GainNode, base: number, lfoFreq: number, lfoDepth: number): void {
    const inner = ctx.createGain(); inner.gain.value = base; inner.connect(outer)
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 1 / freqs.length
      o.connect(g).connect(inner); o.start()
    }
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = lfoFreq
    const depth = ctx.createGain(); depth.gain.value = lfoDepth
    lfo.connect(depth).connect(inner.gain); lfo.start()
  }

  private async startStems(): Promise<void> {
    const ctx = this.bus.context
    try {
      const bufs = await Promise.all(STEMS.map(s => loadAudioBuffer(ctx, `${this.baseUrl}/${s}.opus`)))
      const startAt = ctx.currentTime + 0.1
      STEMS.forEach((s, i) => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.bus.musicOut)
        const src = ctx.createBufferSource(); src.buffer = bufs[i]; src.loop = true
        src.connect(g); src.start(startAt)
        this.stemGainNodes.set(s, g)
      })
      this.stemsReady = true
      this.fadeFallback(0.0001) // retire procedural layers
      this.applyStems(false)
    } catch {
      // assets absent → keep procedural fallback; not an error
    }
  }

  setState(s: MusicState, immediate = false): void {
    this.state = s
    if (!this.started) return
    if (this.stemsReady) this.applyStems(immediate)
    else this.applyFallback(immediate)
  }

  private applyStems(immediate: boolean): void {
    const ctx = this.bus.context, t = ctx.currentTime, tc = immediate ? 0.01 : 1.2
    const gains = stemGains(this.state)
    for (const s of STEMS) this.stemGainNodes.get(s)?.gain.setTargetAtTime(gains[s], t, tc)
  }

  private applyFallback(immediate: boolean): void {
    const ctx = this.bus.context, t = ctx.currentTime, tc = immediate ? 0.01 : 1.2
    // fallback has no boss layer → treat 'boss' as 'tense'
    const tense = this.state !== 'calm'
    this.calmGain?.gain.setTargetAtTime(tense ? 0.0001 : 0.5, t, tc)
    this.tenseGain?.gain.setTargetAtTime(tense ? 0.5 : 0.0001, t, tc)
  }

  private fadeFallback(to: number): void {
    const ctx = this.bus.context, t = ctx.currentTime
    this.calmGain?.gain.setTargetAtTime(to, t, 1.0)
    this.tenseGain?.gain.setTargetAtTime(to, t, 1.0)
  }

  silence(): void {
    if (!this.started) return
    const ctx = this.bus.context, t = ctx.currentTime
    this.fadeFallback(0.0001)
    for (const g of this.stemGainNodes.values()) g.gain.setTargetAtTime(0.0001, t, 0.8)
  }
}
```

- [ ] **Step 2: Typecheck + run suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS (intensity logic covered by Task 9; Music wiring is manual).

- [ ] **Step 3: (Optional) wire boss state in main.ts**

In `src/main.ts`, on boss spawn (search the boss-finale wave path), call `music.setState('boss')`; restore `music.setState('tense')`/`'calm'` as today. `'calm'`/`'tense'` callsites are unchanged.

- [ ] **Step 4: Manual browser verify**

With stems in `public/audio/music/`, run `npm run dev`. Expected: real music plays, loops seamlessly (no gap at loop point), layers fade in/out across build→wave→boss; remove stems → procedural music still plays with no console error.

- [ ] **Step 5: Commit**

```bash
git add src/audio/Music.ts src/main.ts
git commit -m "feat(audio): layered Opus music stems with procedural fallback"
```

---

# PHASE 3 — Polish

### Task 11: Credits file + bundle/loudness verification

**Files:**
- Create: `docs/audio-credits.md`

**Interfaces:** none (docs + verification only).

- [ ] **Step 1: Write the credits file**

```md
# Audio Credits & Licenses

| Asset | File | Source (URL) | License | Attribution required |
|-------|------|--------------|---------|----------------------|
| (example) shoot | public/audio/sfx.opus | https://kenney.nl/... | CC0 | No |
| (example) base stem | public/audio/music/base.opus | https://incompetech.com/... | CC-BY 4.0 | Yes (see below) |

## Required attribution strings
- (paste each CC-BY credit line here, shown on the in-game credits screen)
```

- [ ] **Step 2: Verify bundle size budget**

Run: `du -ch public/audio/**/*.opus public/audio/*.opus 2>/dev/null | tail -1`
Expected: total ≤ 12 MB (target 5–12). If over, drop music bitrate to 80k or shorten loops.

- [ ] **Step 3: Verify loudness of a music stem (optional, needs ffmpeg)**

Run: `ffmpeg -i public/audio/music/base.opus -af ebur128 -f null - 2>&1 | tail -5`
Expected: integrated loudness near −18 LUFS. Re-run `loudnorm` if far off.

- [ ] **Step 4: Final full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all green; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add docs/audio-credits.md
git commit -m "docs(audio): asset credits + license log"
```

---

## Self-Review notes

- **Spec coverage:** §3 limiter→Task 4/5; §4.1 AudioBus→Task 5; §4.2 Sfx variation/voice/duck→Tasks 1-3,6; §4.2 sample SFX→Tasks 7-8; §4.3 layered music→Tasks 9-10; §5 asset pipeline→Phase 1/2 prereqs + Task 11; §7 testing→pure-module tests each task. All covered.
- **Type consistency:** `MusicState` defined once in `intensity.ts`, re-exported from `Music.ts`; `StemName`/`STEMS`/`stemGains` consistent across Tasks 9-10; `VoiceLimiter.request/release`, `DuckController.push/pop`, `RoundRobin.next`, `semitoneToRate`/`randRange`, `loadAudioBuffer`/`parseSpriteMap`, `buildMasterChain`/`makeSoftClipCurve` names match across consuming tasks.
- **No placeholders:** all code steps contain full code; asset *content* (the actual sound files) is an explicit manual prerequisite, with procedural fallbacks so every phase runs without them.
- **Phasing:** Phase 0 is fully executable now; Phases 1-2 are code-complete but gated on user-sourced assets (fallbacks keep the game working meanwhile); Phase 3 is verification/docs.
