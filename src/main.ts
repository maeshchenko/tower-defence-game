import { Engine, Scene, ArcRotateCamera, HemisphericLight, MeshBuilder, Vector3, Color3, StandardMaterial } from '@babylonjs/core'

const canvas = document.getElementById('app') as HTMLCanvasElement
const engine = new Engine(canvas, true)
const scene = new Scene(engine)

const cam = new ArcRotateCamera('top', -Math.PI / 2, 0.9, 40, Vector3.Zero(), scene)
cam.attachControl(canvas, true)
new HemisphericLight('light', new Vector3(0, 1, 0), scene)

const ground = MeshBuilder.CreateGround('ground', { width: 30, height: 30 }, scene)
const mat = new StandardMaterial('g', scene)
mat.diffuseColor = new Color3(0.2, 0.5, 0.2)
ground.material = mat

engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
