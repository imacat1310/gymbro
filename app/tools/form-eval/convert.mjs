// Videos → form-check samples (body points only) with the app's own MediaPipe runtime and model, in Playwright's
// Chromium on this Mac's GPU. Same model (Lite by default, like the app's recordings) and 30 fps sampling as
// src/lib/form/videoFile.ts, so thresholds tuned here match the phone.
//
//   npm run form-convert -- --exercise barbell_back_squat --view side --out ~/gymbro-data/side  videos/*.mp4
//
// Options: --model lite|full (default lite) · --fps 30 · --max-sec 90. Output: <out>/<video name>.json
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const exerciseId = opt('exercise', 'barbell_back_squat')
const view = opt('view', 'side')
const model = opt('model', 'lite')
const fps = Number(opt('fps', '30'))
const maxSec = Number(opt('max-sec', '90'))
const out = resolve(opt('out', '.'))
const videos = args
if (!videos.length || !['side', 'front'].includes(view)) {
  console.error('Usage: npm run form-convert -- --exercise <id> --view side|front [--model lite|full] --out <dir> <videos…>')
  process.exit(1)
}
mkdirSync(out, { recursive: true })

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const mp = join(root, 'node_modules/@mediapipe/tasks-vision')
const files = {
  '/vision_bundle.mjs': [join(mp, 'vision_bundle.mjs'), 'text/javascript'],
  '/wasm/vision_wasm_internal.js': [join(mp, 'wasm/vision_wasm_internal.js'), 'text/javascript'],
  '/wasm/vision_wasm_internal.wasm': [join(mp, 'wasm/vision_wasm_internal.wasm'), 'application/wasm'],
  [`/models/pose_landmarker_${model}.task`]: [join(root, `public/models/pose_landmarker_${model}.task`), 'application/octet-stream'],
}
const page = `<!doctype html><meta charset="utf-8"><input type="file" id="f">
<script type="module">
import { FilesetResolver, PoseLandmarker } from '/vision_bundle.mjs'
const fileset = await FilesetResolver.forVisionTasks('/wasm')
window.convert = async ({ model, fps, maxSec }) => {
  const lm = await PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/models/pose_landmarker_' + model + '.task', delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1 })
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; document.body.appendChild(video)
  video.src = URL.createObjectURL(document.getElementById('f').files[0])
  await new Promise((ok, err) => { video.onloadeddata = ok; video.onerror = () => err(new Error('unreadable video')) })
  const n = Math.floor(Math.min(video.duration, maxSec) * fps), frames = []
  for (let i = 0; i < n; i++) {
    await new Promise((ok) => { const t = setTimeout(ok, 3000); video.onseeked = () => { clearTimeout(t); ok() }; video.currentTime = i / fps })
    const t = Math.round((i / fps) * 1000)
    const p = lm.detectForVideo(video, t + 1).landmarks[0]
    if (p) frames.push({ t, lms: p.map((l) => ({ x: +l.x.toFixed(5), y: +l.y.toFixed(5), z: +l.z.toFixed(5), visibility: +(l.visibility ?? 0).toFixed(3) })) })
  }
  lm.close()
  const gl = document.createElement('canvas').getContext('webgl2'), dbg = gl?.getExtension('WEBGL_debug_renderer_info')
  return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, frames, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a' }
}
window.ready = true
</script>`

const browser = await chromium.launch({
  headless: true,
  // Headless Chromium otherwise falls back to software WebGL (about 8× slower).
  args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [],
})
const tab = await browser.newPage()
await tab.route('https://form-eval.local/**', (route) => {
  const path = new URL(route.request().url()).pathname
  if (path === '/') return route.fulfill({ body: page, contentType: 'text/html' })
  const f = files[path]
  if (!f || !existsSync(f[0])) return route.fulfill({ status: 404 })
  return route.fulfill({ body: readFileSync(f[0]), contentType: f[1] })
})

for (const video of videos) {
  const started = Date.now()
  await tab.goto('https://form-eval.local/')
  await tab.waitForFunction(() => window.ready)
  await tab.locator('#f').setInputFiles(video)
  try {
    const r = await tab.evaluate((o) => window.convert(o), { model, fps, maxSec })
    const name = basename(video, extname(video))
    const sample = {
      format: 'gymbro-form-sample', version: 1, appVersion: `form-convert ${pkg.version} (${model})`, createdAt: new Date().toISOString(),
      recording: { exerciseId, view, width: r.width, height: r.height, frames: r.frames },
      profile: { staticValgus: false, limitations: [] },
    }
    writeFileSync(join(out, `${name}.json`), JSON.stringify(sample))
    const secs = (Date.now() - started) / 1000
    console.log(`${name}: ${r.frames.length} frames with a pose (${Math.min(r.duration, maxSec).toFixed(1)} s video) in ${secs.toFixed(1)} s · ${r.renderer}`)
  } catch (err) {
    console.error(`${video}: ${err.message.split('\n')[0]}`)
  }
}
await browser.close()
