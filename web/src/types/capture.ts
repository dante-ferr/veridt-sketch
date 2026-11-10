/** What the capture records: a full-page screenshot or a live navigation video. */
export type CaptureKind = 'screenshot' | 'navigation_video'

/** Lifecycle state of a record, as returned by the capture API. */
export type RecordState = 'NA_FILA' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO'

/** Row of the records listing (GET /v1/records). */
export type RecordListItem = {
  id: string
  publicId: string
  title: string
  state: RecordState
  startedAt: string | null
  finishedAt: string | null
}

/** Progress of one capture (GET /v1/captures/:id). */
export type CaptureStatus = {
  id: string
  publicId: string
  title: string
  url: string
  captureKind: 'screenshot' | 'navigation_video'
  state: RecordState
  startedAt: string | null
  finishedAt: string | null
  failureReason: string | null
}

/** Full record with integrity data and captured files (GET /v1/records/:id). */
export type RecordDetail = {
  id: string
  publicId: string
  title: string
  url: string
  captureKind: string
  state: RecordState
  fullName: string
  startedAt: string | null
  finishedAt: string | null
  manifestHash: string | null
  signature: string | null
  files: Array<{ name: string; mediaType: string; byteSize: number; sha256: string }>
}
