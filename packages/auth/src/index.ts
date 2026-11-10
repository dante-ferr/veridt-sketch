import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Keep this aligned with ACCESS_TOKEN_TTL_SECONDS in the identity service.
export const MAX_ACCESS_TOKEN_TTL_SECONDS = 15 * 60

export type TokenProfile = 'lawyer' | 'common_user'

export type Access = {
  sub: string
  profile: TokenProfile
}

export async function verifyAccessToken(
  token: string,
  key: JWTVerifyGetKey,
  options: { issuer: string; audience: string },
): Promise<Access> {
  const { payload } = await jwtVerify(token, key, {
    issuer: options.issuer,
    audience: options.audience,
    algorithms: ['EdDSA'],
    clockTolerance: 5,
  })
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    throw new Error('token_missing_expiry')
  }
  if (payload.exp - payload.iat > MAX_ACCESS_TOKEN_TTL_SECONDS) {
    throw new Error('token_ttl_too_long')
  }
  if (payload.profile !== 'lawyer' && payload.profile !== 'common_user') {
    throw new Error('token_missing_profile')
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('token_missing_subject')
  }
  return { sub: payload.sub, profile: payload.profile }
}

export function remoteJwks(jwksUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
  })
}
