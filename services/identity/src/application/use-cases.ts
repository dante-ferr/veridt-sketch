import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { emailConfirmationRequested, passwordResetRequested } from '@veridit/events'
import { isValidCpf } from '../domain/cpf'
import { decideLogin } from '../domain/login'
import {
  EMAIL_CONFIRMATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  PASSWORD_RESET_WINDOW_MS,
  accessTokenExpiry,
  canRequestPasswordReset,
  refreshExpiry,
} from '../domain/policy'
import { refreshAllowsRenewal } from '../domain/refresh'
import { isAcceptableEmail, isAcceptableName, normalizeOab, validatePassword } from '../domain/registration'
import { IdentityStore, type Profile } from './identity-store'
import { fail, ok, type Result } from './result'

export type RegisterInput = {
  profile: Profile
  fullName: string
  email: string
  cpf: string
  oab?: string
  password: string
  passwordConfirmation: string
  acceptedTerms: boolean
}

const sameRecoveryReply = 'If an account exists for this email, a reset link will arrive in a few minutes.'

@Injectable()
export class RegisterAccount {
  constructor(private readonly store: IdentityStore) {}

  async execute(input: RegisterInput, now: Date): Promise<Result<{ id: string }>> {
    if (!input.acceptedTerms) return fail('terms_required', 'Accept the terms to continue.', 400)
    const fullName = input.fullName.trim()
    if (!isAcceptableName(fullName)) return fail('invalid_name', 'Enter your full name.', 400)
    const email = input.email.trim().toLowerCase()
    if (!isAcceptableEmail(email)) return fail('invalid_email', 'Enter a valid email address.', 400)
    const passwordCheck = validatePassword(input.password, input.passwordConfirmation)
    if (passwordCheck === 'too_short') return fail('password_too_short', 'Use at least 8 characters.', 400)
    if (passwordCheck === 'mismatch') return fail('password_mismatch', 'Passwords do not match.', 400)
    const cpf = input.cpf.replace(/\D/g, '')
    if (!isValidCpf(cpf)) return fail('invalid_cpf', 'Enter a valid CPF.', 400)
    let oab: string | null = null
    if (input.profile === 'lawyer') {
      oab = normalizeOab(input.oab ?? '')
      if (!oab) return fail('invalid_oab', 'Enter the OAB as UF 000000.', 400)
    }
    const id = randomUUID()
    const token = this.store.newOpaqueToken()
    const expiresAt = new Date(now.getTime() + EMAIL_CONFIRMATION_TTL_MS)
    const parsed = emailConfirmationRequested.safeParse({
      type: 'ConfirmacaoEmailSolicitada',
      version: 1,
      id: randomUUID(),
      occurredAt: now.toISOString(),
      data: { accountId: id, fullName, email, token, expiresAt: expiresAt.toISOString() },
    })
    if (!parsed.success) return fail('internal_error', 'The operation could not be completed.', 500)
    const saved = await this.store.saveAccount({
      id,
      email,
      fullName,
      passwordHash: await this.store.hashPassword(input.password),
      profile: input.profile,
      cpfCiphertext: this.store.encryptCpf(cpf),
      cpfHmac: this.store.hmacCpf(cpf),
      oabCiphertext: oab ? this.store.encryptOab(oab) : null,
      createdAt: now,
      tokenId: randomUUID(),
      tokenHmac: this.store.hmacToken(token),
      tokenExpiresAt: expiresAt,
      event: parsed.data,
    })
    if (saved === 'email') return fail('email_in_use', 'An account with this email already exists.', 409)
    if (saved === 'cpf') return fail('cpf_in_use', 'An account with this CPF already exists.', 409)
    return ok({ id })
  }
}

@Injectable()
export class ConfirmEmail {
  constructor(private readonly store: IdentityStore) {}

  async execute(token: string, now: Date): Promise<Result<{ message: string }>> {
    const result = await this.store.confirmEmail(this.store.hmacToken(token), now)
    if (result === 'invalid') return fail('invalid_token', 'The link is invalid or expired.', 400)
    return ok({ message: 'Email confirmed.' })
  }
}

@Injectable()
export class LogIn {
  constructor(private readonly store: IdentityStore) {}

  async execute(emailRaw: string, password: string, now: Date): Promise<Result<{ accessToken: string; refreshToken: string; expiresAt: string }>> {
    const email = emailRaw.trim().toLowerCase()
    const account = await this.store.findByEmail(email)
    if (!account) {
      await this.store.checkDummyPassword(password)
      return fail('invalid_credentials', 'The email or password is incorrect.', 401)
    }
    const passwordMatches = await this.store.passwordMatches(account.passwordHash, password)
    const decision = decideLogin({
      now,
      state: account.loginState,
      passwordMatches,
      emailConfirmed: account.emailConfirmed,
    })
    await this.store.saveLoginState(account.id, decision.state)
    if (decision.outcome === 'locked') {
      return fail('account_locked', 'The account is locked for 15 minutes after 5 failed attempts.', 423)
    }
    if (decision.outcome === 'invalid_credentials') {
      return fail('invalid_credentials', 'The email or password is incorrect.', 401)
    }
    if (decision.outcome === 'email_not_confirmed') {
      return fail('email_not_confirmed', 'Confirm your email before signing in.', 403)
    }
    const refreshToken = this.store.newOpaqueToken()
    await this.store.createSession(account.id, this.store.hmacRefresh(refreshToken), refreshExpiry(now))
    const accessToken = await this.store.issueAccessToken(account.id, account.profile, now)
    return ok({ accessToken, refreshToken, expiresAt: accessTokenExpiry(now).toISOString() })
  }
}

@Injectable()
export class RefreshSession {
  constructor(private readonly store: IdentityStore) {}

  async execute(refreshToken: string, now: Date): Promise<Result<{ accessToken: string; expiresAt: string }>> {
    const session = await this.store.findSession(this.store.hmacRefresh(refreshToken))
    if (!session || !session.emailConfirmed) {
      return fail('unauthenticated', 'Sign in to continue.', 401)
    }
    const allowed = refreshAllowsRenewal(
      { expiresAt: session.expiresAt, revokedAt: session.revokedAt },
      now,
    )
    if (!allowed) return fail('unauthenticated', 'Sign in to continue.', 401)
    const accessToken = await this.store.issueAccessToken(session.accountId, session.profile, now)
    return ok({ accessToken, expiresAt: accessTokenExpiry(now).toISOString() })
  }
}

@Injectable()
export class LogOut {
  constructor(private readonly store: IdentityStore) {}

  async execute(accountId: string, refreshToken: string, now: Date): Promise<Result<null>> {
    await this.store.revokeSession(this.store.hmacRefresh(refreshToken), accountId, now)
    return ok(null)
  }
}

@Injectable()
export class RequestPasswordReset {
  constructor(private readonly store: IdentityStore) {}

  async execute(emailRaw: string, now: Date): Promise<Result<{ message: string }>> {
    const email = emailRaw.trim().toLowerCase()
    if (!isAcceptableEmail(email)) return fail('invalid_email', 'Enter a valid email address.', 400)
    const account = await this.store.findByEmail(email)
    if (!account) return ok({ message: sameRecoveryReply })
    const since = new Date(now.getTime() - PASSWORD_RESET_WINDOW_MS)
    const count = await this.store.countPasswordResets(account.id, since)
    if (!canRequestPasswordReset(count)) return ok({ message: sameRecoveryReply })
    const token = this.store.newOpaqueToken()
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS)
    const parsed = passwordResetRequested.safeParse({
      type: 'RecuperacaoSenhaSolicitada',
      version: 1,
      id: randomUUID(),
      occurredAt: now.toISOString(),
      data: {
        accountId: account.id,
        fullName: account.fullName,
        email: account.email,
        token,
        expiresAt: expiresAt.toISOString(),
      },
    })
    if (!parsed.success) return fail('internal_error', 'The operation could not be completed.', 500)
    await this.store.savePasswordReset({
      accountId: account.id,
      tokenId: randomUUID(),
      tokenHmac: this.store.hmacToken(token),
      expiresAt,
      createdAt: now,
      event: parsed.data,
    })
    return ok({ message: sameRecoveryReply })
  }
}

@Injectable()
export class ResetPassword {
  constructor(private readonly store: IdentityStore) {}

  async execute(token: string, password: string, passwordConfirmation: string, now: Date): Promise<Result<{ message: string }>> {
    const passwordCheck = validatePassword(password, passwordConfirmation)
    if (passwordCheck === 'too_short') return fail('password_too_short', 'Use at least 8 characters.', 400)
    if (passwordCheck === 'mismatch') return fail('password_mismatch', 'Passwords do not match.', 400)
    const passwordHash = await this.store.hashPassword(password)
    const result = await this.store.resetPassword(this.store.hmacToken(token), passwordHash, now)
    if (result === 'invalid') return fail('invalid_token', 'The link is invalid or expired.', 400)
    return ok({ message: 'Password updated.' })
  }
}

@Injectable()
export class GetAccount {
  constructor(private readonly store: IdentityStore) {}

  async execute(accountId: string): Promise<Result<{ id: string; fullName: string; profile: Profile }>> {
    const account = await this.store.findById(accountId)
    if (!account || !account.emailConfirmed) return fail('unauthenticated', 'Sign in to continue.', 401)
    return ok({ id: account.id, fullName: account.fullName, profile: account.profile })
  }
}
