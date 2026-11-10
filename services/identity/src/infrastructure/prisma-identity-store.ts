import { createPublicKey, randomUUID } from 'node:crypto'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { Prisma, type Account } from '../../generated/client'
import type { EmailEvent } from '@veridt/events'
import { verifyAccessToken } from '@veridt/auth'
import argon2 from 'argon2'
import { exportJWK, importPKCS8, importSPKI, SignJWT, type JWK } from 'jose'
import {
  IdentityStore,
  type AccountSummary,
  type NewAccount,
  type PasswordResetDraft,
  type Profile,
  type StoredAccount,
  type StoredSession,
} from '../application/identity-store'
import type { LoginState } from '../domain/login'
import { accessTokenExpiry } from '../domain/policy'
import { Config } from './config'
import { digest, decrypt, encrypt, opaqueToken } from './crypto'
import { PrismaService } from './prisma.service'

const argonOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }
const keyId = 'identity-ed25519'

@Injectable()
export class PrismaIdentityStore extends IdentityStore implements OnModuleInit {
  private dummyHash = ''
  private privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null
  private publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null
  private publicJwks: { keys: JWK[] } = { keys: [] }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: Config,
  ) {
    super()
  }

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('veridit-dummy-password', argonOptions)
    this.privateKey = await importPKCS8(this.config.jwtPem, 'EdDSA')
    const spki = createPublicKey(this.config.jwtPem).export({ type: 'spki', format: 'pem' })
    this.publicKey = await importSPKI(spki.toString(), 'EdDSA')
    const jwk = await exportJWK(this.publicKey)
    jwk.kid = keyId
    jwk.alg = 'EdDSA'
    jwk.use = 'sig'
    this.publicJwks = { keys: [jwk] }
  }

  async findByEmail(email: string): Promise<StoredAccount | null> {
    const account = await this.prisma.account.findUnique({ where: { email } })
    return account ? this.toAccount(account) : null
  }

  async findById(id: string): Promise<AccountSummary | null> {
    const account = await this.prisma.account.findUnique({ where: { id } })
    if (!account) return null
    const stored = this.toAccount(account)
    return {
      id: stored.id,
      fullName: stored.fullName,
      email: stored.email,
      profile: stored.profile,
      emailConfirmed: stored.emailConfirmed,
    }
  }

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, argonOptions)
  }

  async passwordMatches(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password)
    } catch {
      return false
    }
  }

  async checkDummyPassword(password: string): Promise<void> {
    await this.passwordMatches(this.dummyHash, password)
  }

  encryptCpf(cpf: string): string {
    return encrypt(cpf, this.config.cpfKey)
  }

  hmacCpf(cpf: string): string {
    return digest(cpf, this.config.cpfHmacKey)
  }

  encryptOab(oab: string): string {
    return encrypt(oab, this.config.oabKey)
  }

  newOpaqueToken(): string {
    return opaqueToken()
  }

  hmacToken(token: string): string {
    return digest(token, this.config.tokenHmacKey)
  }

  hmacRefresh(token: string): string {
    return digest(token, this.config.refreshHmacKey)
  }

  async issueAccessToken(accountId: string, profile: Profile, now: Date): Promise<string> {
    if (!this.privateKey) throw new Error('issuer_not_ready')
    const expiresAt = accessTokenExpiry(now)
    return new SignJWT({ profile })
      .setProtectedHeader({ alg: 'EdDSA', kid: keyId })
      .setSubject(accountId)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .setJti(randomUUID())
      .sign(this.privateKey)
  }

  async verifyAccessToken(token: string): Promise<{ sub: string; profile: Profile }> {
    if (!this.publicKey) throw new Error('issuer_not_ready')
    return verifyAccessToken(token, async () => {
      if (!this.publicKey) throw new Error('issuer_not_ready')
      return this.publicKey
    }, {
      issuer: this.config.issuer,
      audience: this.config.audience,
    })
  }

  jwks(): { keys: unknown[] } {
    return this.publicJwks
  }

  async findContact(id: string): Promise<{ fullName: string; email: string } | null> {
    const account = await this.prisma.account.findUnique({ where: { id } })
    if (!account) return null
    return { fullName: account.fullName, email: account.email }
  }

  async findReportProfile(id: string): Promise<{ fullName: string; email: string; cpf: string } | null> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { lawyer: true, commonUser: true },
    })
    if (!account) return null
    const ciphertext = account.lawyer?.cpfCiphertext ?? account.commonUser?.cpfCiphertext
    if (!ciphertext) return null
    return {
      fullName: account.fullName,
      email: account.email,
      cpf: decrypt(ciphertext, this.config.cpfKey),
    }
  }

  async saveAccount(data: NewAccount): Promise<'ok' | 'email' | 'cpf'> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.account.create({
          data: {
            id: data.id,
            email: data.email,
            fullName: data.fullName,
            passwordHash: data.passwordHash,
            profile: data.profile,
            createdAt: data.createdAt,
            lawyer:
              data.profile === 'lawyer'
                ? { create: { cpfCiphertext: data.cpfCiphertext, oabCiphertext: data.oabCiphertext ?? '' } }
                : undefined,
            commonUser:
              data.profile === 'common_user' ? { create: { cpfCiphertext: data.cpfCiphertext } } : undefined,
            cpfDocument: { create: { hmac: data.cpfHmac } },
            tokens: {
              create: {
                id: data.tokenId,
                purpose: 'EMAIL_CONFIRMATION',
                tokenHmac: data.tokenHmac,
                expiresAt: data.tokenExpiresAt,
                createdAt: data.createdAt,
              },
            },
          },
        })
        await tx.outbox.create({ data: outboxRow(data.event, data.createdAt) })
      })
      return 'ok'
    } catch (error) {
      const target = uniqueTarget(error)
      if (!target) throw error
      if (target.includes('email')) return 'email'
      if (target.includes('hmac') || target.includes('cpf_document')) return 'cpf'
      throw error
    }
  }

  async saveLoginState(accountId: string, state: LoginState): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: { failedLogins: state.failures, lockedUntil: state.lockedUntil },
    })
  }

  async createSession(accountId: string, refreshHmac: string, expiresAt: Date): Promise<void> {
    await this.prisma.session.create({
      data: { id: randomUUID(), accountId, refreshHmac, expiresAt },
    })
  }

  async findSession(refreshHmac: string): Promise<StoredSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { refreshHmac },
      include: { account: true },
    })
    if (!session) return null
    const account = this.toAccount(session.account)
    return {
      accountId: account.id,
      profile: account.profile,
      emailConfirmed: account.emailConfirmed,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    }
  }

  async revokeSession(refreshHmac: string, accountId: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshHmac, accountId, revokedAt: null },
      data: { revokedAt: now },
    })
  }

  async confirmEmail(tokenHmac: string, now: Date): Promise<'ok' | 'invalid'> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.oneTimeToken.findUnique({ where: { tokenHmac } })
      if (!token || token.purpose !== 'EMAIL_CONFIRMATION' || token.usedAt || token.expiresAt <= now) {
        return 'invalid'
      }
      const marked = await tx.oneTimeToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now },
      })
      if (marked.count !== 1) return 'invalid'
      await tx.account.update({ where: { id: token.accountId }, data: { emailConfirmedAt: now } })
      return 'ok'
    })
  }

  async countPasswordResets(accountId: string, since: Date): Promise<number> {
    return this.prisma.oneTimeToken.count({
      where: { accountId, purpose: 'PASSWORD_RESET', createdAt: { gte: since } },
    })
  }

  async savePasswordReset(data: PasswordResetDraft): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.oneTimeToken.create({
        data: {
          id: data.tokenId,
          accountId: data.accountId,
          purpose: 'PASSWORD_RESET',
          tokenHmac: data.tokenHmac,
          expiresAt: data.expiresAt,
          createdAt: data.createdAt,
        },
      })
      await tx.outbox.create({ data: outboxRow(data.event, data.createdAt) })
    })
  }

  async resetPassword(tokenHmac: string, passwordHash: string, now: Date): Promise<'ok' | 'invalid'> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.oneTimeToken.findUnique({ where: { tokenHmac } })
      if (!token || token.purpose !== 'PASSWORD_RESET' || token.usedAt || token.expiresAt <= now) {
        return 'invalid'
      }
      const marked = await tx.oneTimeToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now },
      })
      if (marked.count !== 1) return 'invalid'
      await tx.account.update({
        where: { id: token.accountId },
        data: { passwordHash, failedLogins: 0, lockedUntil: null },
      })
      await tx.session.updateMany({
        where: { accountId: token.accountId, revokedAt: null },
        data: { revokedAt: now },
      })
      return 'ok'
    })
  }

  private toAccount(account: Account): StoredAccount {
    if (account.profile !== 'lawyer' && account.profile !== 'common_user') {
      throw new Error('invalid_profile')
    }
    return {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      passwordHash: account.passwordHash,
      profile: account.profile,
      emailConfirmed: account.emailConfirmedAt !== null,
      loginState: { failures: account.failedLogins, lockedUntil: account.lockedUntil },
    }
  }
}

function outboxRow(event: EmailEvent, createdAt: Date): Prisma.OutboxCreateInput {
  return {
    id: event.id,
    type: event.type,
    version: event.version,
    occurredAt: new Date(event.occurredAt),
    payload: event as unknown as Prisma.InputJsonValue,
    createdAt,
  }
}

function uniqueTarget(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return ''
  if ((error as { code: string }).code !== 'P2002') return ''
  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (Array.isArray(target)) return target.join(',')
  return String(target ?? '')
}
