import { GetObjectCommand, type ServiceInputTypes, type ServiceOutputTypes } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { checksumBase64, sha256Hex } from '@veridit/evidence'
import { Config } from './config'
import { ObjectStore } from './object-store'

class ScriptedClient {
  mode: string | undefined

  constructor(private readonly body: Buffer) {}

  async send(command: ServiceInputTypes): Promise<ServiceOutputTypes> {
    const input = command.input as { ChecksumMode?: 'ENABLED' | 'DISABLED' }
    this.mode = input.ChecksumMode
    if (!(command instanceof GetObjectCommand)) return {}
    if (input.ChecksumMode !== 'ENABLED') return { Body: bytes(this.body) }
    return {
      ChecksumSHA256: checksumBase64(sha256Hex(this.body)),
      Body: bytes(this.body),
    }
  }
}

function bytes(body: Buffer) {
  return { transformToByteArray: async () => body }
}

describe('evidence download', () => {
  it('requests the stored checksum before accepting the object bytes', async () => {
    const body = Buffer.from('manifest', 'utf8')
    const client = new ScriptedClient(body)
    const store = new ObjectStore(new Config(
      'postgres://records@localhost/veridit',
      'amqp://localhost',
      'http://identity/jwks',
      'veridit-identity',
      'veridit',
      'http://identity',
      'identity-token',
      'http://capture',
      'http://minio:9000',
      'http://localhost:9000',
      'records',
      'secret',
      'evidence',
      'artifacts',
      'us-east-1',
    ))
    const reader = store as unknown as { internal: ScriptedClient }
    reader.internal = client
    const stored = await store.getEvidence('evidence/record/manifest.json')
    expect(client.mode).toBe('ENABLED')
    expect(stored.equals(body)).toBe(true)
  })
})
