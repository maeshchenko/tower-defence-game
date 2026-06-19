import { Scene, ParticleSystem, DynamicTexture, Color4, Vector3 } from '@babylonjs/core'

export type BurstKind = 'muzzle' | 'impact' | 'death'

// a soft radial sprite, drawn once and shared by every burst (cheap, no asset file)
let sprite: DynamicTexture | null = null
function getSprite(scene: Scene): DynamicTexture {
  if (sprite) return sprite
  const S = 64
  const t = new DynamicTexture('fxSprite', { width: S, height: S }, scene, false)
  const ctx = t.getContext() as CanvasRenderingContext2D
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
  t.update()
  t.hasAlpha = true
  sprite = t
  return t
}

interface BurstCfg { count: number; size: [number, number]; speed: number; life: [number, number]; spread: number }
const CFG: Record<BurstKind, BurstCfg> = {
  muzzle: { count: 12, size: [0.12, 0.3], speed: 4, life: [0.06, 0.16], spread: 1.2 },
  impact: { count: 16, size: [0.1, 0.28], speed: 5, life: [0.08, 0.2], spread: 2.5 },
  death: { count: 34, size: [0.15, 0.45], speed: 6, life: [0.18, 0.4], spread: 3 },
}

// fire a one-shot particle burst at (x,y,z) tinted to `color` ({r,g,b} in 0..1).
// The system self-disposes once its particles fade.
export function burst(scene: Scene, kind: BurstKind, x: number, y: number, z: number, color: { r: number; g: number; b: number }): void {
  const c = CFG[kind]
  const ps = new ParticleSystem('fx_' + kind, c.count, scene)
  ps.particleTexture = getSprite(scene)
  ps.emitter = new Vector3(x, y, z)
  ps.minEmitBox = new Vector3(0, 0, 0); ps.maxEmitBox = new Vector3(0, 0, 0)
  ps.color1 = new Color4(color.r, color.g, color.b, 1)
  ps.color2 = new Color4(Math.min(1, color.r + 0.3), Math.min(1, color.g + 0.3), Math.min(1, color.b + 0.2), 1)
  ps.colorDead = new Color4(color.r, color.g, color.b, 0)
  ps.minSize = c.size[0]; ps.maxSize = c.size[1]
  ps.minLifeTime = c.life[0]; ps.maxLifeTime = c.life[1]
  ps.emitRate = c.count / c.life[0] // empty the budget fast → looks like a burst
  ps.blendMode = ParticleSystem.BLENDMODE_ADD
  ps.gravity = new Vector3(0, kind === 'death' ? -2 : 0, 0)
  ps.direction1 = new Vector3(-c.spread, -c.spread * 0.3, -c.spread)
  ps.direction2 = new Vector3(c.spread, c.spread, c.spread)
  ps.minEmitPower = c.speed * 0.4; ps.maxEmitPower = c.speed
  ps.updateSpeed = 0.02
  ps.targetStopDuration = c.life[0] // stop emitting almost immediately
  ps.disposeOnStop = true
  ps.start()
}
