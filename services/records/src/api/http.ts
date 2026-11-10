import { randomUUID } from 'node:crypto'
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { remoteJwks, verifyAccessToken, type Access } from '@veridit/auth'
import { DOWNLOAD_LINK_TTL_SECONDS, type Manifest } from '@veridit/evidence'
import { z } from 'zod'
import { buildEvidencePackage, renderReport } from '../application/package-evidence'
import { Config } from '../infrastructure/config'
import { ObjectStore } from '../infrastructure/object-store'
import { PrismaService } from '../infrastructure/prisma.service'
import { Prisma } from '../../generated/client'

const pageSize = 5
const downloadBody = z.object({ artifact: z.enum(['report', 'archive']) })

@Controller('records')
export class RecordsController {
  private readonly keys: ReturnType<typeof remoteJwks>

  constructor(
    private readonly config: Config,
    private readonly prisma: PrismaService,
    private readonly objects: ObjectStore,
  ) {
    this.keys = remoteJwks(config.jwksUrl)
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query('title') title?: string,
    @Query('state') state?: string,
    @Query('page') page?: string,
  ) {
    const access = await this.access(authorization)
    const current = Math.max(1, Number(page) || 1)
    const where = {
      accountId: access.sub,
      title: title ? { contains: title, mode: 'insensitive' as const } : undefined,
      state: state && state !== 'all' ? state : undefined,
    }
    const [total, rows] = await Promise.all([
      this.prisma.recordView.count({ where }),
      this.prisma.recordView.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (current - 1) * pageSize,
        take: pageSize,
      }),
    ])
    return {
      page: current,
      pageSize,
      total,
      items: rows.map((row) => ({
        id: row.id,
        publicId: row.publicId,
        title: row.title,
        captureKind: row.captureKind,
        state: row.state,
        startedAt: row.startedAt?.toISOString() ?? null,
        finishedAt: row.finishedAt?.toISOString() ?? null,
      })),
    }
  }

  @Get(':id')
  async show(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const access = await this.access(authorization)
    const row = await this.owned(id, access.sub)
    const files = Array.isArray(row.files) ? row.files : []
    return {
      id: row.id,
      publicId: row.publicId,
      title: row.title,
      url: row.url,
      captureKind: row.captureKind,
      state: row.state,
      fullName: row.fullName,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      manifestHash: row.manifestHash,
      signature: row.signature,
      files,
    }
  }

  @Post(':id/purge')
  purge() {
    throw new HttpException({
      error: 'purge_pending_adr_007',
      message: 'Evidence deletion waits for ADR-007.',
    }, 409)
  }

  @Post(':id/downloads')
  async download(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const access = await this.access(authorization)
    const input = downloadBody.parse(body)
    const row = await this.owned(id, access.sub)
    if (row.state !== 'CONCLUIDO' || !row.manifestKey || !row.manifestHash || !row.signature) {
      throw new HttpException({ error: 'record_not_concluded', message: 'Only a concluded record can be packaged.' }, 409)
    }
    const kind = input.artifact === 'report' ? 'report' : 'archive'
    let artifact = await this.prisma.artifact.findUnique({ where: { recordId_kind: { recordId: row.id, kind } } })
    if (!artifact) {
      artifact = await this.ensure(row, access.sub, kind)
    }
    const url = await this.objects.link('artifacts', artifact.storageKey)
    const now = new Date()
    await this.prisma.auditEvent.create({
      data: {
        id: randomUUID(),
        action: 'download_link_generated',
        actorId: access.sub,
        recordId: row.id,
        traceId: row.traceId,
        occurredAt: now,
        detail: { artifact: kind },
      },
    })
    return { url, expiresInSeconds: DOWNLOAD_LINK_TTL_SECONDS }
  }

  private async ensure(
    row: {
      id: string
      publicId: string
      accountId: string
      state: string
      traceId: string
      manifestKey: string | null
      manifestHash: string | null
      signature: string | null
    },
    actorId: string,
    kind: 'report' | 'archive',
  ) {
    const manifestKey = row.manifestKey
    if (!manifestKey) throw new HttpException({ error: 'record_not_concluded', message: 'Only a concluded record can be packaged.' }, 409)
    const manifestObject = { body: await this.objects.getEvidence(manifestKey) }
    const manifest = JSON.parse(manifestObject.body.toString('utf8')) as Manifest
    const files = []
    for (const file of manifest.files) files.push({ name: file.name, body: await this.objects.getEvidence(file.storageKey) })
    const profile = await this.profile(row.accountId)
    const publicKeyPem = await this.publicKey()
    const packed = await buildEvidencePackage({
      view: row,
      profile,
      manifestObject,
      files,
      publicKeyPem,
      now: new Date(),
    })
    if ('error' in packed) {
      throw new HttpException({ error: packed.error, message: 'The evidence package could not be verified.' }, 409)
    }
    const reportKey = `reports/${row.id}/report.html`
    const archiveKey = `reports/${row.id}/archive.zip`
    await this.objects.putArtifact(reportKey, Buffer.from(renderReport(packed.report), 'utf8'), 'text/html; charset=utf-8')
    await this.objects.putArtifact(archiveKey, packed.zip, 'application/zip')
    const now = new Date()
    await this.prisma.artifact.createMany({
      data: [
        { id: randomUUID(), recordId: row.id, kind: 'report', storageKey: reportKey, createdAt: now },
        { id: randomUUID(), recordId: row.id, kind: 'archive', storageKey: archiveKey, createdAt: now },
      ],
      skipDuplicates: true,
    })
    for (const entry of packed.audit) {
      await this.prisma.auditEvent.create({
        data: {
          id: entry.id,
          action: entry.action,
          actorId,
          recordId: row.id,
          traceId: row.traceId,
          occurredAt: now,
          detail: entry.detail as Prisma.InputJsonValue,
        },
      })
    }
    const stored = await this.prisma.artifact.findUnique({ where: { recordId_kind: { recordId: row.id, kind } } })
    if (!stored) throw new HttpException({ error: 'unavailable', message: 'The package could not be stored.' }, 503)
    return stored
  }

  private async profile(accountId: string) {
    const response = await fetch(`${this.config.identityUrl}/v1/internal/accounts/${accountId}/report`, {
      headers: { 'x-service-token': this.config.serviceToken },
    })
    if (!response.ok) throw new HttpException({ error: 'unavailable', message: 'The identity service is unavailable.' }, 503)
    return (await response.json()) as { fullName: string; email: string; cpf: string }
  }

  private async publicKey(): Promise<string> {
    const response = await fetch(`${this.config.captureUrl}/v1/capture/signing-key`)
    if (!response.ok) throw new HttpException({ error: 'unavailable', message: 'The capture service is unavailable.' }, 503)
    const body = (await response.json()) as { publicKeyPem: string }
    return body.publicKeyPem
  }

  private async owned(id: string, accountId: string) {
    const row = await this.prisma.recordView.findFirst({ where: { id, accountId } })
    if (!row) throw new HttpException({ error: 'not_found', message: 'Record not found.' }, 404)
    return row
  }

  private async access(header: string | undefined): Promise<Access> {
    const token = bearer(header)
    if (!token) throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    try {
      return await verifyAccessToken(token, this.keys, { issuer: this.config.issuer, audience: this.config.audience })
    } catch {
      throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    }
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }
}
