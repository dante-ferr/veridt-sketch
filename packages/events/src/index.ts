import { z } from 'zod'

const envelope = {
  version: z.literal(1),
  id: z.string().uuid(),
  occurredAt: z.string().datetime(),
}

const emailPayload = z.object({
  accountId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(20),
  expiresAt: z.string().datetime(),
})

export const emailConfirmationRequested = z.object({
  type: z.literal('ConfirmacaoEmailSolicitada'),
  ...envelope,
  data: emailPayload,
})

export const passwordResetRequested = z.object({
  type: z.literal('RecuperacaoSenhaSolicitada'),
  ...envelope,
  data: emailPayload,
})

export const captureCompleted = z.object({
  type: z.literal('CapturaConcluida'),
  ...envelope,
  data: z.object({
    recordId: z.string().uuid(),
    publicId: z.string().min(1),
    accountId: z.string().uuid(),
    fullName: z.string().min(1),
    email: z.string().email(),
    title: z.string().min(1),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    manifestKey: z.string().min(1),
    completedAt: z.string().datetime(),
  }),
})

export const emailEvent = z.discriminatedUnion('type', [
  emailConfirmationRequested,
  passwordResetRequested,
  captureCompleted,
])

export type EmailEvent = z.infer<typeof emailEvent>

const recordRef = z.object({
  recordId: z.string().uuid(),
  publicId: z.string().min(1),
  accountId: z.string().uuid(),
})

export const recordCreated = z.object({
  type: z.literal('RegistroCriado'),
  ...envelope,
  data: recordRef.extend({
    fullName: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
    captureKind: z.enum(['screenshot', 'navigation_video']),
    state: z.enum(['NA_FILA', 'EM_ANDAMENTO']),
    traceId: z.string().uuid(),
  }),
})

export const captureFailed = z.object({
  type: z.literal('CapturaFalhou'),
  ...envelope,
  data: recordRef.extend({
    state: z.literal('FALHOU'),
    reason: z.string().min(1),
    traceId: z.string().uuid(),
  }),
})

export const captureCancelled = z.object({
  type: z.literal('CapturaCancelada'),
  ...envelope,
  data: recordRef.extend({
    state: z.literal('CANCELADO'),
    traceId: z.string().uuid(),
  }),
})

export const auditActions = [
  'capture_started',
  'capture_completed',
  'capture_failed',
  'capture_cancelled',
  'report_generated',
  'download_link_generated',
  'navigation_input',
  'purge',
] as const

export const auditEvent = z.object({
  type: z.literal('EventoAuditoria'),
  ...envelope,
  data: z.object({
    action: z.enum(auditActions),
    actorId: z.string().uuid(),
    recordId: z.string().uuid().nullable(),
    traceId: z.string().uuid(),
    detail: z.record(z.string(), z.string()),
  }),
})

export const captureExecuted = z.object({
  type: z.literal('CapturaExecutada'),
  ...envelope,
  data: z.object({
    recordId: z.string().uuid(),
    traceId: z.string().uuid(),
    manifestKey: z.string().min(1),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
  }),
})

export const captureErrored = z.object({
  type: z.literal('CapturaComErro'),
  ...envelope,
  data: z.object({
    recordId: z.string().uuid(),
    traceId: z.string().uuid(),
    reason: z.string().min(1),
  }),
})

export const catalogEvent = z.discriminatedUnion('type', [
  recordCreated,
  captureCompleted,
  captureFailed,
  captureCancelled,
  auditEvent,
])

export const workerEvent = z.discriminatedUnion('type', [captureExecuted, captureErrored])

export type CatalogEvent = z.infer<typeof catalogEvent>
export type WorkerEvent = z.infer<typeof workerEvent>
export type AuditAction = (typeof auditActions)[number]
