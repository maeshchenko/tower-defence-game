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
