import { Prisma } from '@prisma/client';
import type { StoreDto, StoreUpsertRequest } from '../dtos/catalog.dto.js';
import { semHorario, validarHorario } from '../domain/openingHours.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { toStoreDto } from '../mappings.js';

function validated(req: StoreUpsertRequest) {
  const name = req.name.trim();
  const address = req.address.trim();
  const city = req.city.trim();
  const state = req.state.trim().toUpperCase();
  const category = req.category.trim();

  if (!name) throw new AppError('Nome da unidade é obrigatório.', 400);
  if (!address) throw new AppError('Endereço é obrigatório.', 400);
  if (!city) throw new AppError('Cidade é obrigatória.', 400);
  if (!state) throw new AppError('Estado é obrigatório.', 400);
  if (!category) throw new AppError('Categoria é obrigatória.', 400);
  if (req.lat < -90 || req.lat > 90 || req.lng < -180 || req.lng > 180)
    throw new AppError('Coordenadas inválidas.', 400);
  if (req.lat === 0 && req.lng === 0)
    throw new AppError('Informe latitude e longitude reais da unidade.', 400);

  const base = {
    name,
    address,
    city,
    state,
    category,
    lat: req.lat,
    lng: req.lng,
    imageUrl: (req.imageUrl ?? '').trim(),
  };

  /**
   * Os campos novos só entram no `data` quando o cliente os mandou.
   *
   * `undefined` significa "não mexe", e isso não é detalhe: o painel web atual e o app enviam
   * o corpo inteiro neste mesmo `PUT` sem conhecer horário nem fuso. Se a ausência virasse
   * `null`, editar o endereço pela tela de hoje **apagaria** o horário que o lojista cadastrou
   * pela tela nova.
   */
  const extra: {
    active?: boolean;
    timezone?: string;
    openingHours?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  } = {};

  if (req.active !== undefined) extra.active = req.active;

  if (req.timezone !== undefined) {
    extra.timezone = fusoValido(req.timezone.trim());
  }

  if (req.openingHours !== undefined) {
    // `null` explícito apaga; objeto passa pela validação semântica, que diz qual dia e qual
    // intervalo está errado.
    const h = req.openingHours === null ? null : validarHorario(req.openingHours);
    /**
     * `Prisma.DbNull` e não `null`.
     *
     * Em coluna `Json?` o Prisma distingue dois nulos: `JsonNull` grava o **valor JSON** `null`
     * dentro da coluna, e `DbNull` grava `NULL` de SQL. Passar `null` cru não compila, e é bom
     * que não compile: os dois significam coisas diferentes para `openingHours IS NULL`, que é
     * como "horário não declarado" se consulta.
     */
    extra.openingHours = h && !semHorario(h) ? (h as Prisma.InputJsonValue) : Prisma.DbNull;
  }

  return { ...base, ...extra };
}

/**
 * Confere que o fuso existe antes de gravar.
 *
 * Fuso inválido no banco não derruba a leitura — `agoraNaUnidade` cai para o fuso do país —,
 * mas aí a unidade passa a mostrar horário errado **em silêncio**. Recusar na escrita é onde o
 * erro ainda tem a quem reclamar.
 */
function fusoValido(tz: string): string {
  if (!tz) throw new AppError('Fuso horário é obrigatório quando informado.', 400);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    throw new AppError(
      `Fuso horário desconhecido: "${tz}". Use um identificador IANA, como America/Sao_Paulo.`,
      400,
    );
  }
}

async function ensurePartner(partnerId: string): Promise<void> {
  if (!(await prisma.partner.findUnique({ where: { id: partnerId } })))
    throw new AppError('Parceiro não encontrado.', 404);
}

export async function listForAdmin(partnerId?: string): Promise<StoreDto[]> {
  const rows = await prisma.partnerStore.findMany({
    where: partnerId ? { partnerId } : {},
    orderBy: { name: 'asc' },
  });
  /**
   * `(s) => toStoreDto(s)` e **não** `.map(toStoreDto)`.
   *
   * `toStoreDto` ganhou um segundo parâmetro `agora`, e `Array.prototype.map` passa o índice na
   * segunda posição — `.map(toStoreDto)` entregaria `0`, `1`, `2` como se fossem a data. O
   * compilador pegou isto; sem o tipo, a segunda unidade da lista calcularia "aberta agora"
   * contra 1 de janeiro de 1970.
   */
  const agora = new Date();
  return rows.map((s) => toStoreDto(s, agora));
}

export async function listForPartner(partnerId: string): Promise<StoreDto[]> {
  const rows = await prisma.partnerStore.findMany({ where: { partnerId }, orderBy: { name: 'asc' } });
  const agora = new Date();
  return rows.map((s) => toStoreDto(s, agora));
}

export async function createForAdmin(req: StoreUpsertRequest): Promise<StoreDto> {
  if (!req.partnerId) throw new AppError('Parceiro é obrigatório.', 400);
  await ensurePartner(req.partnerId);
  const data = validated(req);
  const store = await prisma.partnerStore.create({ data: { ...data, partnerId: req.partnerId } });
  return toStoreDto(store);
}

export async function createForPartner(partnerId: string, req: StoreUpsertRequest): Promise<StoreDto> {
  await ensurePartner(partnerId);
  const data = validated(req);
  const store = await prisma.partnerStore.create({ data: { ...data, partnerId } });
  return toStoreDto(store);
}

export async function updateForAdmin(id: string, req: StoreUpsertRequest): Promise<StoreDto> {
  const store = await prisma.partnerStore.findUnique({ where: { id } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  if (req.partnerId && req.partnerId !== store.partnerId) await ensurePartner(req.partnerId);
  const data = validated(req);
  const mudouDeParceiro = Boolean(req.partnerId && req.partnerId !== store.partnerId);
  const updated = await prisma.partnerStore.update({
    where: { id },
    // `partnerId` entra como `partner: { connect }` em vez de campo solto: o tipo de `update`
    // do Prisma não aceita a chave escalar junto com o resto quando a relação existe.
    data: mudouDeParceiro
      ? { ...data, partner: { connect: { id: req.partnerId as string } } }
      : data,
  });
  return toStoreDto(updated);
}

export async function updateForPartner(partnerId: string, id: string, req: StoreUpsertRequest): Promise<StoreDto> {
  const store = await prisma.partnerStore.findFirst({ where: { id, partnerId } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  const data = validated(req);
  const updated = await prisma.partnerStore.update({ where: { id }, data });
  return toStoreDto(updated);
}

export async function deleteForAdmin(id: string): Promise<void> {
  const store = await prisma.partnerStore.findUnique({ where: { id } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  await prisma.partnerStore.delete({ where: { id } });
}

export async function deleteForPartner(partnerId: string, id: string): Promise<void> {
  const store = await prisma.partnerStore.findFirst({ where: { id, partnerId } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  await prisma.partnerStore.delete({ where: { id } });
}
