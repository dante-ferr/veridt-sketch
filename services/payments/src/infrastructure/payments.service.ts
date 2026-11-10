import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/client'
import {
  applyChargeStatus,
  auditCaches,
  billingError,
  consumeReservation,
  emptyWorld,
  freezePackage,
  pixLifetimeMs,
  placeOrder,
  reserveCredit,
  returnReservation,
  seedPackages,
  sumEntries,
  type Billing,
  type Charge,
  type LedgerEntry,
  type Order,
  type PackageOffer,
  type World,
} from '../domain/books'
import { canonicalJson, signatureMatches, signRaw } from '../domain/signature'
import { Config } from './config'
import { MercadoPagoProvider } from './mercadopago'
import { PrismaService } from './prisma.service'

export type PaymentResult<T> = { ok: true; value: T } | { ok: false; error: string; message: string; status: number }

type Tx = Prisma.TransactionClient

@Injectable()
export class PaymentsService {
  private readonly mercadoPago: MercadoPagoProvider

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: Config,
  ) {
    this.mercadoPago = new MercadoPagoProvider(config.mercadoPagoToken)
  }

  async seed(): Promise<void> {
    for (const item of seedPackages) {
      await this.prisma.creditPackage.upsert({
        where: { code: item.code },
        create: item,
        update: {},
      })
    }
  }

  async packages(): Promise<PackageOffer[]> {
    const rows = await this.prisma.creditPackage.findMany({ where: { active: true }, orderBy: { creditCount: 'asc' } })
    return rows.map(toPackage)
  }

  async balance(accountId: string): Promise<{ available: number }> {
    const row = await this.prisma.balanceCache.findUnique({ where: { accountId } })
    return { available: row?.available ?? 0 }
  }

  async orders(accountId: string) {
    const rows = await this.prisma.creditOrder.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return rows.map((row) => present(toOrder(row), this.config.provider))
  }

  async order(accountId: string, orderId: string): Promise<PaymentResult<ReturnType<typeof present>>> {
    const row = await this.prisma.creditOrder.findFirst({ where: { id: orderId, accountId } })
    if (!row) return fail('not_found', 'Order not found.', 404)
    return ok(present(toOrder(row), this.config.provider))
  }

  async createOrder(input: {
    accountId: string
    packageId: string
    method: 'pix' | 'checkout'
    billing: Billing
  }): Promise<PaymentResult<ReturnType<typeof present>>> {
    const invalid = billingError(input.billing)
    if (invalid) return fail(invalid, 'Check the billing fields.', 400)
    const offerRow = await this.prisma.creditPackage.findFirst({ where: { id: input.packageId, active: true } })
    if (!offerRow) return fail('unknown_package', 'Choose a package.', 404)
    const offer = toPackage(offerRow)
    const frozen = freezePackage(offer)
    const orderId = randomUUID()
    const now = new Date()
    let charge: Charge
    try {
      charge = await this.openCharge({
        orderId,
        method: input.method,
        amountCents: frozen.totalCents,
        title: offer.name,
        email: input.billing.email,
        now,
      })
    } catch {
      return fail('payments_unavailable', 'The payment provider is not responding.', 503)
    }
    const order: Order = {
      id: orderId,
      accountId: input.accountId,
      packageId: offer.id,
      ...frozen,
      method: input.method,
      state: 'PENDENTE',
      providerPaymentId: charge.providerPaymentId,
      pixCopyPaste: charge.pixCopyPaste,
      checkoutUrl: charge.checkoutUrl,
      expiresAt: charge.expiresAt,
      billing: input.billing,
      createdAt: now.toISOString(),
    }
    await this.mutate(input.accountId, (world) => ({ world: placeOrder(world, order, charge), result: undefined }))
    return ok(present(order, this.config.provider))
  }

  async confirmTest(accountId: string, orderId: string): Promise<PaymentResult<ReturnType<typeof present>>> {
    if (this.config.provider !== 'fake') {
      return fail('test_payment_unavailable', 'The test confirmation is only available on the fake provider.', 404)
    }
    const row = await this.prisma.creditOrder.findFirst({ where: { id: orderId, accountId } })
    if (!row) return fail('not_found', 'Order not found.', 404)
    if (row.state !== 'PENDENTE') return this.order(accountId, orderId)
    await this.prisma.providerCharge.update({
      where: { providerPaymentId: row.providerPaymentId },
      data: { status: 'approved' },
    })
    const raw = canonicalJson({ providerPaymentId: row.providerPaymentId })
    const received = await this.webhook(raw, signRaw(this.config.webhookSecret, raw))
    if (!received.ok) return received
    return this.order(accountId, orderId)
  }

  async webhook(raw: string, signature: string | undefined): Promise<PaymentResult<{ state: string }>> {
    if (!signatureMatches(this.config.webhookSecret, raw, signature)) {
      return fail('invalid_signature', 'The webhook signature is invalid.', 401)
    }
    let body: { providerPaymentId?: string; data?: { id?: string | number } }
    try {
      body = JSON.parse(raw) as { providerPaymentId?: string; data?: { id?: string | number } }
    } catch {
      return fail('invalid_input', 'Check the webhook body.', 400)
    }
    const hintedId = body.providerPaymentId ?? (body.data?.id !== undefined ? String(body.data.id) : '')
    if (!hintedId) return fail('invalid_input', 'Check the webhook body.', 400)
    if (this.config.provider === 'mercadopago') {
      try {
        const live = await this.mercadoPago.query(hintedId)
        const orderId = live.externalReference
        const order = orderId
          ? await this.prisma.creditOrder.findUnique({ where: { id: orderId } })
          : await this.prisma.creditOrder.findUnique({ where: { providerPaymentId: hintedId } })
        if (!order) return fail('unknown_payment', 'Payment not found.', 404)
        await this.prisma.providerCharge.update({
          where: { providerPaymentId: order.providerPaymentId },
          data: { status: live.status },
        })
        const applied = await this.applyStored(order.accountId, order.providerPaymentId)
        return ok({ state: applied.state })
      } catch {
        return fail('payments_unavailable', 'The payment provider is not responding.', 503)
      }
    }
    const order = await this.prisma.creditOrder.findUnique({ where: { providerPaymentId: hintedId } })
    if (!order) return fail('unknown_payment', 'Payment not found.', 404)
    const applied = await this.applyStored(order.accountId, order.providerPaymentId)
    return ok({ state: applied.state })
  }

  async reserve(input: { accountId: string; recordId: string; credits: number }): Promise<PaymentResult<{ reservationId: string }>> {
    const result = await this.mutate(input.accountId, (world) =>
      reserveCredit(world, { ...input, entryId: randomUUID() }),
    )
    if (result.outcome === 'reserved') return ok({ reservationId: result.reservationId })
    if (result.outcome === 'insufficient') {
      return fail('insufficient_credits', 'There are not enough credits for this record.', 409)
    }
    if (result.outcome === 'invalid_amount') return fail('invalid_amount', 'A record reserves 1 credit.', 400)
    return fail('reservation_conflict', 'This record already moved its credit.', 409)
  }

  async release(recordId: string): Promise<PaymentResult<{ result: string }>> {
    const reservation = await this.prisma.ledgerEntry.findFirst({ where: { recordId, kind: 'reservation' } })
    if (!reservation) return ok({ result: 'missing' })
    const result = await this.mutate(reservation.accountId, (world) =>
      returnReservation(world, recordId, { entryId: randomUUID(), eventId: randomUUID() }, new Date().toISOString()),
    )
    return ok({ result })
  }

  async onCapture(type: 'CapturaConcluida' | 'CapturaFalhou' | 'CapturaCancelada', recordId: string): Promise<void> {
    const reservation = await this.prisma.ledgerEntry.findFirst({ where: { recordId, kind: 'reservation' } })
    if (!reservation) return
    await this.mutate(reservation.accountId, (world) => {
      if (type === 'CapturaConcluida') return consumeReservation(world, recordId, randomUUID())
      return returnReservation(world, recordId, { entryId: randomUUID(), eventId: randomUUID() }, new Date().toISOString())
    })
  }

  async reconcile(): Promise<void> {
    const cutoff = new Date(Date.now() - this.config.reconcileMinAgeMs)
    const pending = await this.prisma.creditOrder.findMany({
      where: { state: 'PENDENTE', createdAt: { lte: cutoff } },
      take: 50,
      orderBy: { createdAt: 'asc' },
    })
    for (const order of pending) {
      if (this.config.provider === 'mercadopago') {
        try {
          const live = await this.mercadoPago.query(order.providerPaymentId)
          await this.prisma.providerCharge.update({
            where: { providerPaymentId: order.providerPaymentId },
            data: { status: live.status },
          })
        } catch (error) {
          console.log(JSON.stringify({ msg: 'reconcile_query_failed', orderId: order.id, type: error instanceof Error ? error.name : 'error' }))
          continue
        }
      }
      await this.applyStored(order.accountId, order.providerPaymentId)
    }
  }

  async audit(): Promise<void> {
    const rows = await this.prisma.balanceCache.findMany()
    for (const row of rows) {
      const entries = await this.prisma.ledgerEntry.findMany({ where: { accountId: row.accountId } })
      const world = emptyWorld()
      world.entries = entries.map(toEntry)
      world.cache[row.accountId] = row.available
      const mismatches = auditCaches(world)
      if (mismatches.length > 0) {
        console.log(JSON.stringify({ msg: 'ledger_cache_mismatch', accountId: row.accountId, ledger: sumEntries(world.entries), cache: row.available }))
      }
    }
  }

  private async applyStored(accountId: string, providerPaymentId: string): Promise<{ state: string }> {
    return this.mutate(accountId, (world) => {
      const applied = applyChargeStatus(world, providerPaymentId, new Date().toISOString(), {
        entryId: randomUUID(),
        eventId: randomUUID(),
      })
      const state = applied.result.outcome === 'unknown_payment' || applied.result.outcome === 'invalid_transition'
        ? world.orders.find((item) => item.providerPaymentId === providerPaymentId)?.state ?? 'PENDENTE'
        : applied.result.state
      return { world: applied.world, result: { state } }
    })
  }

  private async openCharge(input: {
    orderId: string
    method: 'pix' | 'checkout'
    amountCents: number
    title: string
    email: string
    now: Date
  }): Promise<Charge> {
    const expiresAt = new Date(input.now.getTime() + pixLifetimeMs).toISOString()
    const checkoutUrl = `${this.config.webOrigin}/credits/orders/${input.orderId}`
    if (this.config.provider === 'mercadopago') {
      const created = input.method === 'pix'
        ? await this.mercadoPago.createPix({
            orderId: input.orderId,
            amountCents: input.amountCents,
            description: input.title,
            email: input.email,
          })
        : await this.mercadoPago.createCheckout({
            orderId: input.orderId,
            title: input.title,
            amountCents: input.amountCents,
            email: input.email,
            backUrl: checkoutUrl,
          })
      return {
        providerPaymentId: created.providerPaymentId,
        status: created.status,
        method: input.method,
        amountCents: input.amountCents,
        expiresAt,
        pixCopyPaste: created.pixCopyPaste,
        checkoutUrl: created.checkoutUrl || checkoutUrl,
      }
    }
    const providerPaymentId = randomUUID()
    return {
      providerPaymentId,
      status: 'pending',
      method: input.method,
      amountCents: input.amountCents,
      expiresAt,
      pixCopyPaste: `00020126FAKEVERIDIT${providerPaymentId.replaceAll('-', '')}`,
      checkoutUrl,
    }
  }

  private async mutate<T>(accountId: string, change: (world: World) => { world: World; result: T }): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`
      const before = await loadWorld(tx, accountId)
      const changed = change(before)
      if (changed.world !== before) await saveDiff(tx, before, changed.world)
      return changed.result
    })
  }
}

async function loadWorld(tx: Tx, accountId: string): Promise<World> {
  const [packages, orders, entries, cache] = await Promise.all([
    tx.creditPackage.findMany(),
    tx.creditOrder.findMany({ where: { accountId } }),
    tx.ledgerEntry.findMany({ where: { accountId } }),
    tx.balanceCache.findUnique({ where: { accountId } }),
  ])
  const charges = orders.length
    ? await tx.providerCharge.findMany({ where: { providerPaymentId: { in: orders.map((order) => order.providerPaymentId) } } })
    : []
  const world = emptyWorld(packages.map(toPackage))
  world.orders = orders.map(toOrder)
  world.charges = charges.map(toCharge)
  world.entries = entries.map(toEntry)
  if (cache) world.cache[accountId] = cache.available
  return world
}

async function saveDiff(tx: Tx, before: World, after: World): Promise<void> {
  const entryIds = new Set(before.entries.map((entry) => entry.id))
  for (const entry of after.entries) {
    if (entryIds.has(entry.id)) continue
    await tx.ledgerEntry.create({
      data: {
        id: entry.id,
        accountId: entry.accountId,
        kind: entry.kind,
        credits: entry.credits,
        recordId: entry.recordId,
        orderId: entry.orderId,
        createdAt: new Date(),
      },
    })
  }
  const orderIds = new Set(before.orders.map((order) => order.id))
  for (const order of after.orders) {
    if (!orderIds.has(order.id)) {
      await tx.creditOrder.create({ data: orderData(order) })
      continue
    }
    const previous = before.orders.find((item) => item.id === order.id)
    if (previous && previous.state !== order.state) {
      await tx.creditOrder.update({ where: { id: order.id }, data: { state: order.state } })
    }
  }
  const chargeIds = new Set(before.charges.map((charge) => charge.providerPaymentId))
  for (const charge of after.charges) {
    if (!chargeIds.has(charge.providerPaymentId)) {
      await tx.providerCharge.create({ data: chargeData(charge) })
      continue
    }
    const previous = before.charges.find((item) => item.providerPaymentId === charge.providerPaymentId)
    if (previous && previous.status !== charge.status) {
      await tx.providerCharge.update({
        where: { providerPaymentId: charge.providerPaymentId },
        data: { status: charge.status },
      })
    }
  }
  const outboxIds = new Set(before.outbox.map((item) => item.id))
  for (const item of after.outbox) {
    if (outboxIds.has(item.id)) continue
    await tx.outbox.create({
      data: {
        id: item.id,
        type: item.type,
        occurredAt: new Date(item.occurredAt),
        payload: item.payload as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    })
  }
  const accounts = new Set([...Object.keys(before.cache), ...Object.keys(after.cache)])
  for (const accountId of accounts) {
    if ((before.cache[accountId] ?? 0) === (after.cache[accountId] ?? 0) && before.cache[accountId] !== undefined) continue
    if (after.cache[accountId] === undefined) continue
    await tx.balanceCache.upsert({
      where: { accountId },
      create: { accountId, available: after.cache[accountId] ?? 0 },
      update: { available: after.cache[accountId] ?? 0 },
    })
  }
}

function orderData(order: Order): Prisma.CreditOrderCreateInput {
  return {
    id: order.id,
    accountId: order.accountId,
    packageId: order.packageId,
    packageName: order.packageName,
    creditCount: order.creditCount,
    pricePerCreditCents: order.pricePerCreditCents,
    totalCents: order.totalCents,
    method: order.method,
    state: order.state,
    providerPaymentId: order.providerPaymentId,
    pixCopyPaste: order.pixCopyPaste,
    checkoutUrl: order.checkoutUrl,
    expiresAt: new Date(order.expiresAt),
    billing: order.billing as unknown as Prisma.InputJsonValue,
    createdAt: new Date(order.createdAt),
  }
}

function chargeData(charge: Charge): Prisma.ProviderChargeCreateInput {
  return {
    providerPaymentId: charge.providerPaymentId,
    status: charge.status,
    method: charge.method,
    amountCents: charge.amountCents,
    expiresAt: new Date(charge.expiresAt),
    pixCopyPaste: charge.pixCopyPaste,
    checkoutUrl: charge.checkoutUrl,
  }
}

function toPackage(row: {
  id: string
  code: string
  name: string
  creditCount: number
  pricePerCreditCents: number
  description: string
  active: boolean
}): PackageOffer {
  return { ...row }
}

function toOrder(row: {
  id: string
  accountId: string
  packageId: string
  packageName: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
  method: string
  state: string
  providerPaymentId: string
  pixCopyPaste: string
  checkoutUrl: string
  expiresAt: Date
  billing: Prisma.JsonValue
  createdAt: Date
}): Order {
  return {
    id: row.id,
    accountId: row.accountId,
    packageId: row.packageId,
    packageName: row.packageName,
    creditCount: row.creditCount,
    pricePerCreditCents: row.pricePerCreditCents,
    totalCents: row.totalCents,
    method: row.method === 'checkout' ? 'checkout' : 'pix',
    state: row.state as Order['state'],
    providerPaymentId: row.providerPaymentId,
    pixCopyPaste: row.pixCopyPaste,
    checkoutUrl: row.checkoutUrl,
    expiresAt: row.expiresAt.toISOString(),
    billing: row.billing as Billing,
    createdAt: row.createdAt.toISOString(),
  }
}

function toCharge(row: {
  providerPaymentId: string
  status: string
  method: string
  amountCents: number
  expiresAt: Date
  pixCopyPaste: string
  checkoutUrl: string
}): Charge {
  return {
    providerPaymentId: row.providerPaymentId,
    status: row.status as Charge['status'],
    method: row.method === 'checkout' ? 'checkout' : 'pix',
    amountCents: row.amountCents,
    expiresAt: row.expiresAt.toISOString(),
    pixCopyPaste: row.pixCopyPaste,
    checkoutUrl: row.checkoutUrl,
  }
}

function toEntry(row: {
  id: string
  accountId: string
  kind: string
  credits: number
  recordId: string | null
  orderId: string | null
}): LedgerEntry {
  return {
    id: row.id,
    accountId: row.accountId,
    kind: row.kind as LedgerEntry['kind'],
    credits: row.credits,
    recordId: row.recordId,
    orderId: row.orderId,
  }
}

function present(order: Order, provider: string) {
  return {
    id: order.id,
    packageName: order.packageName,
    creditCount: order.creditCount,
    pricePerCreditCents: order.pricePerCreditCents,
    totalCents: order.totalCents,
    method: order.method,
    state: order.state,
    pixCopyPaste: order.pixCopyPaste,
    checkoutUrl: order.checkoutUrl,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    testConfirmation: provider === 'fake',
  }
}

function ok<T>(value: T): PaymentResult<T> {
  return { ok: true, value }
}

function fail(error: string, message: string, status: number): PaymentResult<never> {
  return { ok: false, error, message, status }
}
