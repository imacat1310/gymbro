// Backup file in/out. On iPhone home-screen apps a download link is unreliable, so prefer the share sheet
// ("Save to Files", AirDrop…) and fall back to a download where sharing files isn't supported.
import { exportAll, importAll } from '../db/repo'

export async function shareBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = await exportAll()
  const name = `gymbro-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'GymBro backup' })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Fall through to a download if sharing failed for another reason.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

/** Read a backup file and replace all data with it. Throws ImportError with a readable message. */
export async function restoreBackup(file: File) {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    json = undefined
  }
  return importAll(json)
}
