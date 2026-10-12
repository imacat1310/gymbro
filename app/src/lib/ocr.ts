// On-device OCR for InBody sheets (ADR-008). Tesseract.js is loaded on demand from self-hosted files
// (public/ocr, copied at build time), so the photo never leaves the phone and it works offline once cached.
import type { PSM } from 'tesseract.js'

export type OcrStage = 'loading' | 'reading' | 'figure'

/** Long side of the image handed to Tesseract: big enough for small sheet print, small enough for phones. */
const TARGET_LONG_SIDE = 2400

/** Upright, resized, grayscale and contrast-stretched copy of the photo. */
export async function preparePhoto(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = TARGET_LONG_SIDE / Math.max(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  const gray = new Uint8ClampedArray(px.length / 4)
  const hist = new Uint32Array(256)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    hist[gray[j]]++
  }
  // Stretch between the 2nd and 98th percentile: dim photos and grey paper get black text on white.
  const cut = gray.length * 0.02
  let lo = 0, hi = 255, acc = 0
  while (lo < 255 && (acc += hist[lo]) < cut) lo++
  acc = 0
  while (hi > 0 && (acc += hist[hi]) < cut) hi--
  const range = Math.max(1, hi - lo)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = ((gray[j] - lo) * 255) / range
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Tesseract page segmentation: '3' automatic layout (finds columns), '6' one uniform block, '11' sparse text. */
export type PageMode = '3' | '4' | '6' | '11'

/** One recognised word with its box (pixels in the prepared image). */
export interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number; conf: number }

export interface OcrResult {
  text: string
  words: OcrWord[]
  width: number
  height: number
  /** Page tilt in radians (median text-line baseline angle); positive = lines run downhill to the right. */
  skew: number
  /** The prepared image, kept for a close-up second read of a region. */
  image?: HTMLCanvasElement
}

/**
 * Read the photo once per page mode, reusing one worker: text plus every word's position.
 * Different modes read different parts of a two-column sheet well, so callers combine the passes.
 * `onProgress` gets the stage and 0–1 progress across all passes.
 */
export async function readSheet(file: Blob, onProgress: (stage: OcrStage, progress: number) => void, modes: PageMode[] = ['11', '3']): Promise<OcrResult[]> {
  onProgress('loading', 0)
  const [{ createWorker, OEM }, image] = await Promise.all([import('tesseract.js'), preparePhoto(file)])
  const base = new URL(`${import.meta.env.BASE_URL}ocr/${__OCR_VERSION__}/`, location.href).href
  let pass = 0
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    // The service worker already caches these files; don't keep a second copy in IndexedDB.
    cacheMethod: 'none',
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress('reading', (pass + m.progress) / modes.length)
      else if (pass === 0) onProgress('loading', m.progress)
    },
  })
  try {
    const out: OcrResult[] = []
    for (const mode of modes) {
      await worker.setParameters({ tessedit_pageseg_mode: mode as PSM, preserve_interword_spaces: '1' })
      const { data } = await worker.recognize(image, {}, { text: true, blocks: true })
      const words: OcrWord[] = []
      const angles: number[] = []
      for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
        const { x0, y0, x1, y1 } = l.baseline
        if (x1 - x0 > image.width * 0.15) angles.push(Math.atan2(y1 - y0, x1 - x0))
        for (const w of l.words) words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, conf: Math.round(w.confidence) })
      }
      angles.sort((a, b) => a - b)
      const skew = angles.length >= 3 ? angles[Math.floor(angles.length / 2)] : 0
      out.push({ text: data.text, words, width: image.width, height: image.height, skew, image })
      pass++
    }
    return out
  } finally {
    await worker.terminate()
  }
}

/**
 * Close-up read of a small region (the segmental body figure): its grey dotted background defeats normal OCR, so
 * the crop is turned black-and-white at a few cut-offs and read twice each. The caller votes across the reads.
 */
export async function readRegion(image: HTMLCanvasElement, box: { x0: number; y0: number; x1: number; y1: number },
  onProgress: (stage: OcrStage, progress: number) => void, cutoffs = [120, 135, 150], modes: PageMode[] = ['6', '11']): Promise<OcrResult[]> {
  const { createWorker, OEM } = await import('tesseract.js')
  const base = new URL(`${import.meta.env.BASE_URL}ocr/${__OCR_VERSION__}/`, location.href).href
  const w = Math.round(box.x1 - box.x0), hgt = Math.round(box.y1 - box.y0)
  const total = cutoffs.length * modes.length
  let done = 0
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`, corePath: `${base}core`, langPath: `${base}lang`, cacheMethod: 'none',
    logger: (m) => { if (m.status === 'recognizing text') onProgress('figure', (done + m.progress) / total) },
  })
  try {
    const out: OcrResult[] = []
    for (const cut of cutoffs) {
      // 2× enlargement on a white page; the figure occupies the top-left quarter.
      const c = document.createElement('canvas')
      c.width = w * 2; c.height = hgt * 2
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, box.x0, box.y0, w, hgt, 0, 0, w * 2, hgt * 2)
      const img = ctx.getImageData(0, 0, w * 2, hgt * 2)
      for (let i = 0; i < img.data.length; i += 4) {
        const v = img.data[i] < cut ? 0 : 255
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      }
      ctx.putImageData(img, 0, 0)
      for (const mode of modes) {
        await worker.setParameters({ tessedit_pageseg_mode: mode as PSM })
        const { data } = await worker.recognize(c, {}, { text: true, blocks: true })
        const words: OcrWord[] = []
        for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const wd of l.words) {
          words.push({ text: wd.text, x0: wd.bbox.x0, y0: wd.bbox.y0, x1: wd.bbox.x1, y1: wd.bbox.y1, conf: Math.round(wd.confidence) })
        }
        out.push({ text: data.text, words, width: c.width, height: c.height, skew: 0 })
        done++
      }
    }
    return out
  } finally {
    await worker.terminate()
  }
}
