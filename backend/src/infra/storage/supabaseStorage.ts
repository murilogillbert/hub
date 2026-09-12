import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { AppError } from '../../errors.js';

// Criado sob demanda (não no boot): assim a API sobe normalmente mesmo antes
// do projeto Supabase existir — só o upload de imagem fica indisponível.
let supabase: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey)
    throw new AppError('Supabase Storage não configurado (defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).', 503);
  supabase ??= createClient(config.supabase.url, config.supabase.serviceRoleKey);
  return supabase;
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
 * sobe o buffer pro bucket do Supabase Storage e devolve a URL pública. */
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
  const sb = client();
  const { error } = await sb.storage
    .from(config.supabase.storageBucket)
    .upload(name, buffer, { contentType: kind.contentType, upsert: false });
  if (error) throw new AppError(`Falha no upload: ${error.message}`, 502);

  const { data } = sb.storage.from(config.supabase.storageBucket).getPublicUrl(name);
  return data.publicUrl;
}
