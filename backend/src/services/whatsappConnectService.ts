import type { WhatsAppConnectDto, WhatsAppStatusDto } from '../dtos/affiliate.dto.js';
import * as evolutionApi from '../infra/evolutionApi.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

/** Nome da instância no Evolution API é determinístico por afiliado — não
 * precisa guardar nada até o pareamento de fato acontecer. */
function instanceNameFor(partnerId: string): string {
  return `affiliate-${partnerId}`;
}

async function ensureAffiliate(partnerId: string) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  if (partner.kind !== 'SolarAffiliate') throw new AppError('Este parceiro não é afiliado do programa solar.', 403);
  return partner;
}

/** Inicia (ou retoma) o pareamento do WhatsApp do afiliado logado. Devolve o
 * QR code pra tela mostrar, ou confirma que já está conectado. */
export async function connect(partnerId: string): Promise<WhatsAppConnectDto> {
  await ensureAffiliate(partnerId);
  const instanceName = instanceNameFor(partnerId);
  const result = await evolutionApi.connectInstance(instanceName);

  if (result.status === 'connected') {
    await prisma.partner.update({ where: { id: partnerId }, data: { evolutionInstance: instanceName } });
    return { status: 'connected' };
  }
  return { status: 'qrcode', qrCodeBase64: result.qrCodeBase64 };
}

/** Consultado pela tela enquanto o QR está exposto, pra saber quando o
 * WhatsApp terminou de parear. Quando conecta, salva o nome da instância no
 * perfil do parceiro automaticamente. */
export async function status(partnerId: string): Promise<WhatsAppStatusDto> {
  const partner = await ensureAffiliate(partnerId);
  const instanceName = instanceNameFor(partnerId);
  const current = await evolutionApi.instanceStatus(instanceName);

  if (current === 'connected' && partner.evolutionInstance !== instanceName) {
    await prisma.partner.update({ where: { id: partnerId }, data: { evolutionInstance: instanceName } });
  }
  return { status: current };
}

/** Desconecta o WhatsApp atual do afiliado (ex.: pra trocar de número). */
export async function disconnect(partnerId: string): Promise<void> {
  await ensureAffiliate(partnerId);
  const instanceName = instanceNameFor(partnerId);
  await evolutionApi.disconnectInstance(instanceName);
  await prisma.partner.update({ where: { id: partnerId }, data: { evolutionInstance: null } });
}
