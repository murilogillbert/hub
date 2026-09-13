import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { AppError } from '../../errors.js';

// Criado sob demanda (não no boot): assim a API sobe normalmente mesmo antes
// do bucket existir — só o upload de imagem fica indisponível.
let s3: S3Client | null = null;
function client(): S3Client {
  if (!config.minio.endpoint || !config.minio.accessKey || !config.minio.secretKey)
    throw new AppError('Storage não configurado (defina MINIO_ENDPOINT, MINIO_ACCESS_KEY e MINIO_SECRET_KEY).', 503);
  s3 ??= new S3Client({
    endpoint: config.minio.endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: config.minio.accessKey, secretAccessKey: config.minio.secretKey },
  });
  return s3;
}

const MAGIC_BYTES: { ext: string; contentType: string; matches: (h: Buffer) => boolean }[] = [
  {
    ext: 'jpg',
    contentType: 'image/jpeg',
    matches: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  },
  {
    ext: 'png',
    contentType: 'image/png',
    matches: (h) => h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47,
  },
  {
    ext: 'webp',
    contentType: 'image/webp',
    matches: (h) =>
      h[0] === 0x52 &&
      h[1] === 0x49 &&
      h[2] === 0x46 &&
      h[3] === 0x46 &&
      h[8] === 0x57 &&
      h[9] === 0x45 &&
      h[10] === 0x42 &&
      h[11] === 0x50,
  },
];

/** Detecta o tipo pelos magic bytes (não confia no content-type do cliente),
 * sobe o buffer pro bucket do MinIO e devolve a URL pública. */
export async function uploadImage(buffer: Buffer): Promise<string> {
  if (buffer.length === 0) throw new AppError('Nenhum arquivo enviado.', 400);
  if (buffer.length > config.uploads.maxImageBytes)
    throw new AppError(
      `Arquivo muito grande (máx. ${Math.floor(config.uploads.maxImageBytes / (1024 * 1024))} MB).`,
      413,
    );
  if (buffer.length < 12) throw new AppError('Arquivo inválido.', 415);

  const header = buffer.subarray(0, 12);
  const kind = MAGIC_BYTES.find((m) => m.matches(header));
  if (!kind) throw new AppError('Formato não suportado. Use JPEG, PNG ou WEBP.', 415);

  const name = `${crypto.randomUUID()}.${kind.ext}`;
  try {
    await client().send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: name,
        Body: buffer,
        ContentType: kind.contentType,
      }),
    );
  } catch (err) {
    throw new AppError(`Falha no upload: ${err instanceof Error ? err.message : String(err)}`, 502);
  }

  const base = config.minio.publicUrl || config.minio.endpoint;
  return `${base.replace(/\/$/, '')}/${config.minio.bucket}/${name}`;
}
