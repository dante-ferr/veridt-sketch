/** Kind of a captured file, from its media type. */
export type FileKind = 'video' | 'image' | 'html' | 'other'

export function fileKind(mediaType: string): FileKind {
  if (mediaType.startsWith('video/')) return 'video'
  if (mediaType.startsWith('image/')) return 'image'
  if (mediaType === 'text/html') return 'html'
  return 'other'
}

const kindLabel: Record<FileKind, string> = { video: 'Vídeo', image: 'Imagem', html: 'HTML', other: 'Outro' }

/** "Vídeo", "Imagem", "HTML"… for the files table. */
export function fileKindLabel(mediaType: string): string {
  return kindLabel[fileKind(mediaType)]
}

/** Bytes as "48,2 MB", "1,4 MB", "820 KB" (pt-BR, base 1000). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unit]}`
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "1 vídeo · 3 imagens · 3 HTML" from the captured files. */
export function summarizeFiles(files: Array<{ mediaType: string }>): string {
  const count = { video: 0, image: 0, html: 0, other: 0 }
  for (const file of files) count[fileKind(file.mediaType)] += 1
  const parts = [
    count.video ? plural(count.video, 'vídeo', 'vídeos') : '',
    count.image ? plural(count.image, 'imagem', 'imagens') : '',
    count.html ? `${count.html} HTML` : '',
    count.other ? plural(count.other, 'outro', 'outros') : '',
  ].filter(Boolean)
  return parts.join(' · ') || 'Nenhum arquivo'
}

/** "Vídeo de navegação e capturas de tela" from the kinds present in the files. */
export function describeDataTypes(files: Array<{ mediaType: string }>): string {
  const kinds = new Set(files.map((file) => fileKind(file.mediaType)))
  const parts = [
    kinds.has('video') ? 'Vídeo de navegação' : '',
    kinds.has('image') ? (kinds.has('video') ? 'capturas de tela' : 'Captura de tela') : '',
    kinds.has('html') ? 'código HTML das páginas' : '',
  ].filter(Boolean)
  if (parts.length === 0) return '–'
  if (parts.length === 1) return parts[0] ?? '–'
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}
