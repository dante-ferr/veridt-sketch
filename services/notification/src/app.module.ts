import { Module } from '@nestjs/common'
import { HealthController, SessionController, TokenChecker } from './api/http'
import { Config } from './infrastructure/config'
import { EventConsumer } from './infrastructure/event-consumer'
import { PrismaService } from './infrastructure/prisma.service'
import { SmtpMailer } from './infrastructure/smtp-mailer'

@Module({
  controllers: [HealthController, SessionController],
  providers: [
    { provide: Config, useFactory: () => Config.read() },
    PrismaService,
    SmtpMailer,
    EventConsumer,
    TokenChecker,
  ],
})
export class AppModule {}
