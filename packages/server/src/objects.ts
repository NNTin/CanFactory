import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand,
  ListObjectsV2Command, PutObjectCommand, S3Client, S3ServiceException,
} from '@aws-sdk/client-s3';
import { AppError } from './errors.ts';

export const UPLOAD_TIMEOUT_MS = 60_000;
export const ORPHAN_GRACE_MS = 300_000;

export interface ObjectConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  catalogueBucket: string;
  generatedBucket: string;
}

/** S3 objects are private. The API authorizes expiry before streaming their bytes. */
export class ObjectStorage {
  readonly client: S3Client;
  constructor(readonly config: ObjectConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint, region: config.region, forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: { connectionTimeout: 5000, requestTimeout: UPLOAD_TIMEOUT_MS },
      maxAttempts: 2,
    });
  }
  async ready(): Promise<void> {
    for (const Bucket of [this.config.catalogueBucket, this.config.generatedBucket]) {
      await this.client.send(new HeadBucketCommand({ Bucket }), { abortSignal: AbortSignal.timeout(5000) });
    }
  }
  async put(bucket: string, key: string, path: string, sha256: string, signal?: AbortSignal): Promise<void> {
    const timeout = AbortSignal.timeout(UPLOAD_TIMEOUT_MS);
    const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const info = await stat(path);
    const body = createReadStream(path);
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body, ContentLength: info.size,
        ContentType: 'model/stl', Metadata: { sha256 },
      }), { abortSignal });
    } finally { body.destroy(); }
  }
  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(5000) });
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return false;
      throw error;
    }
  }
  async read(bucket: string, key: string): Promise<Readable> {
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
      if (!(response.Body instanceof Readable)) throw new Error('Object response has no readable body.');
      return response.Body;
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        throw new AppError(410, 'RENDER_EXPIRED', 'The generated file is no longer available. Generate it again.');
      }
      throw error;
    }
  }
  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.generatedBucket, Key: key }), { abortSignal: AbortSignal.timeout(10_000) });
  }
  async *generatedObjects(): AsyncGenerator<{ key: string; modified: number }> {
    let continuation: string | undefined;
    do {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.generatedBucket, Prefix: 'renders/', MaxKeys: 1000,
        ...(continuation ? { ContinuationToken: continuation } : {}),
      }), { abortSignal: AbortSignal.timeout(10_000) });
      for (const object of response.Contents ?? []) {
        if (object.Key && object.LastModified) yield { key: object.Key, modified: object.LastModified.getTime() };
      }
      continuation = response.IsTruncated ? response.NextContinuationToken : undefined;
      if (response.IsTruncated && !continuation) throw new Error('Object listing omitted its continuation token.');
    } while (continuation);
  }
  close(): void { this.client.destroy(); }
}
