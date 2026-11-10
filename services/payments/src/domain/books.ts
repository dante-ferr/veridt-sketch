export const creditsPerRecord = 1
export const pixLifetimeMs = 30 * 60 * 1000

export const paymentStates = ['PENDENTE', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'ESTORNADO'] as const
export type PaymentState = (typeof paymentStates)[number]

const transitions: Record<PaymentState, readonly PaymentState[]> = {
  PENDENTE: ['APROVADO', 'RECUSADO', 'EXPIRADO'],
  APROVADO: ['ESTORNADO'],
  RECUSADO: [],
  EXPIRADO: [],
  ESTORNADO: [],
}

export function transition(current: PaymentState, next: PaymentState): PaymentState | null {
  if (current === next) return current
  if (!transitions[current].includes(next)) return null
  return next
}

export const ledgerKinds = ['purchase', 'reservation', 'consumption', 'reservation_return', 'refund_debit'] as const
export type LedgerKind = (typeof ledgerKinds)[number]

export type LedgerEntry = {
  id: string
  accountId: string
  kind: LedgerKind
  credits: number
  recordId: string | null
  orderId: string | null
}

export function effect(entry: Pick<LedgerEntry, 'kind' | 'credits'>): number {
  if (entry.kind === 'purchase' || entry.kind === 'reservation_return') return entry.credits
  if (entry.kind === 'reservation' || entry.kind === 'refund_debit') return -entry.credits
  return 0
}

export function sumEntries(entries: LedgerEntry[]): number {
  return entries.reduce((total, entry) => total + effect(entry), 0)
}

export type PackageOffer = {
  id: string
  code: string
  name: string
  creditCount: number
  pricePerCreditCents: number
  description: string
  active: boolean
}

export const seedPackages: PackageOffer[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'basic',
    name: 'Básico',
    creditCount: 10,
    pricePerCreditCents: 500,
    description: 'Para registros avulsos.',
    active: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'standard',
    name: 'Médio',
    creditCount: 30,
    pricePerCreditCents: 400,
    description: 'Para uso recorrente.',
    active: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'premium',
    name: 'Premium',
    creditCount: 100,
    pricePerCreditCents: 300,
    description: 'Para um volume maior, com o menor valor por crédito.',
    active: true,
  },
]

export type Billing = {
  fullName: string
  email: string
  phone: string
  cpf: string
  postalCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

export type ChargeStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'refunded'

export type Charge = {
  providerPaymentId: string
  status: ChargeStatus
  method: 'pix' | 'checkout'
  amountCents: number
  expiresAt: string
  pixCopyPaste: string
  checkoutUrl: string
}

export type Order = {
  id: string
  accountId: string
  packageId: string
  packageName: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
  method: 'pix' | 'checkout'
  state: PaymentState
  providerPaymentId: string
  pixCopyPaste: string
  checkoutUrl: string
  expiresAt: string
  billing: Billing
  createdAt: string
}

export type OutboxItem = {
  id: string
  type: 'PagamentoAprovado' | 'CreditoDevolvido'
  occurredAt: string
  payload: Record<string, unknown>
}

export type World = {
  packages: PackageOffer[]
  orders: Order[]
  charges: Charge[]
  entries: LedgerEntry[]
  cache: Record<string, number>
  outbox: OutboxItem[]
}

export function emptyWorld(packages: PackageOffer[] = seedPackages): World {
  return { packages: packages.map((item) => ({ ...item })), orders: [], charges: [], entries: [], cache: {}, outbox: [] }
}

export function freezePackage(offer: PackageOffer): {
  packageName: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
} {
  return {
    packageName: offer.name,
    creditCount: offer.creditCount,
    pricePerCreditCents: offer.pricePerCreditCents,
    totalCents: offer.creditCount * offer.pricePerCreditCents,
  }
}

export function billingError(billing: Billing): string | null {
  if (billing.fullName.trim().length < 3) return 'invalid_name'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email)) return 'invalid_email'
  if (billing.phone.trim().length < 8) return 'invalid_phone'
  if (!isValidCpf(billing.cpf)) return 'invalid_cpf'
  if (!/^\d{8}$/.test(billing.postalCode)) return 'invalid_postal_code'
  if (billing.street.trim().length < 1 || billing.number.trim().length < 1) return 'invalid_address'
  if (billing.district.trim().length < 1 || billing.city.trim().length < 1) return 'invalid_address'
  if (!/^[A-Z]{2}$/.test(billing.state)) return 'invalid_region'
  return null
}

export function placeOrder(world: World, order: Order, charge: Charge): World {
  const next = clone(world)
  next.orders.push({ ...order, billing: { ...order.billing } })
  next.charges.push({ ...charge })
  return next
}

export type ApplyResult =
  | { outcome: 'unchanged'; state: PaymentState }
  | { outcome: 'applied'; state: PaymentState }
  | { outcome: 'unknown_payment' }
  | { outcome: 'invalid_transition' }

export function applyChargeStatus(
  world: World,
  providerPaymentId: string,
  nowIso: string,
  ids: { entryId: string; eventId: string },
): { world: World; result: ApplyResult } {
  const order = world.orders.find((item) => item.providerPaymentId === providerPaymentId)
  const charge = world.charges.find((item) => item.providerPaymentId === providerPaymentId)
  if (!order || !charge) return { world, result: { outcome: 'unknown_payment' } }
  const viewed = viewCharge(charge, Date.parse(nowIso))
  const target = statusToState(viewed)
  if (!target || order.state === target) {
    if (viewed === charge.status) return { world, result: { outcome: 'unchanged', state: order.state } }
    const next = clone(world)
    const stored = next.charges.find((item) => item.providerPaymentId === providerPaymentId)
    if (stored) stored.status = viewed
    return { world: next, result: { outcome: 'unchanged', state: order.state } }
  }
  const moved = transition(order.state, target)
  if (!moved || moved === order.state) return { world, result: { outcome: 'invalid_transition' } }
  const next = clone(world)
  const storedOrder = next.orders.find((item) => item.id === order.id)
  const storedCharge = next.charges.find((item) => item.providerPaymentId === providerPaymentId)
  if (!storedOrder || !storedCharge) return { world, result: { outcome: 'unknown_payment' } }
  storedCharge.status = viewed
  storedOrder.state = moved
  if (moved === 'APROVADO') creditPurchase(next, storedOrder, ids, nowIso)
  if (moved === 'ESTORNADO') debitRefund(next, storedOrder, ids.entryId)
  return { world: next, result: { outcome: 'applied', state: moved } }
}

export function reconcilePending(
  world: World,
  nowMs: number,
  minAgeMs: number,
  idsFor: (index: number) => { entryId: string; eventId: string },
): World {
  const due = world.orders.filter(
    (order) => order.state === 'PENDENTE' && nowMs - Date.parse(order.createdAt) >= minAgeMs,
  )
  let current = world
  due.forEach((order, index) => {
    const applied = applyChargeStatus(current, order.providerPaymentId, new Date(nowMs).toISOString(), idsFor(index))
    current = applied.world
  })
  return current
}

export type ReserveResult =
  | { outcome: 'reserved'; reservationId: string }
  | { outcome: 'insufficient' }
  | { outcome: 'invalid_amount' }
  | { outcome: 'conflict' }

export function reserveCredit(
  world: World,
  input: { accountId: string; recordId: string; credits: number; entryId: string },
): { world: World; result: ReserveResult } {
  if (input.credits !== creditsPerRecord) return { world, result: { outcome: 'invalid_amount' } }
  const existing = world.entries.find((entry) => entry.recordId === input.recordId && entry.kind === 'reservation')
  if (existing) return { world, result: { outcome: 'reserved', reservationId: existing.id } }
  if (world.entries.some((entry) => entry.recordId === input.recordId && entry.kind !== 'reservation')) {
    return { world, result: { outcome: 'conflict' } }
  }
  const available = world.cache[input.accountId] ?? 0
  if (available < input.credits) return { world, result: { outcome: 'insufficient' } }
  const next = clone(world)
  pushEntry(next, {
    id: input.entryId,
    accountId: input.accountId,
    kind: 'reservation',
    credits: input.credits,
    recordId: input.recordId,
    orderId: null,
  })
  return { world: next, result: { outcome: 'reserved', reservationId: input.entryId } }
}

export type RecordMovement = 'consumed' | 'returned' | 'duplicate' | 'missing' | 'already_returned' | 'already_consumed'

export function consumeReservation(world: World, recordId: string, entryId: string): { world: World; result: RecordMovement } {
  if (world.entries.some((entry) => entry.recordId === recordId && entry.kind === 'consumption')) {
    return { world, result: 'duplicate' }
  }
  if (world.entries.some((entry) => entry.recordId === recordId && entry.kind === 'reservation_return')) {
    return { world, result: 'already_returned' }
  }
  const reservation = world.entries.find((entry) => entry.recordId === recordId && entry.kind === 'reservation')
  if (!reservation) return { world, result: 'missing' }
  const next = clone(world)
  pushEntry(next, {
    id: entryId,
    accountId: reservation.accountId,
    kind: 'consumption',
    credits: reservation.credits,
    recordId,
    orderId: null,
  })
  return { world: next, result: 'consumed' }
}

export function returnReservation(
  world: World,
  recordId: string,
  ids: { entryId: string; eventId: string },
  nowIso: string,
): { world: World; result: RecordMovement } {
  if (world.entries.some((entry) => entry.recordId === recordId && entry.kind === 'reservation_return')) {
    return { world, result: 'duplicate' }
  }
  if (world.entries.some((entry) => entry.recordId === recordId && entry.kind === 'consumption')) {
    return { world, result: 'already_consumed' }
  }
  const reservation = world.entries.find((entry) => entry.recordId === recordId && entry.kind === 'reservation')
  if (!reservation) return { world, result: 'missing' }
  const next = clone(world)
  pushEntry(next, {
    id: ids.entryId,
    accountId: reservation.accountId,
    kind: 'reservation_return',
    credits: reservation.credits,
    recordId,
    orderId: null,
  })
  next.outbox.push({
    id: ids.eventId,
    type: 'CreditoDevolvido',
    occurredAt: nowIso,
    payload: {
      type: 'CreditoDevolvido',
      version: 1,
      id: ids.eventId,
      occurredAt: nowIso,
      data: { recordId, accountId: reservation.accountId, credits: reservation.credits },
    },
  })
  return { world: next, result: 'returned' }
}

export function auditCaches(world: World): string[] {
  const accounts = new Set<string>([
    ...Object.keys(world.cache),
    ...world.entries.map((entry) => entry.accountId),
  ])
  const mismatches: string[] = []
  for (const accountId of accounts) {
    const sum = sumEntries(world.entries.filter((entry) => entry.accountId === accountId))
    if ((world.cache[accountId] ?? 0) !== sum) mismatches.push(accountId)
  }
  return mismatches
}

export function viewCharge(charge: Charge, nowMs: number): ChargeStatus {
  if (charge.status === 'pending' && Date.parse(charge.expiresAt) <= nowMs) return 'expired'
  return charge.status
}

function statusToState(status: ChargeStatus): PaymentState | null {
  if (status === 'approved') return 'APROVADO'
  if (status === 'rejected') return 'RECUSADO'
  if (status === 'expired') return 'EXPIRADO'
  if (status === 'refunded') return 'ESTORNADO'
  return null
}

function creditPurchase(world: World, order: Order, ids: { entryId: string; eventId: string }, nowIso: string): void {
  if (world.entries.some((entry) => entry.orderId === order.id && entry.kind === 'purchase')) return
  pushEntry(world, {
    id: ids.entryId,
    accountId: order.accountId,
    kind: 'purchase',
    credits: order.creditCount,
    recordId: null,
    orderId: order.id,
  })
  world.outbox.push({
    id: ids.eventId,
    type: 'PagamentoAprovado',
    occurredAt: nowIso,
    payload: {
      type: 'PagamentoAprovado',
      version: 1,
      id: ids.eventId,
      occurredAt: nowIso,
      data: {
        orderId: order.id,
        accountId: order.accountId,
        fullName: order.billing.fullName,
        email: order.billing.email,
        packageName: order.packageName,
        creditCount: order.creditCount,
        totalCents: order.totalCents,
      },
    },
  })
}

function debitRefund(world: World, order: Order, entryId: string): void {
  if (world.entries.some((entry) => entry.orderId === order.id && entry.kind === 'refund_debit')) return
  pushEntry(world, {
    id: entryId,
    accountId: order.accountId,
    kind: 'refund_debit',
    credits: order.creditCount,
    recordId: null,
    orderId: order.id,
  })
}

function pushEntry(world: World, entry: LedgerEntry): void {
  world.entries.push(entry)
  world.cache[entry.accountId] = (world.cache[entry.accountId] ?? 0) + effect(entry)
  const sum = sumEntries(world.entries.filter((item) => item.accountId === entry.accountId))
  if (world.cache[entry.accountId] !== sum) throw new Error('ledger_cache_mismatch')
}

function clone(world: World): World {
  return {
    packages: world.packages.map((item) => ({ ...item })),
    orders: world.orders.map((item) => ({ ...item, billing: { ...item.billing } })),
    charges: world.charges.map((item) => ({ ...item })),
    entries: world.entries.map((item) => ({ ...item })),
    cache: { ...world.cache },
    outbox: world.outbox.map((item) => ({ ...item, payload: { ...item.payload } })),
  }
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  if (/^(\d)\1{10}$/.test(value)) return false
  const digits = [...value].map((digit) => Number(digit))
  const first = checkDigit(digits.slice(0, 9))
  const second = checkDigit(digits.slice(0, 10))
  return first === digits[9] && second === digits[10]
}

function checkDigit(base: number[]): number {
  let weight = base.length + 1
  let sum = 0
  for (const digit of base) {
    sum += digit * weight
    weight -= 1
  }
  const remainder = sum % 11
  if (remainder < 2) return 0
  return 11 - remainder
}
