import { checksumBase64 } from '@veridt/evidence'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { ObjectPut } from '../application/run-screenshot'

export function evidenceClient(env: S3Env): S3Client {
  return new S3Client({
    region: env.region,
    endpoint: env.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: env.accessKey, secretAccessKey: env.secretKey },
  })
}

export type S3Env = {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  region: string
}

export async function putImmutable(client: S3Client, bucket: string, object: ObjectPut): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: object.key,
    Body: object.body,
    ChecksumSHA256: checksumBase64(object.sha256),
    IfNoneMatch: '*',
  }))
}
