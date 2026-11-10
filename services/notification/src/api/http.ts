import { Controller, Get, Headers, HttpCode, HttpException, Injectable } from '@nestjs/common'
import { remoteJwks, verifyAccessToken } from '@veridt/auth'
import { Config } from '../infrastructure/config'

@Injectable()
export class TokenChecker {
  private readonly keys: ReturnType<typeof remoteJwks>

  constructor(private readonly config: Config) {
    this.keys = remoteJwks(config.jwksUrl)
  }

  async require(header: string | undefined): Promise<void> {
    const token = bearer(header)
    if (!token) throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    try {
      await verifyAccessToken(token, this.keys, { issuer: this.config.issuer, audience: this.config.audience })
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

@Controller('session')
export class SessionController {
  constructor(private readonly tokens: TokenChecker) {}

  @Get()
  @HttpCode(204)
  check(@Headers('authorization') authorization?: string) {
    return this.tokens.require(authorization)
  }
}
