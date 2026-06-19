import { Scene, TrailMesh, Color3, StandardMaterial, TransformNode } from '@babylonjs/core'

// attach a short glowing trail that follows a moving projectile node. The trail is
// a child-independent mesh; dispose it when the projectile is disposed (see callers).
export function attachTrail(scene: Scene, node: TransformNode, color: Color3, diameter = 0.14): TrailMesh {
  const trail = new TrailMesh('trail', node, scene, diameter, 24, true)
  const m = new StandardMaterial('trailMat', scene)
  m.emissiveColor = color
  m.disableLighting = true
  m.alpha = 0.6
  trail.material = m
  trail.isPickable = false
  return trail
}
