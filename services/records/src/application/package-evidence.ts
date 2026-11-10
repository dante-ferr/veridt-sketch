import { zipSync, strToU8 } from 'fflate'
import { randomUUID } from 'node:crypto'
import type { AuditAction } from '@veridt/events'
import { canonicalJson, manifestHash, sha256Hex, verifyManifest, type Manifest } from '@veridt/evidence'
import { buildReport, packageDecision, type EvidenceReport, type ReportProfile } from '../domain/report'

export type ViewRecord = {
  id: string
  publicId: string
  accountId: string
  state: string
  traceId: string
  manifestKey: string | null
  manifestHash: string | null
  signature: string | null
}

export type StoredObject = { body: Buffer }

export async function buildEvidencePackage(input: {
  view: ViewRecord
  profile: ReportProfile
  manifestObject: StoredObject
  files: Array<{ name: string; body: Buffer }>
  publicKeyPem: string
  now: Date
}): Promise<{ report: EvidenceReport; zip: Buffer; audit: Array<{ id: string; action: AuditAction; detail: Record<string, string> }> } | { error: 'refused' | 'invalid_signature' | 'hash_mismatch' }> {
  if (!isState(input.view.state) || packageDecision(input.view.state) === 'refused') return { error: 'refused' }
  const canonical = input.manifestObject.body.toString('utf8')
  const manifest = JSON.parse(canonical) as Manifest
  if (canonicalJson(manifest) !== canonical) return { error: 'hash_mismatch' }
  const hash = manifestHash(manifest)
  if (hash !== input.view.manifestHash) return { error: 'hash_mismatch' }
  if (!input.view.signature || !verifyManifest(canonical, input.view.signature, input.publicKeyPem)) {
    return { error: 'invalid_signature' }
  }
  for (const file of manifest.files) {
    const stored = input.files.find((item) => item.name === file.name)
    if (!stored) return { error: 'hash_mismatch' }
    if (sha256Hex(stored.body) !== file.sha256) return { error: 'hash_mismatch' }
  }
  const report = buildReport({
    reportId: randomUUID(),
    manifest,
    profile: input.profile,
    manifestHash: hash,
    signature: input.view.signature,
  })
  const reportJson = JSON.stringify(report, null, 2)
  const entries: Record<string, Uint8Array> = {
    'report.json': strToU8(reportJson),
    'report.html': strToU8(renderReport(report)),
    'manifest.json': strToU8(canonical),
    'manifest.sig': strToU8(input.view.signature),
  }
  for (const file of input.files) entries[`files/${file.name}`] = file.body
  return {
    report,
    zip: Buffer.from(zipSync(entries)),
    audit: [{
      id: randomUUID(),
      action: 'report_generated',
      detail: { manifestHash: hash, reportId: report.reportId },
    }],
  }
}

export function renderReport(report: EvidenceReport): string {
  const files = report.files
    .map((file) => `<tr><td>${escapeHtml(file.name)}</td><td>${file.byteSize}</td><td><code>${file.sha256}</code></td></tr>`)
    .join('')
  return `<!DOCTYPE html>
<html lang="pt">
<meta charset="utf-8">
<title>Relatório ${escapeHtml(report.publicId)}</title>
<body>
<h1>Relatório do registro</h1>
<p>Id do relatório: ${escapeHtml(report.reportId)}</p>
<p>Id do registro: ${escapeHtml(report.publicId)}</p>
<p>Usuário: ${escapeHtml(report.responsibleUser)}</p>
<p>CPF: ${escapeHtml(report.cpf)}</p>
<p>Início (UTC): ${escapeHtml(report.startedAt)}</p>
<p>Fim (UTC): ${escapeHtml(report.finishedAt)}</p>
<p>Duração (ms): ${report.durationMs}</p>
<p>Site: ${escapeHtml(report.site)}</p>
<p>URL: ${escapeHtml(report.url)}</p>
<p>Hash do manifesto: <code>${report.manifestHash}</code></p>
<p>Assinatura: <code>${escapeHtml(report.signature)}</code></p>
<table>
<thead><tr><th>Arquivo</th><th>Tamanho</th><th>SHA-256</th></tr></thead>
<tbody>${files}</tbody>
</table>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

function isState(value: string): value is 'NA_FILA' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO' {
  return value === 'NA_FILA' || value === 'EM_ANDAMENTO' || value === 'CONCLUIDO' || value === 'FALHOU' || value === 'CANCELADO'
}
