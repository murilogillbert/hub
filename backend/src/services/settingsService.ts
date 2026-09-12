import type { IntegrationFieldDto, IntegrationGroupDto, UpdateSettingRequest } from '../dtos/settings.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

interface Field {
  key: string;
  label: string;
  secret: boolean;
}
interface Group {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: Field[];
}

const CATALOG: Group[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Envia confirmação de compra, código do voucher e lembretes de resgate.',
    icon: '💬',
    fields: [
      { key: 'WhatsApp:Token', label: 'Token da API', secret: true },
      { key: 'WhatsApp:PhoneNumber', label: 'Número (com DDI)', secret: false },
    ],
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Gateway de pagamento (Pix, crédito e débito). Webhook reconcilia o status.',
    icon: '💳',
    fields: [
      { key: 'MercadoPago:AccessToken', label: 'Access Token', secret: true },
      { key: 'MercadoPago:PublicKey', label: 'Public Key', secret: false },
      { key: 'MercadoPago:WebhookSecret', label: 'Webhook Secret', secret: true },
    ],
  },
  {
    id: 'asaas',
    name: 'Asaas',
    description:
      'Gateway de pagamento com split automático: o líquido cai direto na carteira de cada parceiro (walletId no cadastro). Webhook reconcilia o status.',
    icon: '🏦',
    fields: [
      { key: 'Asaas:ApiKey', label: 'API Key', secret: true },
      { key: 'Asaas:WebhookToken', label: 'Webhook Token', secret: true },
      { key: 'Asaas:Environment', label: 'Ambiente (sandbox/production)', secret: false },
      { key: 'Asaas:DefaultCpfCnpj', label: 'CPF/CNPJ de teste (sandbox)', secret: false },
    ],
  },
  {
    id: 'email',
    name: 'E-mail (Gmail)',
    description: 'Conta Gmail para e-mails transacionais (confirmações e relatórios).',
    icon: '✉️',
    fields: [
      { key: 'Email:GmailUser', label: 'Conta Gmail', secret: false },
      { key: 'Email:GmailAppToken', label: 'App Password / Token', secret: true },
      { key: 'Email:FromName', label: 'Nome do remetente', secret: false },
    ],
  },
  {
    id: 'groq',
    name: 'Assistente IA (Groq)',
    description: 'LLM que conduz a conversa do chatbot rumo à conversão. Sem chave, o bot usa o modo local (regras).',
    icon: '🤖',
    fields: [
      { key: 'Groq:ApiKey', label: 'API Key (gsk_...)', secret: true },
      { key: 'Groq:Model', label: 'Modelo', secret: false },
    ],
  },
];

const ALLOWED_KEYS = new Set(CATALOG.flatMap((g) => g.fields.map((f) => f.key)));

function mask(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return '••••';
  return `••••••${v.slice(-4)}`;
}

function envValue(key: string): string | null {
  const env = process.env[key.replace(/:/g, '__')] ?? process.env[key];
  return env && env.trim() !== '' ? env : null;
}

export async function getGroups(): Promise<IntegrationGroupDto[]> {
  const rows = await prisma.integrationSetting.findMany();
  const result: IntegrationGroupDto[] = [];

  for (const g of CATALOG) {
    const fields: IntegrationFieldDto[] = [];
    for (const f of g.fields) {
      const dbRow = rows.find((r) => r.key === f.key);
      const dbVal = dbRow && dbRow.value.trim() !== '' ? dbRow.value : null;
      const envVal = envValue(f.key);
      const effective = dbVal ?? envVal;
      const source: 'db' | 'env' | 'unset' = dbVal !== null ? 'db' : envVal !== null ? 'env' : 'unset';
      const preview = effective === null ? '' : f.secret ? mask(effective) : effective;
      fields.push({ key: f.key, label: f.label, secret: f.secret, hasValue: effective !== null, preview, source });
    }
    const connected =
      fields.filter((x) => g.fields.find((cf) => cf.key === x.key)!.secret).every((x) => x.hasValue) &&
      fields.some((x) => x.hasValue);
    result.push({ id: g.id, name: g.name, description: g.description, icon: g.icon, connected, fields });
  }
  return result;
}

export async function updateSetting(actorId: string, req: UpdateSettingRequest): Promise<void> {
  if (!ALLOWED_KEYS.has(req.key)) throw new AppError('Chave de configuração inválida.', 400);

  const row = await prisma.integrationSetting.findUnique({ where: { key: req.key } });

  if (!req.value || req.value.trim() === '') {
    // Vazio → remove customização e volta ao .env.
    if (row) await prisma.integrationSetting.delete({ where: { key: req.key } });
  } else if (!row) {
    await prisma.integrationSetting.create({ data: { key: req.key, value: req.value.trim(), updatedBy: actorId } });
  } else {
    await prisma.integrationSetting.update({
      where: { key: req.key },
      data: { value: req.value.trim(), updatedBy: actorId, updatedAt: new Date() },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'settings.update',
      entityType: 'IntegrationSetting',
      entityId: req.key,
      // Nunca registramos o valor do segredo, só se foi definido ou limpo.
      payloadJson: JSON.stringify({ key: req.key, cleared: !req.value || req.value.trim() === '' }),
    },
  });
}
