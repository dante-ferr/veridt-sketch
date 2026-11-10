import { GetObjectCommand, HeadObjectCommand, type ServiceInputTypes, type ServiceOutputTypes } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { checksumBase64, sha256Hex } from '@veridit/evidence'
import { Config } from './config'
import { S3EvidenceObjects } from './s3-evidence'

class ScriptedClient {
  readonly modes: Array<string | undefined> = []

  constructor(private readonly body: Buffer) {}

  async send(command: ServiceInputTypes): Promise<ServiceOutputTypes> {
    const input = command.input as { ChecksumMode?: 'ENABLED' | 'DISABLED' }
    this.modes.push(input.ChecksumMode)
    if (command instanceof HeadObjectCommand || command instanceof GetObjectCommand) {
      if (input.ChecksumMode !== 'ENABLED') {
        return { Body: bytes(this.body) }
      }
      return {
        ChecksumSHA256: checksumBase64(sha256Hex(this.body)),
        Body: bytes(this.body),
      }
    }
    return {}
  }
}

function bytes(body: Buffer) {
  return { transformToByteArray: async () => body }
}

describe('evidence object read', () => {
  it('asks for the stored checksum, which MinIO omits unless checksum mode is enabled', async () => {
    const body = Buffer.from('{"recordId":"ok"}', 'utf8')
    const client = new ScriptedClient(body)
    const objects = new S3EvidenceObjects(new Config(
      'postgres://capture@localhost/veridit',
      'amqp://localhost',
      'http://identity/jwks',
      'veridit-identity',
      'veridit',
      'http://identity',
      'identity-token',
      'http://minio:9000',
      'capture',
      'secret',
      'evidence',
      'us-east-1',
      'http://worker:3010',
      'internal',
      '/tmp/key.pem',
      'http://payments',
      'payments-token',
    ))
    const reader = objects as unknown as { client: ScriptedClient }
    reader.client = client
    const stored = await objects.get('evidence/record/manifest.json')
    expect(client.modes).toEqual(['ENABLED', 'ENABLED'])
    expect(stored?.sha256).toBe(sha256Hex(body))
    expect(stored?.body.equals(body)).toBe(true)
  })
})
