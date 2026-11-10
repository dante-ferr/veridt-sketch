import { createHash, timingSafeEqual } from 'node:crypto'
import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
  Body,
} from '@nestjs/common'
import { ZodError } from 'zod'
import { IdentityStore } from '../application/identity-store'
import type { Result } from '../application/result'
import {
  ConfirmEmail,
  GetAccount,
  LogIn,
  LogOut,
  RefreshSession,
  RegisterAccount,
  RequestPasswordReset,
  ResetPassword,
} from '../application/use-cases'
import { credentialsBody, emailBody, refreshBody, registerBody, resetBody, tokenBody } from './schemas'
import { Config } from '../infrastructure/config'

export function bearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

function send<T>(result: Result<T>): T {
  if (!result.ok) throw new HttpException({ error: result.error, message: result.message }, result.status)
  return result.value
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>()
    if (exception instanceof ZodError) {
      response.status(400).json({ error: 'invalid_input', message: 'Check the form fields.' })
      return
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse()
      response.status(exception.getStatus()).json(typeof body === 'string' ? { error: 'request_failed', message: body } : body)
      return
    }
    console.log(JSON.stringify({ msg: 'internal_error', type: exception instanceof Error ? exception.name : 'error' }))
    response.status(500).json({ error: 'internal_error', message: 'The operation could not be completed.' })
  }
}

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly registerAccount: RegisterAccount,
    private readonly confirmEmail: ConfirmEmail,
  ) {}

  @Post()
  @HttpCode(201)
  register(@Body() body: unknown) {
    const input = registerBody.parse(body)
    return this.registerAccount.execute(input, new Date()).then(send)
  }

  @Post('confirmation')
  @HttpCode(200)
  confirm(@Body() body: unknown) {
    const input = tokenBody.parse(body)
    return this.confirmEmail.execute(input.token, new Date()).then(send)
  }
}

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly logIn: LogIn,
    private readonly refreshSession: RefreshSession,
    private readonly logOut: LogOut,
    private readonly store: IdentityStore,
  ) {}

  @Post()
  @HttpCode(200)
  login(@Body() body: unknown) {
    const input = credentialsBody.parse(body)
    return this.logIn.execute(input.email, input.password, new Date()).then(send)
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    const input = refreshBody.parse(body)
    return this.refreshSession.execute(input.refreshToken, new Date()).then(send)
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const accessToken = bearer(authorization)
    if (!accessToken) throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    let access: { sub: string }
    try {
      access = await this.store.verifyAccessToken(accessToken)
    } catch {
      throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    }
    const input = refreshBody.parse(body)
    send(await this.logOut.execute(access.sub, input.refreshToken, new Date()))
  }
}

@Controller('password-recoveries')
export class PasswordRecoveriesController {
  constructor(private readonly requestPasswordReset: RequestPasswordReset) {}

  @Post()
  @HttpCode(202)
  request(@Body() body: unknown) {
    const input = emailBody.parse(body)
    return this.requestPasswordReset.execute(input.email, new Date()).then(send)
  }
}

@Controller('password-resets')
export class PasswordResetsController {
  constructor(private readonly resetPassword: ResetPassword) {}

  @Post()
  @HttpCode(200)
  reset(@Body() body: unknown) {
    const input = resetBody.parse(body)
    return this.resetPassword.execute(input.token, input.password, input.passwordConfirmation, new Date()).then(send)
  }
}

@Controller('me')
export class MeController {
  constructor(
    private readonly getAccount: GetAccount,
    private readonly store: IdentityStore,
  ) {}

  @Get()
  async me(@Headers('authorization') authorization: string | undefined) {
    const accessToken = bearer(authorization)
    if (!accessToken) throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    let access: { sub: string }
    try {
      access = await this.store.verifyAccessToken(accessToken)
    } catch {
      throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    }
    return send(await this.getAccount.execute(access.sub))
  }
}

@Controller('keys')
export class KeysController {
  constructor(private readonly store: IdentityStore) {}

  @Get('jwks')
  jwks() {
    return this.store.jwks()
  }
}

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }
}

@Controller('internal/accounts')
export class InternalAccountsController {
  constructor(
    private readonly store: IdentityStore,
    private readonly config: Config,
  ) {}

  @Get(':id/contact')
  contact(@Param('id') id: string, @Headers('x-service-token') token?: string) {
    return this.lookup(id, token, 'contact')
  }

  @Get(':id/report')
  report(@Param('id') id: string, @Headers('x-service-token') token?: string) {
    return this.lookup(id, token, 'report')
  }

  private async lookup(id: string, token: string | undefined, kind: 'contact' | 'report') {
    if (!sameSecret(token, this.config.serviceToken)) {
      throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    }
    const profile = kind === 'contact' ? await this.store.findContact(id) : await this.store.findReportProfile(id)
    if (!profile) throw new HttpException({ error: 'not_found', message: 'Account not found.' }, 404)
    return profile
  }
}

function sameSecret(provided: string | undefined, expected: string): boolean {
  const left = createHash('sha256').update(provided ?? '').digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right) && Boolean(provided)
}
