// Delete service-worker caches left by older pose/OCR runtime versions (each is tens of MB).
// Their names carry the version (scripts/asset-versions.mjs), so anything with our prefix but not the current
// name is outdated.

const PREFIXES = ['pose-assets', 'ocr-assets']

/** Cache names to delete: ours (by prefix) but not one of the current names. */
export function outdatedCaches(names: string[], current: string[]): string[] {
  return names.filter((n) => PREFIXES.some((p) => n === p || n.startsWith(`${p}-`)) && !current.includes(n))
}

export async function pruneAssetCaches(): Promise<string[]> {
  if (typeof caches === 'undefined') return []
  try {
    const stale = outdatedCaches(await caches.keys(), [__POSE_CACHE__, __OCR_CACHE__])
    await Promise.all(stale.map((n) => caches.delete(n)))
    return stale
  } catch {
    return []
  }
}
