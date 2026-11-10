import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import { checksumBase64, checksumHex, sha256Hex } from '@veridt/evidence'
import { EvidenceObjects } from '../application/accept-executed'
import { Config } from './config'

@Injectable()
export class S3EvidenceObjects extends EvidenceObjects {
  private readonly client: S3Client

  constructor(private readonly config: Config) {
    super()
    this.client = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
    })
  }

  async get(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        ChecksumMode: 'ENABLED',
      }))
      const body = await this.client.send(new GetObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: key,
        ChecksumMode: 'ENABLED',
      }))
      const bytes = Buffer.from(await body.Body!.transformToByteArray())
      const recorded = head.ChecksumSHA256 ? checksumHex(head.ChecksumSHA256) : null
      if (!recorded || recorded !== sha256Hex(bytes)) return null
      return { body: bytes, sha256: recorded }
    } catch {
      return null
    }
  }

  async putNew(key: string, body: Buffer, sha256: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: key,
      Body: body,
      ChecksumSHA256: checksumBase64(sha256),
      IfNoneMatch: '*',
    }))
  }
}
