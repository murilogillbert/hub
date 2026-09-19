import { config } from '../config.js';
import { AppError } from '../errors.js';

interface EvolutionInstanceInfo {
  connectionStatus: 'open' | 'connecting' | 'close';
  ownerJid: string | null;
}

interface EvolutionQrCode {
  base64: string;
}

function baseUrlAndHeaders(): { baseUrl: string; headers: Record<string, string> } {
  if (!config.evolution.apiUrl || !config.evolution.apiKey)
    throw new AppError('Evolution API não configurada.', 503);
  return {
    baseUrl: config.evolution.apiUrl.replace(/\/$/, ''),
    headers: { apikey: config.evolution.apiKey, 'Content-Type': 'application/json' },
  };
}

async function fetchInstance(instanceName: string): Promise<EvolutionInstanceInfo | null> {
  const { baseUrl, headers } = baseUrlAndHeaders();
  const res = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, { headers });
  // Instância inexistente = 404 (caso normal antes do primeiro pareamento),
  // não é falha. Nota: usar 500 (não 502) nos erros abaixo — o Cloudflare
  // intercepta respostas 502 e troca pelo próprio HTML de erro, descartando
  // o corpo JSON e os headers de CORS da nossa resposta.
  if (res.status === 404) return null;
  if (!res.ok) throw new AppError('Falha ao consultar o Evolution API.', 500);
  const list = (await res.json()) as EvolutionInstanceInfo[];
  return list[0] ?? null;
}

/** Cria a instância se ainda não existir, e devolve o QR code (base64) pra
 * parear. Se a instância já existir mas estiver desconectada, gera um QR
 * novo via /instance/connect. */
export async function connectInstance(
  instanceName: string,
): Promise<{ status: 'connected' | 'qrcode'; qrCodeBase64?: string }> {
  const { baseUrl, headers } = baseUrlAndHeaders();

  const existing = await fetchInstance(instanceName);
  if (existing?.connectionStatus === 'open') return { status: 'connected' };

  if (!existing) {
    const res = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    if (!res.ok) throw new AppError('Falha ao criar instância no Evolution API.', 500);
    const body = (await res.json()) as { qrcode?: EvolutionQrCode };
    if (!body.qrcode?.base64) throw new AppError('Evolution API não devolveu QR code.', 500);
    return { status: 'qrcode', qrCodeBase64: body.qrcode.base64 };
  }

  const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, { headers });
  if (!res.ok) throw new AppError('Falha ao reconectar instância no Evolution API.', 500);
  const body = (await res.json()) as EvolutionQrCode;
  if (!body.base64) throw new AppError('Evolution API não devolveu QR code.', 500);
  return { status: 'qrcode', qrCodeBase64: body.base64 };
}

export async function instanceStatus(instanceName: string): Promise<'connected' | 'connecting' | 'disconnected'> {
  const info = await fetchInstance(instanceName);
  if (!info) return 'disconnected';
  if (info.connectionStatus === 'open') return 'connected';
  if (info.connectionStatus === 'connecting') return 'connecting';
  return 'disconnected';
}

export async function disconnectInstance(instanceName: string): Promise<void> {
  const { baseUrl, headers } = baseUrlAndHeaders();
  await fetch(`${baseUrl}/instance/logout/${instanceName}`, { method: 'DELETE', headers });
}
