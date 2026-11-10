import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { HttpErrorFilter } from './api/http'

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] })
  app.setGlobalPrefix('v1')
  app.useGlobalFilters(new HttpErrorFilter())
  app.enableShutdownHooks()
  await app.listen(3000, '0.0.0.0')
  console.log(JSON.stringify({ msg: 'service_ready', service: 'identity', port: 3000 }))
}

main()
