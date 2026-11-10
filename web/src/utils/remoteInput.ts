/** Remote browser viewport (the worker records at 1280×720). */
export const REMOTE_WIDTH = 1280
export const REMOTE_HEIGHT = 720

/** Video session limit, as in packages/evidence (VIDEO_SESSION_LIMIT_MS). */
export const VIDEO_SESSION_LIMIT_SECONDS = 15 * 60

const ignored = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified', 'Process', 'Compose'])

type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

/**
 * Key to send to the remote browser, or null to ignore it.
 * Printable characters go as typed (á, ç, A); shortcuts become "Control+a";
 * named keys keep their name (Enter, Backspace, ArrowDown, Tab).
 */
export function remoteKey(event: KeyLike): string | null {
  if (ignored.has(event.key)) return null
  const shortcut = event.ctrlKey || event.metaKey
  if (shortcut && [...event.key].length === 1) return `Control+${event.key.toLowerCase()}`
  if (event.altKey && [...event.key].length === 1 && !shortcut) return event.key
  return event.key.length <= 20 ? event.key : null
}

/**
 * Click position inside the remote 1280×720 page, for an image shown with
 * object-fit: contain in a box of `box` size. Null when the click is on the letterbox.
 */
export function remotePoint(
  click: { x: number; y: number },
  box: { width: number; height: number },
): { x: number; y: number } | null {
  const scale = Math.min(box.width / REMOTE_WIDTH, box.height / REMOTE_HEIGHT)
  const shownWidth = REMOTE_WIDTH * scale
  const shownHeight = REMOTE_HEIGHT * scale
  const left = (box.width - shownWidth) / 2
  const top = (box.height - shownHeight) / 2
  const x = (click.x - left) / scale
  const y = (click.y - top) / scale
  // Half a pixel of slack: clicks exactly on the edge land at -0.0000001 after the division.
  if (x < -0.5 || y < -0.5 || x > REMOTE_WIDTH + 0.5 || y > REMOTE_HEIGHT + 0.5) return null
  return {
    x: Math.min(REMOTE_WIDTH, Math.max(0, Math.round(x))),
    y: Math.min(REMOTE_HEIGHT, Math.max(0, Math.round(y))),
  }
}

/** "03:42 / 15:00" from the recording start. */
export function formatRecordingClock(startedAt: string | null, now: number): string {
  const limit = VIDEO_SESSION_LIMIT_SECONDS
  const elapsed = startedAt ? Math.min(limit, Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))) : 0
  const mmss = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return `${mmss(elapsed)} / ${mmss(limit)}`
}
