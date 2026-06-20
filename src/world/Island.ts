import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode, Mesh } from '@babylonjs/core'

// A floating hex mesa sitting under the 40x40 play plane: a tapered rock frustum
// plus a thin grass apron so the play surface reads as the top of a real island,
// not a square cut floating in the void. Purely visual — no collision.
export function buildIsland(scene: Scene): TransformNode {
  const root = new TransformNode('island', scene)

  const rock = new StandardMaterial('islandRock', scene)
  rock.diffuseColor = new Color3(0.42, 0.36, 0.3)
  rock.specularColor = new Color3(0, 0, 0)

  const grassSide = new StandardMaterial('islandGrassSide', scene)
  grassSide.diffuseColor = new Color3(0.3, 0.5, 0.26)
  grassSide.specularColor = new Color3(0, 0, 0)

  // grass apron: short hex prism whose top sits JUST BELOW y=0 so the play plane
  // and road tiles (y 0..0.08) render on top of it — otherwise it hides the road.
  const apron = MeshBuilder.CreateCylinder('islandApron',
    { diameterTop: 122, diameterBottom: 116, height: 2.2, tessellation: 6 }, scene)
  apron.material = grassSide
  apron.position.y = -1.25 // top at -0.15, under the ground plane
  apron.rotation.y = Math.PI / 6 // flat edge faces the default camera
  apron.isPickable = false
  apron.parent = root

  // rock body: tapers inward and down, giving the floating-island silhouette
  const body = MeshBuilder.CreateCylinder('islandRock',
    { diameterTop: 116, diameterBottom: 60, height: 18, tessellation: 6 }, scene) as Mesh
  body.material = rock
  body.position.y = -11
  body.rotation.y = Math.PI / 6
  body.isPickable = false
  body.parent = root

  // a few chunky boulders hanging off the underside for toon silhouette
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const r = MeshBuilder.CreateIcoSphere(`islandChunk${i}`, { radius: 4 + (i % 3) * 2, subdivisions: 1 }, scene)
    r.material = rock
    r.position = new Vector3(Math.cos(a) * 46, -16 - (i % 3) * 2, Math.sin(a) * 46)
    r.isPickable = false
    r.parent = root
  }
  return root
}
