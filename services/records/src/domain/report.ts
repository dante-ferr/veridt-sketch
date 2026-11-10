import { canPackageEvidence, type Manifest, type RecordState } from '@veridt/evidence'

export type ReportProfile = {
  fullName: string
  email: string
  cpf: string
}

export type EvidenceReport = {
  reportId: string
  recordId: string
  publicId: string
  responsibleUser: string
  cpf: string
  startedAt: string
  finishedAt: string
  durationMs: number
  site: string
  url: string
  files: Array<{ name: string; mediaType: string; byteSize: number; sha256: string }>
  manifestHash: string
  signature: string
}

export function buildReport(input: {
  reportId: string
  manifest: Manifest
  profile: ReportProfile
  manifestHash: string
  signature: string
}): EvidenceReport {
  const started = Date.parse(input.manifest.startedAt)
  const finished = Date.parse(input.manifest.finishedAt)
  const host = new URL(input.manifest.url).hostname
  return {
    reportId: input.reportId,
    recordId: input.manifest.recordId,
    publicId: input.manifest.publicId,
    responsibleUser: input.profile.fullName,
    cpf: input.profile.cpf,
    startedAt: input.manifest.startedAt,
    finishedAt: input.manifest.finishedAt,
    durationMs: Math.max(0, finished - started),
    site: host,
    url: input.manifest.url,
    files: input.manifest.files.map((file) => ({
      name: file.name,
      mediaType: file.mediaType,
      byteSize: file.byteSize,
      sha256: file.sha256,
    })),
    manifestHash: input.manifestHash,
    signature: input.signature,
  }
}

export function packageDecision(state: RecordState): 'allowed' | 'refused' {
  return canPackageEvidence(state) ? 'allowed' : 'refused'
}
