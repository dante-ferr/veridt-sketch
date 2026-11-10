import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { EventConsumer } from './infrastructure/event-consumer'

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] })
  app.setGlobalPrefix('v1')
  app.enableShutdownHooks()
  await app.listen(3000, '0.0.0.0')
  app.get(EventConsumer).start()
  console.log(JSON.stringify({ msg: 'service_ready', service: 'notification', port: 3000 }))
}

main()
