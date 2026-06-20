import { Scene, TrailMesh, Color3, StandardMaterial, TransformNode } from '@babylonjs/core'

// attach a short glowing trail that follows a moving projectile node. The trail is
// a child-independent mesh; dispose it when the projectile is disposed (see callers).
export function attachTrail(scene: Scene, node: TransformNode, color: Color3, diameter = 0.14): TrailMesh {
  // compute the node's world matrix FIRST: otherwise TrailMesh anchors its first
  // segment at the origin (0,0,0) and draws a stray line from origin to the shot
  node.computeWorldMatrix(true)
  const trail = new TrailMesh('trail', node, scene, diameter, 24, true)
  const m = new StandardMaterial('trailMat', scene)
  // unlit colour kept BELOW the glow threshold (0.85) so the GlowLayer doesn't
  // bloom the trail into a wide offset halo (which reads as a second stripe)
  m.emissiveColor = color.scale(0.7)
  m.disableLighting = true
  m.alpha = 0.55
  trail.material = m
  trail.isPickable = false
  return trail
}
