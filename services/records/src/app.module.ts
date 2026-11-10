import { Module } from '@nestjs/common'
import { HealthController, RecordsController } from './api/http'
import { CatalogConsumer } from './infrastructure/catalog-consumer'
import { Config } from './infrastructure/config'
import { ObjectStore } from './infrastructure/object-store'
import { PrismaService } from './infrastructure/prisma.service'

@Module({
  controllers: [RecordsController, HealthController],
  providers: [
    { provide: Config, useFactory: () => Config.read() },
    PrismaService,
    ObjectStore,
    CatalogConsumer,
  ],
})
export class AppModule {}
