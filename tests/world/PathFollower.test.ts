import { describe, it, expect } from 'vitest'
import { PathFollower } from '../../src/world/PathFollower'

const straight = [{x:0,y:0,z:0},{x:10,y:0,z:0}]

describe('PathFollower', () => {
  it('moves toward next waypoint', () => {
    const f = new PathFollower(straight, 2)
    f.advance(1) // 2 units
    expect(f.pos.x).toBeCloseTo(2); expect(f.done).toBe(false)
  })
  it('reaches end and clamps', () => {
    const f = new PathFollower(straight, 5)
    f.advance(3) // would be 15 > 10
    expect(f.pos).toEqual({x:10,y:0,z:0}); expect(f.done).toBe(true)
  })
  it('carries remainder across corners', () => {
    const corner = [{x:0,y:0,z:0},{x:0,y:0,z:4},{x:4,y:0,z:4}]
    const f = new PathFollower(corner, 1)
    f.advance(6) // 4 up + 2 right
    expect(f.pos.x).toBeCloseTo(2); expect(f.pos.z).toBeCloseTo(4)
  })
})
