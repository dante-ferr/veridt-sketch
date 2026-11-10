export class Config {
  constructor(
    readonly databaseUrl: string,
    readonly rabbitUrl: string,
    readonly smtpHost: string,
    readonly smtpPort: number,
    readonly smtpFrom: string,
    readonly webOrigin: string,
    readonly jwksUrl: string,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static read(): Config {
    return new Config(
      required('DATABASE_URL'),
      required('RABBIT_URL'),
      process.env.SMTP_HOST ?? 'mailpit',
      Number(process.env.SMTP_PORT ?? '1025'),
      process.env.SMTP_FROM ?? 'Veridit <no-reply@localhost>',
      required('PUBLIC_WEB_ORIGIN'),
      required('JWKS_URL'),
      process.env.JWT_ISSUER ?? 'veridit-identity',
      process.env.JWT_AUDIENCE ?? 'veridit',
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
