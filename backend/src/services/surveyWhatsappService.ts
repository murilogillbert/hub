import type { WhatsAppConnectDto, WhatsAppStatusDto } from '../dtos/survey.dto.js';
import * as evolutionApi from '../infra/evolutionApi.js';
import { getSetting } from '../infra/settingsProvider.js';

/** Número central da pesquisa — UM só, pareado pelo Admin (não é por
 * motorista, diferente do Evolution API por afiliado em whatsappConnectService.ts). */
const INSTANCE_NAME = 'opendriverhub-pesquisa';

export async function connect(): Promise<WhatsAppConnectDto> {
  return evolutionApi.connectInstance(INSTANCE_NAME);
}

export async function status(): Promise<WhatsAppStatusDto> {
  const current = await evolutionApi.instanceStatus(INSTANCE_NAME);
  return { status: current };
}

export async function disconnect(): Promise<void> {
  await evolutionApi.disconnectInstance(INSTANCE_NAME);
}

/** Os vídeos configurados (um por linha em Survey:VideoUrls), embaralhados —
 * cada lead recebe os 4 em uma ordem diferente. Os 4 têm que chegar, só
 * espaçados (ver surveyLeadService.scheduleVideoDeliveries); não sorteia
 * só 1 mais. */
export async function shuffledVideoUrls(): Promise<string[]> {
  const raw = await getSetting('Survey:VideoUrls');
  if (!raw) return [];
  const urls = raw
    .split(/\r?\n|,/)
    .map((u) => u.trim())
    .filter(Boolean);
  for (let i = urls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [urls[i], urls[j]] = [urls[j], urls[i]];
  }
  return urls;
}

/** Monta a mensagem a partir do template configurável (Admin → Integrações
 * → Pesquisa de opinião) e manda 1 vídeo específico pro telefone do lead.
 * Não lança — quem chama decide o que fazer com o retorno (o job de
 * despacho marca o status da entrega). */
export async function sendOne(phone: string, name: string, videoUrl: string): Promise<boolean> {
  const template =
    (await getSetting('Survey:MessageTemplate')) ??
    'Olá, {{name}}! Aqui está o vídeo que preparamos pra você: {{videoUrl}}';
  const text = template.replace('{{name}}', name).replace('{{videoUrl}}', videoUrl);

  try {
    await evolutionApi.sendTextMessage(INSTANCE_NAME, phone, text);
    return true;
  } catch {
    return false;
  }
}
