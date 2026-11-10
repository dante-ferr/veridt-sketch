import { describe, expect, it } from 'vitest'
import {
  applyChargeStatus,
  auditCaches,
  consumeReservation,
  emptyWorld,
  freezePackage,
  placeOrder,
  reconcilePending,
  reserveCredit,
  returnReservation,
  seedPackages,
  sumEntries,
  transition,
  type Billing,
  type Charge,
  type Order,
} from './books'

const accountId = '8c1d9e2a-1b34-4c5d-8e6f-708192a3b4c5'
const now = '2026-11-10T12:00:00.000Z'
const billing: Billing = {
  fullName: 'Ana Ribeiro',
  email: 'ana@example.com',
  phone: '71900000000',
  cpf: '52998224725',
  postalCode: '40000000',
  street: 'Rua das Flores',
  number: '10',
  complement: '',
  district: 'Centro',
  city: 'Salvador',
  state: 'BA',
}

function orderFor(creditCount: number, createdAt = now): { order: Order; charge: Charge } {
  const offer = seedPackages[0]
  if (!offer) throw new Error('missing package')
  const frozen = freezePackage({ ...offer, creditCount, pricePerCreditCents: 500 })
  const order: Order = {
    id: '4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
    accountId,
    packageId: offer.id,
    ...frozen,
    method: 'pix',
    state: 'PENDENTE',
    providerPaymentId: 'pay-1',
    pixCopyPaste: '00020126FAKE',
    checkoutUrl: 'https://localhost:8443/credits/orders/4f0b1a0e-6d2c-4a1e-9b55-0c2a6d9e1f10',
    expiresAt: '2026-11-10T12:30:00.000Z',
    billing,
    createdAt,
  }
  const charge: Charge = {
    providerPaymentId: order.providerPaymentId,
    status: 'pending',
    method: 'pix',
    amountCents: order.totalCents,
    expiresAt: order.expiresAt,
    pixCopyPaste: order.pixCopyPaste,
    checkoutUrl: order.checkoutUrl,
  }
  return { order, charge }
}

function approve(world: ReturnType<typeof emptyWorld>, times = 1) {
  let current = world
  for (let index = 0; index < times; index += 1) {
    const charge = current.charges.find((item) => item.providerPaymentId === 'pay-1')
    if (charge && index === 0) charge.status = 'approved'
    const applied = applyChargeStatus(current, 'pay-1', now, { entryId: `entry-${index}`, eventId: `event-${index}` })
    current = applied.world
  }
  return current
}

describe('payment state', () => {
  it('rejects a refund that skips approval and a second approval after refund', () => {
    expect(transition('PENDENTE', 'ESTORNADO')).toBeNull()
    expect(transition('APROVADO', 'ESTORNADO')).toBe('ESTORNADO')
    expect(transition('ESTORNADO', 'APROVADO')).toBeNull()
  })
})

describe('credits ledger', () => {
  it('keeps a single purchase after 1000 webhook repeats', () => {
    const { order, charge } = orderFor(10)
    const approved = approve(placeOrder(emptyWorld(), order, charge), 1000)
    const purchases = approved.entries.filter((entry) => entry.kind === 'purchase')
    expect(purchases).toHaveLength(1)
    expect(purchases[0]?.credits).toBe(10)
    expect(approved.outbox.filter((item) => item.type === 'PagamentoAprovado')).toHaveLength(1)
    expect(approved.cache[accountId]).toBe(10)
    expect(auditCaches(approved)).toEqual([])
  })

  it('does not credit a pending provider charge', () => {
    const { order, charge } = orderFor(10)
    const applied = applyChargeStatus(placeOrder(emptyWorld(), order, charge), 'pay-1', now, {
      entryId: 'entry-1',
      eventId: 'event-1',
    })
    expect(applied.result).toEqual({ outcome: 'unchanged', state: 'PENDENTE' })
    expect(applied.world.entries).toHaveLength(0)
  })

  it('recovers an approved payment whose webhook never arrived', () => {
    const { order, charge } = orderFor(10, '2026-11-10T11:00:00.000Z')
    charge.status = 'approved'
    const world = placeOrder(emptyWorld(), order, charge)
    const once = reconcilePending(world, Date.parse(now), 15_000, (index) => ({
      entryId: `entry-${index}`,
      eventId: `event-${index}`,
    }))
    const twice = reconcilePending(once, Date.parse(now), 15_000, (index) => ({
      entryId: `again-${index}`,
      eventId: `again-event-${index}`,
    }))
    expect(once.cache[accountId]).toBe(10)
    expect(twice.entries.filter((entry) => entry.kind === 'purchase')).toHaveLength(1)
    expect(auditCaches(twice)).toEqual([])
  })

  it('expires a Pix charge from the provider view without crediting it', () => {
    const { order, charge } = orderFor(10, '2026-11-10T11:00:00.000Z')
    const world = reconcilePending(placeOrder(emptyWorld(), order, charge), Date.parse('2026-11-10T12:30:00.000Z'), 15_000, () => ({
      entryId: 'entry-1',
      eventId: 'event-1',
    }))
    expect(world.orders[0]?.state).toBe('EXPIRADO')
    expect(world.entries).toHaveLength(0)
    expect(world.cache[accountId] ?? 0).toBe(0)
  })

  it('freezes the package copied onto the order', () => {
    const { order, charge } = orderFor(10)
    const world = placeOrder(emptyWorld(), order, charge)
    const offer = world.packages.find((item) => item.id === order.packageId)
    if (!offer) throw new Error('missing package')
    offer.creditCount = 999
    offer.pricePerCreditCents = 1
    const approved = approve(world)
    expect(approved.entries.find((entry) => entry.kind === 'purchase')?.credits).toBe(10)
    expect(approved.orders[0]?.totalCents).toBe(5000)
  })

  it('returns a failed capture once and ignores a later consume', () => {
    const { order, charge } = orderFor(10)
    const paid = approve(placeOrder(emptyWorld(), order, charge))
    const reserved = reserveCredit(paid, {
      accountId,
      recordId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      credits: 1,
      entryId: 'reserve-1',
    })
    const returned = returnReservation(reserved.world, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      entryId: 'return-1',
      eventId: 'evt-return',
    }, now)
    const again = returnReservation(returned.world, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      entryId: 'return-2',
      eventId: 'evt-return-2',
    }, now)
    const late = consumeReservation(again.world, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'consume-late')
    expect(reserved.result.outcome).toBe('reserved')
    expect(returned.result).toBe('returned')
    expect(again.result).toBe('duplicate')
    expect(late.result).toBe('already_returned')
    expect(late.world.cache[accountId]).toBe(10)
    expect(late.world.outbox.filter((item) => item.type === 'CreditoDevolvido')).toHaveLength(1)
    expect(sumEntries(late.world.entries.filter((entry) => entry.accountId === accountId))).toBe(10)
  })

  it('consumes a reservation once and keeps the debit', () => {
    const { order, charge } = orderFor(10)
    const paid = approve(placeOrder(emptyWorld(), order, charge))
    const recordId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const reserved = reserveCredit(paid, { accountId, recordId, credits: 1, entryId: 'reserve-1' })
    const consumed = consumeReservation(reserved.world, recordId, 'consume-1')
    const repeat = consumeReservation(consumed.world, recordId, 'consume-2')
    const returned = returnReservation(repeat.world, recordId, { entryId: 'return-1', eventId: 'evt-1' }, now)
    expect(consumed.result).toBe('consumed')
    expect(repeat.result).toBe('duplicate')
    expect(returned.result).toBe('already_consumed')
    expect(returned.world.cache[accountId]).toBe(9)
    expect(auditCaches(returned.world)).toEqual([])
  })

  it('debits a refund even after the credits were used and blocks the next capture', () => {
    const { order, charge } = orderFor(1)
    let world = approve(placeOrder(emptyWorld(), order, charge))
    const recordId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    world = reserveCredit(world, { accountId, recordId, credits: 1, entryId: 'reserve-1' }).world
    world = consumeReservation(world, recordId, 'consume-1').world
    const chargeRow = world.charges[0]
    if (!chargeRow) throw new Error('missing charge')
    chargeRow.status = 'refunded'
    const refunded = applyChargeStatus(world, 'pay-1', now, { entryId: 'refund-1', eventId: 'evt-refund' })
    const blocked = reserveCredit(refunded.world, {
      accountId,
      recordId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      credits: 1,
      entryId: 'reserve-2',
    })
    expect(refunded.result).toEqual({ outcome: 'applied', state: 'ESTORNADO' })
    expect(refunded.world.cache[accountId]).toBe(-1)
    expect(blocked.result).toEqual({ outcome: 'insufficient' })
    expect(auditCaches(refunded.world)).toEqual([])
  })

  it('repeats a reservation for the same record without a second hold', () => {
    const { order, charge } = orderFor(10)
    const paid = approve(placeOrder(emptyWorld(), order, charge))
    const recordId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const first = reserveCredit(paid, { accountId, recordId, credits: 1, entryId: 'reserve-1' })
    const second = reserveCredit(first.world, { accountId, recordId, credits: 1, entryId: 'reserve-2' })
    expect(second.result).toEqual({ outcome: 'reserved', reservationId: 'reserve-1' })
    expect(second.world.entries.filter((entry) => entry.kind === 'reservation')).toHaveLength(1)
    expect(second.world.cache[accountId]).toBe(9)
  })
})
