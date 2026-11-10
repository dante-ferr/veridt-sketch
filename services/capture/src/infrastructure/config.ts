export class Config {
  constructor(
    readonly databaseUrl: string,
    readonly rabbitUrl: string,
    readonly jwksUrl: string,
    readonly issuer: string,
    readonly audience: string,
    readonly identityUrl: string,
    readonly serviceToken: string,
    readonly s3Endpoint: string,
    readonly s3AccessKey: string,
    readonly s3SecretKey: string,
    readonly s3Bucket: string,
    readonly s3Region: string,
    readonly workerUrl: string,
    readonly internalToken: string,
    readonly manifestKeyPath: string,
  ) {}

  static read(): Config {
    return new Config(
      required('DATABASE_URL'),
      required('RABBIT_URL'),
      required('JWKS_URL'),
      process.env.JWT_ISSUER ?? 'veridit-identity',
      process.env.JWT_AUDIENCE ?? 'veridit',
      required('IDENTITY_URL'),
      required('IDENTITY_SERVICE_TOKEN'),
      required('S3_ENDPOINT'),
      required('S3_ACCESS_KEY'),
      required('S3_SECRET_KEY'),
      process.env.S3_BUCKET ?? 'evidence',
      process.env.S3_REGION ?? 'us-east-1',
      required('WORKER_URL'),
      required('CAPTURE_INTERNAL_TOKEN'),
      required('MANIFEST_PRIVATE_KEY_PATH'),
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
