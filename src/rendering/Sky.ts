import {
  Scene, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Texture, Mesh,
  TransformNode, Vector3,
} from '@babylonjs/core'

const ZENITH = '#6aa6e0'   // bright day blue overhead (not dusk)
const HORIZON = '#dceaf4'  // pale haze at the horizon

// Pure: evenly distribute `count` clouds on a horizontal ring (below the island).
export function cloudRingPositions(count: number, radius: number, y: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    out.push({ x: Math.cos(a) * radius, y, z: Math.sin(a) * radius })
  }
  return out
}

export class Sky {
  readonly horizonColor = Color3.FromHexString(HORIZON)
  private dome: Mesh
  private cloudRoot: TransformNode | null = null
  private farRoot: TransformNode | null = null

  constructor(scene: Scene) {
    const tex = new DynamicTexture('skyGrad', { width: 8, height: 256 }, scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, ZENITH)
    g.addColorStop(1, HORIZON)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 8, 256)
    tex.update()
    tex.wrapV = Texture.CLAMP_ADDRESSMODE

    const mat = new StandardMaterial('skyMat', scene)
    mat.emissiveTexture = tex
    mat.disableLighting = true
    mat.backFaceCulling = false
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.specularColor = new Color3(0, 0, 0)

    // large dome; BACKSIDE so we see it from inside
    this.dome = MeshBuilder.CreateSphere('skyDome', { diameter: 600, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene)
    this.dome.material = mat
    this.dome.isPickable = false
    this.dome.infiniteDistance = true // follows the camera; always at the horizon
    this.dome.applyFog = false
  }

  // soft drifting cloud billboards around/below the island (0 = off)
  setClouds(count: number): void {
    this.cloudRoot?.dispose(false, true)
    this.cloudRoot = null
    if (count <= 0) return
    const scene = this.dome.getScene()
    // soft round cloud sprite via radial-alpha DynamicTexture
    const tex = new DynamicTexture('cloudTex', { width: 128, height: 64 }, scene, false)
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const grad = ctx.createRadialGradient(64, 32, 4, 64, 32, 50)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 64)
    tex.update()
    tex.hasAlpha = true
    const mat = new StandardMaterial('cloudMat', scene)
    mat.emissiveTexture = tex
    mat.opacityTexture = tex
    mat.disableLighting = true
    mat.backFaceCulling = false
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.specularColor = new Color3(0, 0, 0)

    const root = new TransformNode('clouds', scene)
    const positions = cloudRingPositions(count, 90, -6)
    positions.forEach((p, i) => {
      const plane = MeshBuilder.CreatePlane(`cloud${i}`, { width: 22 + (i % 3) * 8, height: 11 + (i % 2) * 4 }, scene)
      plane.material = mat
      plane.position = new Vector3(p.x, p.y - (i % 4), p.z)
      plane.billboardMode = 7 // BILLBOARDMODE_ALL
      plane.isPickable = false
      plane.applyFog = true
      plane.parent = root
    })
    this.cloudRoot = root
  }

  // distant floating-island silhouettes on the horizon — depth for third-person
  setDistantIslands(enabled: boolean): void {
    this.farRoot?.dispose(false, true)
    this.farRoot = null
    if (!enabled) return
    const scene = this.dome.getScene()
    const mat = new StandardMaterial('farIsleMat', scene)
    // unlit flat haze silhouette (no sun hotspot, no cloud backlight glow); fog finishes the fade
    mat.disableLighting = true
    mat.diffuseColor = new Color3(0, 0, 0)
    mat.emissiveColor = this.horizonColor.scale(0.82) // slightly darker than the horizon haze
    mat.specularColor = new Color3(0, 0, 0)
    const root = new TransformNode('farIslands', scene)
    // keep them low so only distant land sits at the horizon, never a slab floating mid-sky
    const spec = [
      { a: 0.6, r: 150, y: -16, s: 26 }, { a: 1.9, r: 170, y: -10, s: 34 },
      { a: 3.3, r: 140, y: -20, s: 22 }, { a: 4.7, r: 185, y: -8, s: 40 },
      { a: 5.6, r: 160, y: -14, s: 30 },
    ]
    spec.forEach((m, i) => {
      const isle = MeshBuilder.CreateCylinder(`farIsle${i}`,
        { diameterTop: m.s, diameterBottom: m.s * 0.5, height: m.s * 0.7, tessellation: 6 }, scene)
      isle.material = mat
      isle.position = new Vector3(Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r)
      isle.rotation.y = Math.PI / 6
      isle.isPickable = false
      isle.applyFog = true // fades into the horizon haze
      isle.parent = root
    })
    this.farRoot = root
  }

  update(dt: number): void {
    if (this.cloudRoot) this.cloudRoot.rotation.y += dt * 0.01 // slow drift
  }

  dispose(): void {
    this.cloudRoot?.dispose(false, true)
    this.farRoot?.dispose(false, true)
    this.dome.material?.dispose()
    this.dome.dispose()
  }
}
