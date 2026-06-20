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
  shaper.curve = makeSoftClipCurve() as Float32Array<ArrayBuffer>
  shaper.oversample = '4x'
  input.connect(comp)
  comp.connect(shaper)
  return shaper
}
