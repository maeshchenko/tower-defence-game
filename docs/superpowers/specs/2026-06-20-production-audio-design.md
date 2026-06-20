# Production-Ready Audio — Design Spec

Date: 2026-06-20
Project: tower-defence-game (Babylon.js `@babylonjs/core ^9.13`, Vite, TypeScript, Vitest)
Status: Approved direction — Hybrid (Path A)

## 1. Problem

Current audio is 100% procedural Web Audio (`src/audio/`). Music is two oscillator
layers (calm pad / tense sawtooth) that crossfade by game phase; SFX are seven
oscillator blips + noise bursts. The user likes the procedural *texture* but the
music "sounds like one sound" — it lacks drums, melody, chord movement, and real
timbre because sustained oscillators + an LFO are the ceiling of cheap synthesis.
Goal: production-ready audio that keeps the existing aesthetic.

The existing architecture is the right foundation and does NOT get rewritten:
`AudioBus` already routes master → {music, sfx} → destination, persists volumes to
localStorage, and handles autoplay unlock. We swap sound *sources*, not the plumbing.

### Current files
- `src/audio/AudioBus.ts` — 3-bus mixer, volume persistence, lazy ctx, unlock.
- `src/audio/Music.ts` — calm/tense procedural layers, `setState` crossfade, `silence`.
- `src/audio/Sfx.ts` — `blip`/`noise` synth + 7 public SFX methods.
- `src/main.ts` — instantiates bus/sfx/music; triggers SFX + music state by events.
- `src/ui/Settings.ts` — volume sliders + mute.
- `tests/audio/AudioBus.test.ts` — unit tests.

## 2. Chosen direction: Hybrid (Path A)

Keep procedural SFX (snappy, zero-latency, infinitely variable — good practice for
TD) but upgrade them with variation + voice limiting; replace *music* with real
produced loop **stems** mixed by vertical layering. This delivers the "more real"
music the user wants while keeping the SFX texture they like, at modest bundle cost
(~2–6 MB).

Rejected:
- **Path B (full produced assets):** max polish but loses SFX variety, heaviest
  bundle (+5–15 MB), most sourcing work. Not worth it for a TD's rapid-fire SFX.
- **Path C (richer procedural only):** stays 0-asset but caps below real-instrument
  realism — still "synth", which is exactly what the user wants to move past for music.

Note: Phase 1 below optionally moves SFX to samples too (a step toward B). It is
included as opt-in; the default hybrid keeps procedural SFX and ships Phases 0 + 2.

## 3. Technical decisions (researched, 2026)

- **No new audio library.** Keep raw `AudioBus`. Howler.js is frozen (~2021) with
  known seamless-loop bugs; Tone.js only pays off for bar-quantized section swaps
  (horizontal re-sequencing), which we don't need; FMOD/Wwise have no real web SDK.
- **Music = vertical layering.** Multiple stems (identical tempo/length/loop points),
  all started at one shared `ctx.currentTime + ε` so they stay phase-locked, then
  fade each stem's gain in/out by intensity. Direct evolution of the current
  calm/tense crossfade — N stems instead of 2 oscillator groups.
- **Format = Opus (`.opus`).** Best web codec in 2026, ~96% support (Safari fixed in
  18.4, Mar 2025), gapless looping. Music 96 kbps stereo (~0.7 MB/min); SFX 64 kbps
  mono. Single MP3 128k fallback only if old-Safari support is required (select via
  `canPlayType`). Never MP3 for loops — encoder padding breaks seamless looping.
- **Decode short, stream long.** Decoded PCM ≈ 23 MB/min stereo resident. Decode
  SFX and music loops < ~45 s to `AudioBuffer` (gapless looping for free); only
  stream genuinely long tracks via `MediaElementAudioSourceNode`. TD loops are short
  → decode them.
- **Vite assets.** `import url from './x.opus'` (or `new URL(..., import.meta.url)`)
  so Vite hashes/cache-busts; lazy-load per level via `fetch` + `decodeAudioData`.

## 4. Component design

### 4.1 AudioBus (mixing safety)
Insert a master limiter chain and headroom; everything else unchanged.

```
... musicBus ┐
   sfxBus  ──┼─► master (≈ -6 dB) ─► DynamicsCompressor ─► WaveShaper(soft-clip) ─► destination
```

- DynamicsCompressor as safety limiter: `threshold -3, knee 0, ratio 20,
  attack 0.003, release 0.05`. (Max ratio 20:1, no lookahead — glue/safety, not a
  guaranteed brickwall.)
- WaveShaper soft-clip backstop: `tanh` curve, `oversample: '4x'`.
- Drop nominal master gain to leave headroom.
- Add `visibilitychange` → `resume()` (browsers suspend hidden tabs).
- Public API unchanged; `musicOut`/`sfxOut` still return the same bus gains.

### 4.2 Sfx (variation + voice limiting)
Keep the public method names (`shoot`, `hit`, `death`, `build`, `deny`, `heroHurt`,
`waveStart`) so `main.ts` callsites don't change.

- **Variation:** per-play pitch ±1–2 semitones (`playbackRate = 2^(n/12)` or
  `detune` ±100–200 cents) and volume −3..0 dB (gain 0.7–1.0).
- **Round-robin:** when samples are used, 3–5 variants per sound with a
  no-immediate-repeat guard. (Procedural variants = randomized synth params.)
- **Voice limiting:** per-sound max concurrent instances (~4–8 for tower shots),
  steal oldest/release-phase voice over cap, **coalesce same-frame triggers** (10
  towers firing → one instance, optionally louder/pitch-varied), ~40 ms retrigger
  cooldown per sound.
- **Optional spatialization:** `StereoPannerNode` per source from screen-x (fixed
  top-down camera — cheap pan is enough; no need for `PannerNode`/Babylon engine).
- **Ducking helper:** `duck(amountDb, attackMs, releaseMs)` ramps `bus.musicOut`
  for big events only (boss spawn, wave clear) — NOT per shot. Reference-count so
  overlapping ducks don't stutter.

### 4.3 Music (layered stems)
Keep `start` / `setState` / `silence` shape. Extend `MusicState` to include `'boss'`.

- Decode 3 stems (calm / tense / boss) sharing tempo/length/loop points.
- One `AudioBufferSourceNode` per stem → its own `GainNode` → `bus.musicOut`,
  `loop = true`, all started at one shared `startAt = ctx.currentTime + 0.1`.
- `setState(intensity)` ramps per-stem gains (reuse the `0.0001` floor + ramp idiom
  already in the file; `exponentialRamp` can't hit 0).
- `silence()` ramps all stems down (unchanged behavior).
- Lazy-load stems per level via fetch + decode; tolerate not-yet-loaded (fall back
  to silence/procedural until ready).

## 5. Asset pipeline

- **Sources (commercial-safe):** Kenney CC0 (SFX base) + ElevenLabs paid (custom
  SFX, lowest AI legal risk) + one human composer OR single-author CC catalog
  (Incompetech / Soundimage, with a credits screen) for music stems.
- **Avoid:** Suno (active RIAA litigation, no indemnity). Note pure AI-generated
  audio is not copyrightable (US Copyright Office, Jan 2025) — commission human
  music if the soundtrack must be legally defensible. Specify **stem** delivery
  (not stereo masters) so vertical layering is possible.
- **Encode:** Opus — music 96k stereo, SFX 64k mono, `-ar 48000`.
- **Normalize:** ffmpeg two-pass `loudnorm=I=-18:TP=-1:LRA=11` (target ~-18..-16
  LUFS integrated, -1 dBTP). For very short SFX normalize to peak/short-term, not
  integrated.
- **SFX bundling:** `audiosprite` → one Opus file + JSON offset map; decode once to
  a single `AudioBuffer`, play slices via `start(when, offset, duration)`.
- **Credits file:** log each asset's source URL + license + required attribution.
- **Budget:** total audio ~5–12 MB compressed.

## 6. Phased plan

**Phase 0 — Mixing safety + SFX variety (no assets).**
- AudioBus: limiter + soft-clip chain, headroom, `visibilitychange` resume.
- Sfx: pitch/volume randomization + voice-limiting/coalescing + `duck()`.
- Immediate quality win before any files; lowest risk.

**Phase 1 — Sample-based SFX (optional, toward Path B).**
- Source/encode SFX sprite; rewrite `Sfx` methods to play sprite slices with
  round-robin + randomization + optional pan. Public API unchanged.

**Phase 2 — Layered music (the core "more real" win).**
- Source 3 intensity stems + asset pipeline (Opus, normalize).
- Rewrite `Music` to decode stems, shared-start, gain-ramp by intensity; extend
  state with `'boss'`; lazy-load per level; `duck()` integration.

**Phase 3 — Polish.**
- Ducking on big events, per-level music variation, credits file, bundle-size
  check (5–12 MB), loudness verification.

## 7. Testing
- Keep `tests/audio/`; preserve public APIs (`AudioBus`, `Music`, `Sfx`) so
  `main.ts` / `Settings.ts` need minimal change.
- Unit-test new pure logic: voice-limit/coalesce decision, intensity→gain mapping,
  round-robin no-repeat guard, duck reference-count. (Web Audio nodes mocked as in
  existing AudioBus test.)
- Manual: seamless loop check (no gap at loop point), no clipping with many stacked
  SFX, duck audible on boss spawn, autoplay unlock + tab-return resume.

## 8. Out of scope
- Adopting Babylon v9 audio engine, Howler, Tone.js, FMOD/Wwise.
- Horizontal re-sequencing (bar-quantized section swaps).
- HRTF / full 3D positional audio (fixed top-down camera → stereo pan suffices).
- Voice/dialogue.
