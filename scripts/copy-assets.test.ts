import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { test, expect } from 'vitest'

test('copy-assets produces models + Kenney external texture', () => {
  execSync('node scripts/copy-assets.mjs', { stdio: 'pipe' })
  expect(existsSync('public/models/towers/weapon-cannon.glb')).toBe(true)
  expect(existsSync('public/models/towers/Textures/colormap.png')).toBe(true)
  expect(existsSync('public/models/ammo/Textures/colormap.png')).toBe(true)
  expect(existsSync('public/models/hero/Knight.glb')).toBe(true)
  expect(existsSync('public/models/enemies/Skeleton_Warrior.glb')).toBe(true)
})
