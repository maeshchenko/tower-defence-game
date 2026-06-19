export type QualityPreset = 'low' | 'med' | 'high'

export interface QualityConfig {
  preset: QualityPreset
  fxaa: boolean
  bloom: boolean
  shadows: boolean
  shadowMapSize: number // 0 when shadows off
  ssao: boolean
  glow: boolean
  fog: boolean
}

export type MiniStorage = { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const QUALITY_ORDER: QualityPreset[] = ['low', 'med', 'high']
const STORAGE_KEY = 'td.quality'

export function resolveQuality(preset: QualityPreset): QualityConfig {
  const base = { preset, fxaa: true, glow: true, fog: true }
  switch (preset) {
    case 'low': return { ...base, bloom: false, shadows: false, shadowMapSize: 0, ssao: false }
    case 'high': return { ...base, bloom: true, shadows: true, shadowMapSize: 2048, ssao: true }
    case 'med':
    default: return { ...base, preset: 'med', bloom: true, shadows: true, shadowMapSize: 1024, ssao: false }
  }
}

export function nextPreset(p: QualityPreset): QualityPreset {
  const i = QUALITY_ORDER.indexOf(p)
  return QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length]
}

function getStore(s?: MiniStorage): MiniStorage | undefined {
  if (s) return s
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' && typeof localStorage.setItem === 'function') {
      return localStorage
    }
  } catch { }
  return undefined
}

export function loadPreset(storage?: MiniStorage): QualityPreset {
  const s = getStore(storage)
  const v = s?.getItem(STORAGE_KEY)
  return v === 'low' || v === 'med' || v === 'high' ? v : 'med'
}

export function savePreset(p: QualityPreset, storage?: MiniStorage): void {
  const s = getStore(storage)
  try { s?.setItem(STORAGE_KEY, p) } catch { /* storage unavailable — ignore */ }
}
