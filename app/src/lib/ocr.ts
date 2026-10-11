// On-device OCR for InBody sheets (ADR-008). Tesseract.js is loaded on demand from self-hosted files
// (public/ocr, copied at build time), so the photo never leaves the phone and it works offline once cached.

export type OcrStage = 'loading' | 'reading'

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

/** Read all text on the photo. `onProgress` gets 0–1 per stage. */
export async function readText(file: Blob, onProgress: (stage: OcrStage, progress: number) => void): Promise<string> {
  onProgress('loading', 0)
  const [{ createWorker, OEM, PSM }, image] = await Promise.all([import('tesseract.js'), preparePhoto(file)])
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    // The service worker already caches these files; don't keep a second copy in IndexedDB.
    cacheMethod: 'none',
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress('reading', m.progress)
      else onProgress('loading', m.progress)
    },
  })
  try {
    // One block of text lines across the full width keeps each label on the same line as its value.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}
