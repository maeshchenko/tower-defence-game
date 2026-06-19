// src/rendering/Environment.ts
import {
  Scene, DirectionalLight, HemisphericLight, ShadowGenerator, GlowLayer,
  DefaultRenderingPipeline, SSAO2RenderingPipeline, ImageProcessingConfiguration,
  Vector3, Color3, Color4, AbstractMesh, TransformNode,
} from '@babylonjs/core'
import { QualityConfig } from './Quality'

const SKY = new Color3(0.49, 0.67, 0.86) // toon sky blue; reused for clear + fog

export class Environment {
  readonly sun: DirectionalLight
  private pipeline: DefaultRenderingPipeline
  private glow: GlowLayer | null = null
  private shadowGen: ShadowGenerator | null = null
  private ssao: SSAO2RenderingPipeline | null = null
  private casters: TransformNode[] = []
  private receivers: AbstractMesh[] = []

  constructor(private scene: Scene, private fill: HemisphericLight, cfg: QualityConfig) {
    // warm directional sun (key light) — angled for short, readable shadows
    // ~45° rake so casters throw a clear, object-length shadow (reads as a real sun)
    this.sun = new DirectionalLight('sun', new Vector3(-0.45, -0.7, -0.5), scene)
    this.sun.position = new Vector3(30, 42, 30)
    this.sun.intensity = 1.15
    this.sun.diffuse = new Color3(1, 0.96, 0.86)
    // matte/toon: near-zero specular so surfaces don't show a blinding sun hotspot
    this.sun.specular = new Color3(0.05, 0.05, 0.05)

    // hemi becomes cool ambient fill so shadows aren't pure black
    this.fill.intensity = 0.35
    this.fill.diffuse = new Color3(0.85, 0.9, 1)
    this.fill.groundColor = new Color3(0.35, 0.4, 0.3)
    this.fill.specular = new Color3(0, 0, 0)

    // sky + fog for depth
    scene.clearColor = new Color4(SKY.r, SKY.g, SKY.b, 1)
    scene.fogColor = SKY.clone()

    // post: HDR pipeline over all cameras (top + hero)
    this.pipeline = new DefaultRenderingPipeline('default', true, scene, scene.cameras)
    const ip = this.pipeline.imageProcessing
    ip.toneMappingEnabled = true
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    ip.exposure = 1.0
    ip.contrast = 1.08
    this.pipeline.bloomThreshold = 0.85
    this.pipeline.bloomWeight = 0.5
    this.pipeline.bloomScale = 0.5

    this.applyQuality(cfg)
  }

  setReceiver(mesh: AbstractMesh): void {
    mesh.receiveShadows = true
    if (!this.receivers.includes(mesh)) this.receivers.push(mesh)
  }

  addShadowCaster(node: TransformNode): void {
    if (!this.casters.includes(node)) this.casters.push(node)
    if (this.shadowGen) for (const m of node.getChildMeshes(false)) this.shadowGen.addShadowCaster(m, true)
  }

  applyQuality(cfg: QualityConfig): void {
    // post toggles
    this.pipeline.fxaaEnabled = cfg.fxaa
    this.pipeline.bloomEnabled = cfg.bloom

    // glow layer
    if (cfg.glow && !this.glow) { this.glow = new GlowLayer('glow', this.scene); this.glow.intensity = 0.7 }
    else if (!cfg.glow && this.glow) { this.glow.dispose(); this.glow = null }

    // shadows: rebuild generator at the requested size, then re-add every caster
    if (this.shadowGen) { this.shadowGen.dispose(); this.shadowGen = null }
    if (cfg.shadows) {
      const sg = new ShadowGenerator(cfg.shadowMapSize, this.sun)
      sg.usePercentageCloserFiltering = true
      sg.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
      sg.bias = 0.002
      this.shadowGen = sg
      for (const n of this.casters) for (const m of n.getChildMeshes(false)) sg.addShadowCaster(m, true)
    }

    // SSAO (high only, and only where supported)
    if (cfg.ssao && !this.ssao && SSAO2RenderingPipeline.IsSupported) {
      this.ssao = new SSAO2RenderingPipeline('ssao', this.scene, { ssaoRatio: 0.75, blurRatio: 1 }, this.scene.cameras)
    } else if (!cfg.ssao && this.ssao) {
      this.ssao.dispose(this.scene.cameras as any); this.ssao = null
    }

    // fog
    this.scene.fogMode = cfg.fog ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE
    this.scene.fogDensity = 0.011
  }

  dispose(): void {
    this.ssao?.dispose(this.scene.cameras as any)
    this.glow?.dispose()
    this.shadowGen?.dispose()
    this.pipeline.dispose()
    this.sun.dispose()
  }
}
