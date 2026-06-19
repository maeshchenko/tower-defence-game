import {
  Scene, TransformNode, AssetContainer, LoadAssetContainerAsync,
  AnimationGroup, AbstractMesh,
} from '@babylonjs/core'
import { MODELS, normalizeScale } from './models'

// Loads each unique GLB once into an AssetContainer, then clones per request.
export class AssetManager {
  private containers = new Map<string, AssetContainer>()
  private scene!: Scene

  async preload(scene: Scene): Promise<void> {
    this.scene = scene
    const urls = new Set<string>()
    for (const def of Object.values(MODELS)) {
      urls.add(def.url)
      for (const p of def.parts ?? []) urls.add(p)
    }
    await Promise.all([...urls].map(async (url) => {
      const c = await LoadAssetContainerAsync(url, scene)
      this.containers.set(url, c)
    }))
  }

  // Clone a model (and any stacked parts) under one root, normalized to height.
  instance(key: string): TransformNode {
    const def = MODELS[key]
    if (!def) throw new Error('unknown model key: ' + key)
    const root = new TransformNode('model:' + key, this.scene)
    const allGroups: AnimationGroup[] = []
    for (const url of [def.url, ...(def.parts ?? [])]) {
      const node = this.cloneInto(url)
      node.parent = root
      const groups = node.metadata?.animationGroups as AnimationGroup[] | undefined
      if (groups) allGroups.push(...groups)
    }
    root.metadata = { animationGroups: allGroups }
    // measureHeight is called before root.scaling is applied, so bounding boxes are at scale 1.
    const h = this.measureHeight(root)
    const s = normalizeScale(h, def.targetHeight)
    root.scaling.setAll(s)
    if (def.yaw) root.rotation.y = def.yaw
    return root
  }

  // Loop the 'Idle' animation group on a freshly-instanced root (M1: no T-pose).
  playIdle(root: TransformNode): void {
    const groups = (root.metadata?.animationGroups as AnimationGroup[] | undefined) ?? []
    const idle = groups.find((g) => /idle/i.test(g.name)) ?? groups[0]
    idle?.start(true)
  }

  private cloneInto(url: string): TransformNode {
    const c = this.containers.get(url)
    if (!c) throw new Error('not preloaded: ' + url)
    const entries = c.instantiateModelsToScene(undefined, false, { doNotInstantiate: true })
    const node = entries.rootNodes[0] as TransformNode
    // stash animation groups so playIdle can find them on the returned root
    node.metadata = { ...(node.metadata ?? {}), animationGroups: entries.animationGroups }
    return node
  }

  private measureHeight(root: TransformNode): number {
    let min = Infinity, max = -Infinity
    for (const m of root.getChildMeshes(false) as AbstractMesh[]) {
      const b = m.getBoundingInfo().boundingBox
      min = Math.min(min, b.minimumWorld.y)
      max = Math.max(max, b.maximumWorld.y)
    }
    return max > min ? max - min : 1
  }
}
