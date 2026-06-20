import { describe, it, expect } from 'vitest'
import { add, sub, scale, len, dist, normalize, lerp } from '../../src/core/Vec3'

describe('Vec3', () => {
  it('adds and subtracts', () => {
    expect(add({x:1,y:2,z:3},{x:1,y:1,z:1})).toEqual({x:2,y:3,z:4})
    expect(sub({x:1,y:2,z:3},{x:1,y:1,z:1})).toEqual({x:0,y:1,z:2})
  })
  it('scales and measures length', () => {
    expect(scale({x:1,y:0,z:0}, 5)).toEqual({x:5,y:0,z:0})
    expect(len({x:3,y:4,z:0})).toBe(5)
    expect(dist({x:0,y:0,z:0},{x:3,y:4,z:0})).toBe(5)
  })
  it('normalizes, zero stays zero', () => {
    expect(normalize({x:0,y:0,z:0})).toEqual({x:0,y:0,z:0})
    const n = normalize({x:0,y:0,z:2})
    expect(n).toEqual({x:0,y:0,z:1})
  })
  it('lerps', () => {
    expect(lerp({x:0,y:0,z:0},{x:10,y:0,z:0}, 0.5)).toEqual({x:5,y:0,z:0})
  })
})
