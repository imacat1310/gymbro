// Copies the Tesseract.js OCR worker, engine and English model from node_modules into public/ocr so the
// InBody scan is self-hosted (works offline, no third-party requests; ADR-008). Runs before dev and build.
// The folder is versioned (public/ocr/<version>/) and rebuilt each time, so old versions never ship.
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OCR_VERSION } from './asset-versions.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
rmSync(join(root, 'public/ocr'), { recursive: true, force: true })
const dest = join(root, 'public/ocr', OCR_VERSION)
const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // The worker picks one engine by browser support; only that one is downloaded.
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
]

mkdirSync(join(dest, 'core'), { recursive: true })
mkdirSync(join(dest, 'lang'), { recursive: true })
for (const [src, to] of copies) copyFileSync(join(root, src), join(dest, to))
console.log(`Copied ${copies.length} OCR files to public/ocr/${OCR_VERSION}`)
