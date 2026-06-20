export type Vec3 = { x: number; y: number; z: number }
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z })
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z })
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x*s, y: a.y*s, z: a.z*s })
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b))
export const normalize = (a: Vec3): Vec3 => { const l = len(a); return l === 0 ? {x:0,y:0,z:0} : scale(a, 1/l) }
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))
