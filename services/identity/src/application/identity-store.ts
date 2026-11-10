import type { EmailEvent } from '@veridt/events'
import type { LoginState } from '../domain/login'

export type Profile = 'lawyer' | 'common_user'

export type StoredAccount = {
  id: string
  email: string
  fullName: string
  passwordHash: string
  profile: Profile
  emailConfirmed: boolean
  loginState: LoginState
}

export type AccountSummary = {
  id: string
  fullName: string
  email: string
  profile: Profile
  emailConfirmed: boolean
}

export type NewAccount = {
  id: string
  email: string
  fullName: string
  passwordHash: string
  profile: Profile
  cpfCiphertext: string
  cpfHmac: string
  oabCiphertext: string | null
  createdAt: Date
  tokenId: string
  tokenHmac: string
  tokenExpiresAt: Date
  event: EmailEvent
}

export type PasswordResetDraft = {
  accountId: string
  tokenId: string
  tokenHmac: string
  expiresAt: Date
  createdAt: Date
  event: EmailEvent
}

export type StoredSession = {
  accountId: string
  profile: Profile
  emailConfirmed: boolean
  expiresAt: Date
  revokedAt: Date | null
}

export abstract class IdentityStore {
  abstract findByEmail(email: string): Promise<StoredAccount | null>
  abstract findById(id: string): Promise<AccountSummary | null>
  abstract hashPassword(password: string): Promise<string>
  abstract passwordMatches(hash: string, password: string): Promise<boolean>
  abstract checkDummyPassword(password: string): Promise<void>
  abstract encryptCpf(cpf: string): string
  abstract hmacCpf(cpf: string): string
  abstract encryptOab(oab: string): string
  abstract newOpaqueToken(): string
  abstract hmacToken(token: string): string
  abstract hmacRefresh(token: string): string
  abstract issueAccessToken(accountId: string, profile: Profile, now: Date): Promise<string>
  abstract verifyAccessToken(token: string): Promise<{ sub: string; profile: Profile }>
  abstract saveAccount(data: NewAccount): Promise<'ok' | 'email' | 'cpf'>
  abstract saveLoginState(accountId: string, state: LoginState): Promise<void>
  abstract createSession(accountId: string, refreshHmac: string, expiresAt: Date): Promise<void>
  abstract findSession(refreshHmac: string): Promise<StoredSession | null>
  abstract revokeSession(refreshHmac: string, accountId: string, now: Date): Promise<void>
  abstract confirmEmail(tokenHmac: string, now: Date): Promise<'ok' | 'invalid'>
  abstract countPasswordResets(accountId: string, since: Date): Promise<number>
  abstract savePasswordReset(data: PasswordResetDraft): Promise<void>
  abstract resetPassword(tokenHmac: string, passwordHash: string, now: Date): Promise<'ok' | 'invalid'>
  abstract jwks(): { keys: unknown[] }
  abstract findContact(id: string): Promise<{ fullName: string; email: string } | null>
  abstract findReportProfile(id: string): Promise<{ fullName: string; email: string; cpf: string } | null>
}
