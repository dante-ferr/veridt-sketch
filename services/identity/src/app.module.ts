import { Module } from '@nestjs/common'
import { IdentityStore } from './application/identity-store'
import {
  ConfirmEmail,
  GetAccount,
  LogIn,
  LogOut,
  RefreshSession,
  RegisterAccount,
  RequestPasswordReset,
  ResetPassword,
} from './application/use-cases'
import {
  AccountsController,
  HealthController,
  InternalAccountsController,
  KeysController,
  MeController,
  PasswordRecoveriesController,
  PasswordResetsController,
  SessionsController,
} from './api/http'
import { Config } from './infrastructure/config'
import { OutboxPublisher } from './infrastructure/outbox-publisher'
import { PrismaIdentityStore } from './infrastructure/prisma-identity-store'
import { PrismaService } from './infrastructure/prisma.service'

@Module({
  controllers: [
    AccountsController,
    SessionsController,
    PasswordRecoveriesController,
    PasswordResetsController,
    MeController,
    KeysController,
    HealthController,
    InternalAccountsController,
  ],
  providers: [
    { provide: Config, useFactory: () => Config.read() },
    PrismaService,
    PrismaIdentityStore,
    { provide: IdentityStore, useExisting: PrismaIdentityStore },
    OutboxPublisher,
    RegisterAccount,
    ConfirmEmail,
    LogIn,
    RefreshSession,
    LogOut,
    RequestPasswordReset,
    ResetPassword,
    GetAccount,
  ],
})
export class AppModule {}
