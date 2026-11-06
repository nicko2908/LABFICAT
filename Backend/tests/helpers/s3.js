/**
 * Mock compartido del SDK S3 para pruebas que generan o descargan archivos.
 * Evita llamadas reales a Cloudflare R2.
 */
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export const s3Mock = mockClient(S3Client);

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

export function instalarS3Mock({ body = PNG_1X1 } = {}) {
  s3Mock.reset();
  s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag"' });
  s3Mock.on(GetObjectCommand).resolves({
    Body: { transformToByteArray: async () => body },
  });
  s3Mock.on(DeleteObjectCommand).resolves({});
  return s3Mock;
}

export default instalarS3Mock;
