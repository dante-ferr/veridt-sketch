import { Module } from '@nestjs/common'
import {
  BalanceController,
  HealthController,
  InternalController,
  OrdersController,
  PackagesController,
  WebhookController,
} from './api/http'
import { Config } from './infrastructure/config'
import { EventConsumer } from './infrastructure/event-consumer'
import { PaymentJobs } from './infrastructure/jobs'
import { OutboxPublisher } from './infrastructure/outbox-publisher'
import { PaymentsService } from './infrastructure/payments.service'
import { PrismaService } from './infrastructure/prisma.service'

@Module({
  controllers: [PackagesController, BalanceController, OrdersController, WebhookController, InternalController, HealthController],
  providers: [
    { provide: Config, useFactory: () => Config.read() },
    PrismaService,
    PaymentsService,
    OutboxPublisher,
    EventConsumer,
    PaymentJobs,
  ],
})
export class AppModule {}
