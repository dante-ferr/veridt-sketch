import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { Config } from './config'
import { PaymentsService } from './payments.service'

@Injectable()
export class PaymentJobs implements OnModuleInit, OnModuleDestroy {
  private reconcileTimer: NodeJS.Timeout | null = null
  private auditTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: Config,
  ) {}

  onModuleInit(): void {
    this.reconcileTimer = setInterval(() => {
      this.payments.reconcile().catch((error: unknown) => {
        console.log(JSON.stringify({ msg: 'reconcile_failed', type: error instanceof Error ? error.name : 'error' }))
      })
    }, this.config.reconcileIntervalMs)
    this.auditTimer = setInterval(() => {
      this.payments.audit().catch((error: unknown) => {
        console.log(JSON.stringify({ msg: 'audit_failed', type: error instanceof Error ? error.name : 'error' }))
      })
    }, this.config.auditIntervalMs)
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer)
    if (this.auditTimer) clearInterval(this.auditTimer)
  }
}
