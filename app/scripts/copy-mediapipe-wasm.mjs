// Copies the MediaPipe vision WASM runtime from node_modules into public/ so it is
// self-hosted (works offline, no third-party requests). Runs before dev and build.
// The folder is versioned (public/mediapipe/<version>/wasm) and rebuilt each time, so old versions never ship.
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MEDIAPIPE_VERSION } from './asset-versions.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
rmSync(join(root, 'public/mediapipe'), { recursive: true, force: true })
const dest = join(root, 'public/mediapipe', MEDIAPIPE_VERSION, 'wasm')
const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

mkdirSync(dest, { recursive: true })
for (const f of files) copyFileSync(join(src, f), join(dest, f))
console.log(`Copied ${files.length} MediaPipe WASM files to public/mediapipe/${MEDIAPIPE_VERSION}/wasm`)
