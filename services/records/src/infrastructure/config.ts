export class Config {
  constructor(
    readonly databaseUrl: string,
    readonly rabbitUrl: string,
    readonly jwksUrl: string,
    readonly issuer: string,
    readonly audience: string,
    readonly identityUrl: string,
    readonly serviceToken: string,
    readonly captureUrl: string,
    readonly s3Endpoint: string,
    readonly s3PublicEndpoint: string,
    readonly s3AccessKey: string,
    readonly s3SecretKey: string,
    readonly evidenceBucket: string,
    readonly artifactBucket: string,
    readonly s3Region: string,
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
      required('CAPTURE_URL'),
      required('S3_ENDPOINT'),
      required('S3_PUBLIC_ENDPOINT'),
      required('S3_ACCESS_KEY'),
      required('S3_SECRET_KEY'),
      process.env.EVIDENCE_BUCKET ?? 'evidence',
      process.env.ARTIFACT_BUCKET ?? 'artifacts',
      process.env.S3_REGION ?? 'us-east-1',
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
