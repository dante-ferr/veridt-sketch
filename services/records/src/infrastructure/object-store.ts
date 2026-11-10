import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable } from '@nestjs/common'
import { DOWNLOAD_LINK_TTL_SECONDS, sha256Hex } from '@veridit/evidence'
import { Config } from './config'

@Injectable()
export class ObjectStore {
  private readonly internal: S3Client
  private readonly publicClient: S3Client

  constructor(private readonly config: Config) {
    const credentials = { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey }
    this.internal = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      forcePathStyle: true,
      credentials,
    })
    this.publicClient = new S3Client({
      region: config.s3Region,
      endpoint: config.s3PublicEndpoint,
      forcePathStyle: true,
      credentials,
    })
  }

  async getEvidence(key: string): Promise<Buffer> {
    const response = await this.internal.send(new GetObjectCommand({
      Bucket: this.config.evidenceBucket,
      Key: key,
      ChecksumMode: 'ENABLED',
    }))
    const body = Buffer.from(await response.Body!.transformToByteArray())
    const recorded = response.ChecksumSHA256
    if (recorded && Buffer.from(recorded, 'base64').toString('hex') !== sha256Hex(body)) {
      throw new Error('checksum_mismatch')
    }
    return body
  }

  async putArtifact(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.internal.send(new PutObjectCommand({
      Bucket: this.config.artifactBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      IfNoneMatch: '*',
    }))
  }

  link(bucket: 'evidence' | 'artifacts', key: string): Promise<string> {
    const name = bucket === 'evidence' ? this.config.evidenceBucket : this.config.artifactBucket
    return getSignedUrl(this.publicClient, new GetObjectCommand({ Bucket: name, Key: key }), {
      expiresIn: DOWNLOAD_LINK_TTL_SECONDS,
    })
  }
}
