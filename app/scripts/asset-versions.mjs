// Versions of the large self-hosted runtimes (pose, OCR). Used in their URL paths and service-worker cache
// names, so upgrading a library can never mix new code with old cached files (developer review, step 3).
// Single source for the copy scripts and vite.config.ts.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgVersion = (name) => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version

export const MEDIAPIPE_VERSION = pkgVersion('@mediapipe/tasks-vision')
export const OCR_VERSION = `${pkgVersion('tesseract.js')}-core${pkgVersion('tesseract.js-core')}`

/** Short content hash of the committed pose models: a replaced model gets a fresh cache. */
export const MODELS_HASH = (() => {
  const dir = join(root, 'public/models')
  const hash = createHash('sha256')
  for (const f of readdirSync(dir).sort()) hash.update(f).update(readFileSync(join(dir, f)))
  return hash.digest('hex').slice(0, 8)
})()

export const POSE_CACHE = `pose-assets-${MEDIAPIPE_VERSION}-${MODELS_HASH}`
export const OCR_CACHE = `ocr-assets-${OCR_VERSION}`
