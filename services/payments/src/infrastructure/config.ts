export class Config {
  constructor(
    readonly databaseUrl: string,
    readonly rabbitUrl: string,
    readonly jwksUrl: string,
    readonly issuer: string,
    readonly audience: string,
    readonly serviceToken: string,
    readonly webhookSecret: string,
    readonly provider: 'fake' | 'mercadopago',
    readonly mercadoPagoToken: string,
    readonly webOrigin: string,
    readonly reconcileIntervalMs: number,
    readonly reconcileMinAgeMs: number,
    readonly auditIntervalMs: number,
  ) {}

  static read(): Config {
    const provider = process.env.PAYMENT_PROVIDER || 'fake'
    if (provider !== 'fake' && provider !== 'mercadopago') {
      console.error(JSON.stringify({ msg: 'missing_config', key: 'PAYMENT_PROVIDER' }))
      process.exit(1)
    }
    return new Config(
      required('DATABASE_URL'),
      required('RABBIT_URL'),
      required('JWKS_URL'),
      process.env.JWT_ISSUER ?? 'veridit-identity',
      process.env.JWT_AUDIENCE ?? 'veridit',
      required('PAYMENTS_SERVICE_TOKEN'),
      required('PAYMENT_WEBHOOK_SECRET'),
      provider,
      process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
      process.env.PUBLIC_WEB_ORIGIN ?? 'https://localhost:8443',
      numberFrom('PAYMENT_RECONCILE_INTERVAL_MS', 60_000),
      numberFrom('PAYMENT_RECONCILE_MIN_AGE_MS', 15_000),
      numberFrom('PAYMENT_BALANCE_AUDIT_INTERVAL_MS', 86_400_000),
    )
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(JSON.stringify({ msg: 'missing_config', key: name }))
    process.exit(1)
  }
  return value
}

function numberFrom(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}
