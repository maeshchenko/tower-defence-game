// Pure camera-preset math (no Babylon) so it unit-tests.

// Fixed iso tilt: high enough to read the board, low enough to feel 3D (not top-down).
export const ISO_BETA = 0.95

// Four diagonal corner views of a square map, a quarter-turn apart.
export const PRESET_ALPHAS = [
  Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4,
]

// Target alpha one preset step away in `dir`, expressed relative to `current`
// so easeAlpha takes a clean 90deg arc (no 2pi wrap jump).
export function nextPresetAlpha(current: number, dir: 1 | -1): number {
  return current + dir * (Math.PI / 2)
}

// Shortest-arc angular difference in (-pi, pi].
function shortDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

// Exponential ease of an angle toward target along the short arc.
export function easeAlpha(current: number, target: number, dt: number, rate = 8): number {
  const d = shortDelta(current, target)
  const k = 1 - Math.exp(-rate * dt)
  return current + d * k
}
