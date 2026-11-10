import 'reflect-metadata'
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ZodError } from 'zod'
import { AppModule } from './app.module'

@Catch()
class HttpErrorFilter implements ExceptionFilter {
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
    const message = exception instanceof Error ? exception.message : 'error'
    console.log(JSON.stringify({ msg: 'internal_error', type: exception instanceof Error ? exception.name : 'error', message }))
    response.status(500).json({ error: 'internal_error', message: 'The operation could not be completed.' })
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] })
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new HttpErrorFilter())
  app.enableShutdownHooks()
  await app.listen(3000, '0.0.0.0')
  console.log(JSON.stringify({ msg: 'service_ready', service: 'capture', port: 3000 }))
}

main()
