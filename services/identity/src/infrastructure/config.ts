export class Config {
  constructor(
    readonly databaseUrl: string,
    readonly rabbitUrl: string,
    readonly jwtPem: string,
    readonly cpfKey: Buffer,
    readonly cpfHmacKey: Buffer,
    readonly oabKey: Buffer,
    readonly refreshHmacKey: Buffer,
    readonly tokenHmacKey: Buffer,
    readonly serviceToken: string,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static read(): Config {
    return new Config(
      required('DATABASE_URL'),
      required('RABBIT_URL'),
      pem('JWT_PRIVATE_KEY_PEM_B64'),
      key('CPF_KEY_B64'),
      key('CPF_HMAC_B64'),
      key('OAB_KEY_B64'),
      key('REFRESH_HMAC_B64'),
      key('TOKEN_HMAC_B64'),
      required('IDENTITY_SERVICE_TOKEN'),
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

function key(name: string): Buffer {
  const raw = Buffer.from(required(name), 'base64')
  if (raw.length !== 32) {
    console.error(JSON.stringify({ msg: 'invalid_config', key: name }))
    process.exit(1)
  }
  return raw
}

function pem(name: string): string {
  const value = Buffer.from(required(name), 'base64').toString('utf8')
  if (!value.includes('BEGIN PRIVATE KEY')) {
    console.error(JSON.stringify({ msg: 'invalid_config', key: name }))
    process.exit(1)
  }
  return value
}
