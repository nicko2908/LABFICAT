/**
 * Smoke test de Cloudflare R2.
 *
 * No forma parte de `npm test`: usa credenciales reales y hace llamadas de red.
 * Uso:
 *   npm run test:r2
 *
 * Verifica PUT, GET, URL prefirmada y DELETE. No imprime credenciales ni la URL
 * prefirmada completa.
 */
import 'dotenv/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_REGION = 'auto',
  R2_PRESIGN_EXPIRES = '300',
} = process.env;

const endpoint =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !endpoint) {
  console.error('[r2] Faltan variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET o R2_ENDPOINT');
  process.exit(1);
}

const client = new S3Client({
  region: R2_REGION,
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const key = `pruebas/smoke-${Date.now()}.txt`;
const contenido = Buffer.from(`LABFICAT R2 smoke test ${new Date().toISOString()}`);
let subido = false;

console.log(`[r2] bucket=${R2_BUCKET}`);
console.log(`[r2] endpoint=${endpoint}`);

try {
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: contenido,
      ContentType: 'text/plain',
    })
  );
  subido = true;
  console.log('[r2] PUT OK');

  const objeto = await client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
  const descargado = await objeto.Body.transformToString();

  if (descargado !== contenido.toString()) {
    throw new Error('El contenido descargado no coincide con el subido');
  }
  console.log('[r2] GET OK');

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: Number(R2_PRESIGN_EXPIRES) || 300 }
  );

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`La URL prefirmada respondio ${respuesta.status}`);
  }
  console.log(`[r2] PRESIGNED GET OK (${respuesta.status})`);

  console.log('[r2] Smoke test completado correctamente.');
} catch (error) {
  console.error(`[r2] ERROR ${error.name || ''}: ${error.message}`);
  if (error.$metadata?.httpStatusCode) {
    console.error(`[r2] HTTP ${error.$metadata.httpStatusCode}`);
  }
  process.exitCode = 1;
} finally {
  if (subido) {
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
      );
      console.log('[r2] DELETE OK');
    } catch (error) {
      console.error(`[r2] No se pudo eliminar el objeto de prueba: ${error.message}`);
    }
  }
}
