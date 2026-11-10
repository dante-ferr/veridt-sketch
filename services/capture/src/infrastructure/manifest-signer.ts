import { createPrivateKey, createPublicKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Injectable } from '@nestjs/common'
import { Config } from './config'

@Injectable()
export class ManifestSigner {
  readonly privatePem: string
  readonly publicPem: string

  constructor(config: Config) {
    this.privatePem = readFileSync(config.manifestKeyPath, 'utf8')
    if (!this.privatePem.includes('BEGIN PRIVATE KEY')) throw new Error('invalid_manifest_key')
    const exported = createPublicKey(createPrivateKey(this.privatePem)).export({ type: 'spki', format: 'pem' })
    this.publicPem = typeof exported === 'string' ? exported : exported.toString('utf8')
  }
}
