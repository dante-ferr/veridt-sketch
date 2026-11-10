import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
} from '@nestjs/common'
import { remoteJwks, verifyAccessToken, type Access } from '@veridt/auth'
import { z } from 'zod'
import { StartCapture } from '../application/start-capture'
import { cancelEvents } from '../infrastructure/broker'
import { Config } from '../infrastructure/config'
import { IdentityDirectory, sameSecret, WorkerVideoSessions } from '../infrastructure/clients'
import { ManifestSigner } from '../infrastructure/manifest-signer'
import { PrismaCaptureStore } from '../infrastructure/prisma-capture-store'
import { PrismaService } from '../infrastructure/prisma.service'

const startBody = z.object({
  captureKind: z.enum(['screenshot', 'navigation_video']),
  url: z.string().min(1).max(2000),
  title: z.string().min(1).max(120),
})

@Controller('captures')
export class CapturesController {
  private readonly keys: ReturnType<typeof remoteJwks>

  constructor(
    private readonly config: Config,
    private readonly startCapture: StartCapture,
    private readonly directory: IdentityDirectory,
    private readonly store: PrismaCaptureStore,
    private readonly sessions: WorkerVideoSessions,
    private readonly prisma: PrismaService,
  ) {
    this.keys = remoteJwks(config.jwksUrl)
  }

  @Post()
  @HttpCode(201)
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const access = await this.access(authorization)
    const input = startBody.parse(body)
    const contact = await this.directory.contact(access.sub).catch(() => {
      throw new HttpException({ error: 'unavailable', message: 'The identity service is unavailable.' }, 503)
    })
    if (!contact) throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    const result = await this.startCapture.execute({
      accountId: access.sub,
      fullName: contact.fullName,
      email: contact.email,
      title: input.title,
      url: input.url,
      captureKind: input.captureKind,
    })
    if (!result.ok) throw new HttpException({ error: result.error, message: result.message }, result.status)
    return result.value
  }

  @Get(':id')
  async show(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const access = await this.access(authorization)
    const row = await this.prisma.contentRecord.findFirst({ where: { id, accountId: access.sub } })
    if (!row) throw new HttpException({ error: 'not_found', message: 'Record not found.' }, 404)
    return {
      id: row.id,
      publicId: row.publicId,
      title: row.title,
      url: row.url,
      captureKind: row.captureKind,
      state: row.state,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      failureReason: row.failureReason,
      manifestHash: row.manifestHash,
      sessionId: row.sessionId,
    }
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const access = await this.access(authorization)
    const row = await this.prisma.contentRecord.findFirst({ where: { id, accountId: access.sub } })
    if (!row) throw new HttpException({ error: 'not_found', message: 'Record not found.' }, 404)
    const now = new Date()
    const outcome = await this.store.cancel(id, access.sub, cancelEvents(row, now), now)
    if (outcome === 'rejected') throw new HttpException({ error: 'invalid_state', message: 'This record can no longer be cancelled.' }, 409)
    if (row.sessionId) await this.sessions.discard(row.sessionId)
    return { id, state: 'CANCELADO' }
  }

  @Post(':id/conclude')
  @HttpCode(202)
  async conclude(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const access = await this.access(authorization)
    const row = await this.prisma.contentRecord.findFirst({ where: { id, accountId: access.sub } })
    if (!row) throw new HttpException({ error: 'not_found', message: 'Record not found.' }, 404)
    if (row.captureKind !== 'navigation_video' || row.state !== 'EM_ANDAMENTO' || !row.sessionId) {
      throw new HttpException({ error: 'invalid_state', message: 'This recording cannot be concluded.' }, 409)
    }
    const ok = await this.sessions.conclude(row.sessionId, row.publicId)
    if (!ok) throw new HttpException({ error: 'unavailable', message: 'The capture worker is unavailable.' }, 503)
    return { id, state: row.state }
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

@Controller('capture')
export class SigningKeyController {
  constructor(private readonly signer: ManifestSigner) {}

  @Get('signing-key')
  key() {
    return { algorithm: 'Ed25519', publicKeyPem: this.signer.publicPem }
  }
}

@Controller('internal/captures')
export class InternalCaptureController {
  constructor(
    private readonly config: Config,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id')
  async show(@Param('id') id: string, @Headers('x-internal-token') token?: string) {
    if (!sameSecret(token, this.config.internalToken)) {
      throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    }
    const row = await this.prisma.contentRecord.findUnique({ where: { id } })
    if (!row) throw new HttpException({ error: 'not_found', message: 'Record not found.' }, 404)
    return { id: row.id, accountId: row.accountId, state: row.state, sessionId: row.sessionId }
  }
}

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}
