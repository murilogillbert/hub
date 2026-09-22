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

/** Monta a mensagem a partir do template configurável (Admin → Integrações
 * → Pesquisa de opinião) e manda pro telefone do lead. Não lança — quem
 * chama decide o que fazer com o retorno (surveyLeadService marca o status). */
export async function sendVideoMessage(phone: string, name: string): Promise<boolean> {
  const videoUrl = await getSetting('Survey:VideoUrl');
  if (!videoUrl) return false;

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
