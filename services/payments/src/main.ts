import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { HttpErrorFilter } from './api/http'
import { EventConsumer } from './infrastructure/event-consumer'
import { PaymentsService } from './infrastructure/payments.service'

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error'], rawBody: true })
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new HttpErrorFilter())
  app.enableShutdownHooks()
  await app.get(PaymentsService).seed()
  await app.listen(3000, '0.0.0.0')
  app.get(EventConsumer).start()
  console.log(JSON.stringify({ msg: 'service_ready', service: 'payments', port: 3000 }))
}

main()
