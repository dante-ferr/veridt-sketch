import { createPrivateKey, createPublicKey, randomUUID } from 'node:crypto'
import type { CatalogEvent } from '@veridit/events'
import {
  canonicalJson,
  concludeCapture,
  failCapture,
  hashesMatchStored,
  manifestHash,
  sha256Hex,
  signManifest,
  verifyManifest,
  type Manifest,
} from '@veridit/evidence'
import { audit } from './start-capture'

export type StoredCapture = {
  id: string
  publicId: string
  accountId: string
  fullName: string
  email: string
  title: string
  state: 'NA_FILA' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'FALHOU' | 'CANCELADO'
  traceId: string
  manifestHash: string | null
  signature: string | null
}

export type EvidenceObject = { body: Buffer; sha256: string }

export abstract class EvidenceObjects {
  abstract get(key: string): Promise<EvidenceObject | null>
  abstract putNew(key: string, body: Buffer, sha256: string): Promise<void>
}

export type AcceptResult =
  | { outcome: 'concluded'; events: CatalogEvent[]; manifestHash: string; signature: string }
  | { outcome: 'failed'; events: CatalogEvent[]; reason: string }
  | { outcome: 'ignored' }

export async function acceptExecuted(
  record: StoredCapture,
  input: { manifestKey: string; manifestHash: string; finishedAt: string },
  objects: EvidenceObjects,
  privateKeyPem: string,
  now: Date,
): Promise<AcceptResult> {
  if (concludeCapture(record.state) === 'rejected') return { outcome: 'ignored' }
  const stored = await objects.get(input.manifestKey)
  if (!stored) return failure(record, 'manifest_missing', now)
  const canonical = stored.body.toString('utf8')
  if (stored.sha256 !== input.manifestHash) return failure(record, 'manifest_checksum_mismatch', now)
  let manifest: Manifest
  try {
    manifest = JSON.parse(canonical) as Manifest
  } catch {
    return failure(record, 'manifest_unreadable', now)
  }
  if (canonicalJson(manifest) !== canonical) return failure(record, 'manifest_not_canonical', now)
  if (manifestHash(manifest) !== input.manifestHash) return failure(record, 'manifest_hash_mismatch', now)
  const checksums: Record<string, string> = {}
  for (const file of manifest.files) {
    const object = await objects.get(file.storageKey)
    if (!object) return failure(record, 'file_missing', now)
    checksums[file.storageKey] = object.sha256
  }
  if (!hashesMatchStored(manifest, checksums)) return failure(record, 'file_checksum_mismatch', now)
  const signature = signManifest(canonical, privateKeyPem)
  if (!verifyManifest(canonical, signature, publicFromPrivate(privateKeyPem))) {
    return failure(record, 'signature_invalid', now)
  }
  const signatureBytes = Buffer.from(signature, 'utf8')
  await objects.putNew(`evidence/${record.id}/manifest.sig`, signatureBytes, sha256Hex(signatureBytes))
  return {
    outcome: 'concluded',
    manifestHash: input.manifestHash,
    signature,
    events: [
      {
        type: 'CapturaConcluida',
        version: 1,
        id: randomUUID(),
        occurredAt: now.toISOString(),
        data: {
          recordId: record.id,
          publicId: record.publicId,
          accountId: record.accountId,
          fullName: record.fullName,
          email: record.email,
          title: record.title,
          manifestHash: input.manifestHash,
          manifestKey: input.manifestKey,
          completedAt: input.finishedAt,
        },
      },
      audit(now, 'capture_completed', record.accountId, record.id, record.traceId, {
        manifestHash: input.manifestHash,
      }),
    ],
  }
}

export function acceptError(record: StoredCapture, reason: string, now: Date): AcceptResult {
  if (failCapture(record.state) === 'rejected') return { outcome: 'ignored' }
  return failure(record, reason, now)
}

function failure(record: StoredCapture, reason: string, now: Date): AcceptResult {
  return {
    outcome: 'failed',
    reason,
    events: [
      {
        type: 'CapturaFalhou',
        version: 1,
        id: randomUUID(),
        occurredAt: now.toISOString(),
        data: {
          recordId: record.id,
          publicId: record.publicId,
          accountId: record.accountId,
          state: 'FALHOU',
          reason,
          traceId: record.traceId,
        },
      },
      audit(now, 'capture_failed', record.accountId, record.id, record.traceId, { reason }),
    ],
  }
}

function publicFromPrivate(privateKeyPem: string): string {
  const exported = createPublicKey(createPrivateKey(privateKeyPem)).export({ type: 'spki', format: 'pem' })
  return typeof exported === 'string' ? exported : exported.toString('utf8')
}
