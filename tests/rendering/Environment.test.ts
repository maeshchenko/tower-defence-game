// tests/rendering/Environment.test.ts
import { describe, it, expect } from 'vitest'
import { NullEngine, Scene, HemisphericLight, ArcRotateCamera, Vector3, MeshBuilder, TransformNode } from '@babylonjs/core'
import { Environment } from '../../src/rendering/Environment'
import { resolveQuality } from '../../src/rendering/Quality'

function makeScene() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  // a camera so DefaultRenderingPipeline has a target
  new ArcRotateCamera('c', 0, 1, 10, Vector3.Zero(), scene)
  const fill = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
  return { engine, scene, fill }
}

describe('Environment', () => {
  it('constructs, registers a caster, switches presets, and disposes without throwing', () => {
    const { scene, fill } = makeScene()
    const env = new Environment(scene, fill, resolveQuality('med'))
    const ground = MeshBuilder.CreateGround('g', { width: 4, height: 4 }, scene)
    env.setReceiver(ground)
    const node = new TransformNode('n', scene)
    MeshBuilder.CreateBox('b', { size: 1 }, scene).parent = node
    expect(() => env.addShadowCaster(node)).not.toThrow()
    expect(() => env.applyQuality(resolveQuality('high'))).not.toThrow()
    expect(() => env.applyQuality(resolveQuality('low'))).not.toThrow()
    expect(() => env.dispose()).not.toThrow()
  })
})
