import { Module } from '@nestjs/common'
import { CreditReservationPort } from './application/credit-reservation'
import { CaptureStore, StartCapture, VideoSessionPort } from './application/start-capture'
import {
  CapturesController,
  HealthController,
  InternalCaptureController,
  SigningKeyController,
} from './api/http'
import { CaptureBroker } from './infrastructure/broker'
import { HttpCreditReservation } from './infrastructure/http-credits'
import { IdentityDirectory, WorkerVideoSessions } from './infrastructure/clients'
import { Config } from './infrastructure/config'
import { ManifestSigner } from './infrastructure/manifest-signer'
import { PrismaCaptureStore } from './infrastructure/prisma-capture-store'
import { PrismaService } from './infrastructure/prisma.service'
import { S3EvidenceObjects } from './infrastructure/s3-evidence'

@Module({
  controllers: [CapturesController, SigningKeyController, InternalCaptureController, HealthController],
  providers: [
    { provide: Config, useFactory: () => Config.read() },
    PrismaService,
    PrismaCaptureStore,
    { provide: CaptureStore, useExisting: PrismaCaptureStore },
    S3EvidenceObjects,
    ManifestSigner,
    IdentityDirectory,
    WorkerVideoSessions,
    { provide: VideoSessionPort, useExisting: WorkerVideoSessions },
    { provide: CreditReservationPort, useClass: HttpCreditReservation },
    StartCapture,
    CaptureBroker,
  ],
})
export class AppModule {}
