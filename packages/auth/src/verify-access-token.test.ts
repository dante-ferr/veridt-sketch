import { exportPKCS8, exportSPKI, generateKeyPair, importPKCS8, importSPKI, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { MAX_ACCESS_TOKEN_TTL_SECONDS, verifyAccessToken } from './index'

const issuer = 'veridit-identity'
const audience = 'veridit'

describe('access token ttl', () => {
  it('accepts 15 minutes and rejects a longer lifetime', async () => {
    expect(MAX_ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60)
    const pair = await generateKeyPair('EdDSA')
    const privateKey = await importPKCS8(await exportPKCS8(pair.privateKey), 'EdDSA')
    const publicKey = await importSPKI(await exportSPKI(pair.publicKey), 'EdDSA')
    const now = Math.floor(Date.now() / 1000)
    const sign = (ttl: number) =>
      new SignJWT({ profile: 'lawyer' })
        .setProtectedHeader({ alg: 'EdDSA', kid: 'test' })
        .setSubject('11111111-1111-4111-8111-111111111111')
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt(now)
        .setExpirationTime(now + ttl)
        .sign(privateKey)

    const options = { issuer, audience }
    const resolveKey = async () => publicKey
    await expect(verifyAccessToken(await sign(MAX_ACCESS_TOKEN_TTL_SECONDS), resolveKey, options)).resolves.toMatchObject({
      profile: 'lawyer',
    })
    await expect(verifyAccessToken(await sign(MAX_ACCESS_TOKEN_TTL_SECONDS + 60), resolveKey, options)).rejects.toThrow(
      'token_ttl_too_long',
    )
  })
})
