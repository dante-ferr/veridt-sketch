import { createHash, timingSafeEqual } from 'node:crypto'
import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
} from '@nestjs/common'
import { remoteJwks, verifyAccessToken, type Access } from '@veridt/auth'
import { z, ZodError } from 'zod'
import type { Billing } from '../domain/books'
import { Config } from '../infrastructure/config'
import { PaymentsService, type PaymentResult } from '../infrastructure/payments.service'

const billingBody = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  cpf: z.string(),
  postalCode: z.string(),
  street: z.string(),
  number: z.string(),
  complement: z.string().optional().default(''),
  district: z.string(),
  city: z.string(),
  state: z.string(),
})

const orderBody = z.object({
  packageId: z.string().uuid(),
  method: z.enum(['pix', 'checkout']),
  billing: billingBody,
})

const reserveBody = z.object({
  accountId: z.string().uuid(),
  recordId: z.string().uuid(),
  credits: z.number().int().positive(),
})

const releaseBody = z.object({ recordId: z.string().uuid() })

function send<T>(result: PaymentResult<T>): T {
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

@Controller('credit-packages')
export class PackagesController {
  private jwks: ReturnType<typeof remoteJwks> | null = null

  constructor(private readonly payments: PaymentsService, private readonly config: Config) {}

  @Get()
  async list(@Headers('authorization') authorization: string | undefined) {
    await accessFrom(authorization, this.keys(), this.config)
    const items = await this.payments.packages()
    return {
      items: items.map((item) => ({
        ...item,
        totalCents: item.creditCount * item.pricePerCreditCents,
      })),
    }
  }

  private keys(): ReturnType<typeof remoteJwks> {
    this.jwks ??= remoteJwks(this.config.jwksUrl)
    return this.jwks
  }
}

@Controller('credits')
export class BalanceController {
  private jwks: ReturnType<typeof remoteJwks> | null = null

  constructor(private readonly payments: PaymentsService, private readonly config: Config) {}

  @Get('balance')
  async balance(@Headers('authorization') authorization: string | undefined) {
    const access = await accessFrom(authorization, this.keys(), this.config)
    return this.payments.balance(access.sub)
  }

  private keys(): ReturnType<typeof remoteJwks> {
    this.jwks ??= remoteJwks(this.config.jwksUrl)
    return this.jwks
  }
}

@Controller('credit-orders')
export class OrdersController {
  private jwks: ReturnType<typeof remoteJwks> | null = null

  constructor(private readonly payments: PaymentsService, private readonly config: Config) {}

  @Get()
  async list(@Headers('authorization') authorization: string | undefined) {
    const access = await accessFrom(authorization, this.keys(), this.config)
    return { items: await this.payments.orders(access.sub) }
  }

  @Post()
  @HttpCode(201)
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const access = await accessFrom(authorization, this.keys(), this.config)
    const input = orderBody.parse(body)
    return this.payments.createOrder({
      accountId: access.sub,
      packageId: input.packageId,
      method: input.method,
      billing: normalizeBilling(input.billing),
    }).then(send)
  }

  @Get(':id')
  async show(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const access = await accessFrom(authorization, this.keys(), this.config)
    return this.payments.order(access.sub, id).then(send)
  }

  @Post(':id/test-payment')
  @HttpCode(200)
  async testPayment(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const access = await accessFrom(authorization, this.keys(), this.config)
    return this.payments.confirmTest(access.sub, id).then(send)
  }

  private keys(): ReturnType<typeof remoteJwks> {
    this.jwks ??= remoteJwks(this.config.jwksUrl)
    return this.jwks
  }
}

@Controller('payments')
export class WebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhooks/mercadopago')
  @HttpCode(200)
  webhook(
    @Req() request: { rawBody?: Buffer },
    @Headers('x-webhook-signature') signature?: string,
  ) {
    const raw = request.rawBody?.toString('utf8') ?? ''
    return this.payments.webhook(raw, signature).then(send)
  }
}

@Controller('internal')
export class InternalController {
  constructor(private readonly payments: PaymentsService, private readonly config: Config) {}

  @Post('reservations')
  @HttpCode(200)
  reserve(@Headers('x-service-token') token: string | undefined, @Body() body: unknown) {
    this.guard(token)
    const input = reserveBody.parse(body)
    return this.payments.reserve(input).then(send)
  }

  @Post('reservation-returns')
  @HttpCode(200)
  release(@Headers('x-service-token') token: string | undefined, @Body() body: unknown) {
    this.guard(token)
    const input = releaseBody.parse(body)
    return this.payments.release(input.recordId).then(send)
  }

  private guard(token: string | undefined): void {
    if (!sameSecret(token, this.config.serviceToken)) {
      throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
    }
  }
}

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }
}

function normalizeBilling(input: z.infer<typeof billingBody>): Billing {
  return {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.replace(/\D/g, ''),
    cpf: input.cpf.replace(/\D/g, ''),
    postalCode: input.postalCode.replace(/\D/g, ''),
    street: input.street.trim(),
    number: input.number.trim(),
    complement: input.complement.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
  }
}

async function accessFrom(
  header: string | undefined,
  keys: ReturnType<typeof remoteJwks>,
  config: Config,
): Promise<Access> {
  const token = bearer(header)
  if (!token) throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
  try {
    return await verifyAccessToken(token, keys, { issuer: config.issuer, audience: config.audience })
  } catch {
    throw new HttpException({ error: 'unauthenticated', message: 'Sign in to continue.' }, 401)
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

function sameSecret(provided: string | undefined, expected: string): boolean {
  const left = createHash('sha256').update(provided ?? '').digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right) && Boolean(provided)
}
