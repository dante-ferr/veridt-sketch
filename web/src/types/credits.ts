/** Credit package offered for purchase (GET /v1/credit-packages). */
export type PackageOffer = {
  id: string
  code: string
  name: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
  description: string
}

/** Payment state of a credit order. */
export type PaymentState = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'EXPIRADO' | 'ESTORNADO'

/** Credit order (GET/POST /v1/credit-orders). */
export type OrderRow = {
  id: string
  packageName: string
  creditCount: number
  pricePerCreditCents: number
  totalCents: number
  method: 'pix' | 'checkout'
  state: PaymentState
  pixCopyPaste: string
  checkoutUrl: string
  expiresAt: string
  createdAt: string
  testConfirmation: boolean
}
