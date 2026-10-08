import type { IntegrationFieldDto, IntegrationGroupDto, UpdateSettingRequest } from '../dtos/settings.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { clearSettingsCache } from '../infra/settingsProvider.js';

interface Field {
  key: string;
  label: string;
  secret: boolean;
  /**
   * Valores aceitos, quando o campo é uma escolha e não texto livre.
   *
   * Existe por causa do provedor de pagamento: digitar `asas` numa caixa de texto deixaria o
   * sistema em `mock` **silenciosamente**, porque a seleção cai no padrão quando não
   * reconhece o valor. Esse é exatamente o modo de falha que esta frente existe para matar.
   */
  options?: string[];
  hint?: string;
}
interface Group {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: Field[];
}

/** O que a plataforma aceita como provedor de pagamento, por serviço. */
export const PAYMENT_PROVIDERS_HUB = ['mock', 'asaas', 'mercadopago'] as const;
export const PAYMENT_PROVIDERS_OPENDRIVER = ['mock', 'asaas'] as const;

const CATALOG: Group[] = [
  {
    /**
     * Grupo novo, e o primeiro da lista de propósito: enquanto o provedor é `mock`, o sistema
     * **finge** que cobrou — o gateway simulado gera um QR falso e aprova sozinho depois de
     * 5 minutos. A diferença entre "cobrou" e "fingiu que cobrou" não aparecia em nenhum
     * lugar da interface, e a pior forma de descobrir isso é semanas depois.
     */
    id: 'payments',
    name: 'Provedor de pagamento',
    description:
      'Qual gateway processa o dinheiro de verdade. Enquanto estiver em "mock", nada é cobrado: o Pix gera um QR falso e a cobrança é aprovada sozinha depois de 5 minutos. Vale na hora, sem redeploy.',
    icon: '💰',
    fields: [
      {
        key: 'Payments:Provider',
        label: 'Provedor do hub (loja e marketplace)',
        secret: false,
        options: [...PAYMENT_PROVIDERS_HUB],
        hint: 'Sem valor aqui, vale PAYMENT_PROVIDER do ambiente, e o padrão dela é mock.',
      },
      {
        key: 'OpenDriver:PaymentProvider',
        label: 'Provedor do OpenDriver (corridas) — opcional',
        secret: false,
        options: [...PAYMENT_PROVIDERS_OPENDRIVER],
        hint: 'Sem valor, o OpenDriver usa o provedor do hub acima. Serve para ligar um serviço antes do outro, e porque o OpenDriver não implementa Mercado Pago.',
      },
    ],
  },
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
  {
    id: 'opendriver',
    name: 'OpenDriver (app de corridas)',
    description:
      'Serviço de corridas que divide este banco e este login. Usa a MESMA conta Asaas do grupo acima — estas chaves são só o que é específico dele.',
    icon: '🚗',
    fields: [
      {
        key: 'OpenDriver:AsaasWebhookToken',
        label: 'Webhook Token do Asaas (opcional — sem valor, usa o do grupo Asaas)',
        secret: true,
      },
      { key: 'OpenDriver:SafetyEmail', label: 'E-mail que recebe alertas de emergência', secret: false },
      { key: 'OpenDriver:EmailFromName', label: 'Nome do remetente nos e-mails do app', secret: false },
    ],
  },
  {
    id: 'infosimples',
    name: 'Infosimples (Detran)',
    description:
      'Consulta de CRLV por placa + RENAVAM para aprovar o veículo do motorista automaticamente. Sem token, todo veículo cai em revisão manual. Cobertura atual: MT e MS.',
    icon: '🪪',
    fields: [{ key: 'Infosimples:Token', label: 'Token da API', secret: true }],
  },
  {
    id: 'maps',
    name: 'Google Maps',
    description: 'Fallback de geocodificação do app de corridas. Sem chave, usa só o provedor padrão (OSM/Nominatim).',
    icon: '🗺️',
    fields: [{ key: 'Google:MapsApiKey', label: 'Maps API Key', secret: true }],
  },
  {
    id: 'internal',
    name: 'Comunicação entre serviços',
    description:
      'Chave que o hub, o OpenDriver e o OpenAd usam para falar entre si. Dois usos hoje: EXCLUSÃO DE CONTA (a conta é a mesma nos três, e cada um apaga o seu schema) e CRÉDITO DE VEICULAÇÃO (o hub confirma no OpenAd o Pix que o Asaas liquidou). Crie a chave em Chaves de API com os escopos account:read, account:purge e ads:credit:write, e cole o valor aqui. A MESMA chave serve os dois destinos, porque os três validam contra a mesma tabela. Sem ela, excluir conta é recusado e o crédito pago não entra — ver docs/normalizacao-banco.md.',
    icon: '🔗',
    fields: [{ key: 'Internal:AccountSyncKey', label: 'Chave de serviço (odh_svc_...)', secret: true }],
  },
  {
    id: 'openad',
    name: 'OpenAd — anúncios em telas automotivas',
    description:
      'Terceiro serviço do ecossistema: campanhas de anúncio em tablets instalados nos veículos. A URL é usada na exclusão de conta (fan-out) e para confirmar no OpenAd o crédito de veiculação pago por Pix; quando preenchida, vence OPENAD_API_URL. A chave de repasse autoriza o OpenAd a creditar o motorista em OpenDriver → Ganhos, e a mesma chave do OpenAd precisa de ads:credit:charge para pedir a cobrança Pix ao hub. Crie-a em Chaves de API com os escopos ads:earning:write, ads:payout:read e ads:credit:charge. O piso de repasse e o peso do leilão NÃO ficam aqui: são do painel do próprio OpenAd, porque mudam sem redeploy.',
    icon: '📺',
    fields: [
      { key: 'OpenAd:ApiUrl', label: 'URL da API do OpenAd (https://adsapi.opendriver.com.br)', secret: false },
      { key: 'OpenAd:EarningKey', label: 'Chave de repasse ao motorista (odh_svc_...)', secret: true },
    ],
  },
  {
    id: 'survey',
    name: 'Pesquisa de opinião',
    description:
      'Link pessoal do motorista → Formbricks. Quem responde "sem candidato" recebe um vídeo por WhatsApp e gera pagamento pro motorista.',
    icon: '📋',
    fields: [
      { key: 'Survey:FormUrl', label: 'URL da survey (Formbricks)', secret: false },
      { key: 'Survey:VideoUrls', label: 'Links dos vídeos (um por linha — sorteia um a cada envio)', secret: false },
      { key: 'Survey:MessageTemplate', label: 'Mensagem do WhatsApp (use {{name}} e {{videoUrl}})', secret: false },
      { key: 'Survey:RewardAmount', label: 'Valor pago ao motorista por lead (R$)', secret: false },
      { key: 'Survey:WebhookSecret', label: 'Webhook Secret (whsec_...) do Formbricks', secret: true },
      { key: 'Survey:ExpectedWebhookId', label: 'Webhook ID (fallback se não houver secret)', secret: true },
    ],
  },
];

const ALLOWED_KEYS = new Set(CATALOG.flatMap((g) => g.fields.map((f) => f.key)));
const FIELD_BY_KEY = new Map(CATALOG.flatMap((g) => g.fields.map((f) => [f.key, f] as const)));

function mask(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return '••••';
  return `••••••${v.slice(-4)}`;
}

function envValue(key: string): string | null {
  const env = process.env[key.replace(/:/g, '__')] ?? process.env[key];
  return env && env.trim() !== '' ? env : null;
}

/** Resolve o valor em vigor de uma chave a partir das linhas já carregadas. */
function efetivo(rows: { key: string; value: string }[], key: string): string | null {
  const dbRow = rows.find((r) => r.key === key);
  const dbVal = dbRow && dbRow.value.trim() !== '' ? dbRow.value : null;
  return dbVal ?? envValue(key);
}

/**
 * Provedor em vigor em cada serviço, sem consultar o banco de novo.
 *
 * O OpenDriver tem override próprio e cai no do hub quando não tem — mesmo padrão que
 * `OpenDriver:AsaasWebhookToken` já usa. O motivo de existir o override: o OpenDriver não
 * implementa Mercado Pago, e sem a distinção um hub em `mercadopago` deixaria o OpenDriver em
 * `mock` sem nada indicar isso.
 */
function provedoresEmVigor(rows: { key: string; value: string }[]) {
  const hub = (efetivo(rows, 'Payments:Provider') ?? 'mock').toLowerCase();
  const od = (efetivo(rows, 'OpenDriver:PaymentProvider') ?? hub).toLowerCase();
  return {
    hub,
    // Valor que o OpenDriver não reconhece vira `mock` lá; refletir isso aqui evita a tela
    // dizer "mercadopago" para um serviço que está, de fato, simulando.
    opendriver: (PAYMENT_PROVIDERS_OPENDRIVER as readonly string[]).includes(od) ? od : 'mock',
  };
}

export async function getGroups(): Promise<IntegrationGroupDto[]> {
  const rows = await prisma.integrationSetting.findMany();
  const result: IntegrationGroupDto[] = [];
  const provedores = provedoresEmVigor(rows);

  for (const g of CATALOG) {
    const fields: IntegrationFieldDto[] = [];
    for (const f of g.fields) {
      const dbRow = rows.find((r) => r.key === f.key);
      const dbVal = dbRow && dbRow.value.trim() !== '' ? dbRow.value : null;
      const envVal = envValue(f.key);
      const effective = dbVal ?? envVal;
      const source: 'db' | 'env' | 'unset' = dbVal !== null ? 'db' : envVal !== null ? 'env' : 'unset';
      const preview = effective === null ? '' : f.secret ? mask(effective) : effective;
      fields.push({
        key: f.key,
        label: f.label,
        secret: f.secret,
        hasValue: effective !== null,
        preview,
        source,
        options: f.options,
        hint: f.hint,
      });
    }

    // Mesmo texto da rota enxuta `/admin/payment-mode`, de uma função só: duas redações do
    // mesmo alerta divergiriam na primeira edição.
    const warning = g.id === 'payments' ? avisoDePagamento(provedores) : null;

    /**
     * `connected` olhava só para os campos secretos, e o grupo de pagamento não tem nenhum —
     * sem este caso ele apareceria sempre como "Incompleto". Aqui "configurado" significa
     * outra coisa: provedor de verdade escolhido nos dois serviços.
     */
    const connected =
      g.id === 'payments'
        ? provedores.hub !== 'mock' && provedores.opendriver !== 'mock'
        : fields.filter((x) => FIELD_BY_KEY.get(x.key)!.secret).every((x) => x.hasValue) &&
          fields.some((x) => x.hasValue);

    result.push({ id: g.id, name: g.name, description: g.description, icon: g.icon, connected, warning, fields });
  }
  return result;
}

/** Texto do alerta de pagamento simulado, ou `null` quando os dois serviços cobram de verdade. */
function avisoDePagamento(p: { hub: string; opendriver: string }): string | null {
  const simulados = [
    p.hub === 'mock' && 'o hub (loja e marketplace)',
    p.opendriver === 'mock' && 'o OpenDriver (corridas)',
  ].filter(Boolean) as string[];
  if (!simulados.length) return null;
  return `Pagamento SIMULADO em ${simulados.join(' e ')}. Nada é cobrado de verdade: o Pix gera um QR falso e a cobrança é aprovada sozinha depois de 5 minutos.`;
}

/**
 * Provedor em vigor, para quem precisa só disso.
 *
 * A faixa de aviso do painel carrega em toda tela administrativa; trazer o catálogo inteiro de
 * integrações a cada navegação, com todos os segredos mascarados, seria carga desnecessária no
 * caminho mais percorrido. Duas chaves bastam.
 */
export async function getPaymentMode(): Promise<{
  hub: string;
  opendriver: string;
  simulated: boolean;
  warning: string | null;
}> {
  const rows = await prisma.integrationSetting.findMany({
    where: { key: { in: ['Payments:Provider', 'OpenDriver:PaymentProvider'] } },
  });
  const p = provedoresEmVigor(rows);
  return { ...p, simulated: p.hub === 'mock' || p.opendriver === 'mock', warning: avisoDePagamento(p) };
}

export async function updateSetting(actorId: string, req: UpdateSettingRequest): Promise<void> {
  if (!ALLOWED_KEYS.has(req.key)) throw new AppError('Chave de configuração inválida.', 400);

  const campo = FIELD_BY_KEY.get(req.key)!;
  const valor = req.value?.trim() ?? '';
  /**
   * Campo com opções é validado aqui, e não só na tela.
   *
   * Sem isto, um valor errado no provedor de pagamento não dá erro nenhum: a seleção não
   * reconhece, cai no padrão `mock`, e o sistema volta a fingir que cobra — com a tela
   * mostrando o valor digitado como se estivesse valendo.
   */
  if (valor && campo.options && !campo.options.includes(valor.toLowerCase())) {
    throw new AppError(`Valor inválido para ${campo.label}. Use um destes: ${campo.options.join(', ')}.`, 400);
  }

  const row = await prisma.integrationSetting.findUnique({ where: { key: req.key } });

  // Campo com opções é gravado em minúsculas: a comparação na seleção do gateway é por
  // igualdade, e "Asaas" gravado assim cairia no padrão `mock` sem avisar.
  const paraGravar = campo.options ? valor.toLowerCase() : valor;

  if (paraGravar === '') {
    // Vazio → remove customização e volta ao .env.
    if (row) await prisma.integrationSetting.delete({ where: { key: req.key } });
  } else if (!row) {
    await prisma.integrationSetting.create({ data: { key: req.key, value: paraGravar, updatedBy: actorId } });
  } else {
    await prisma.integrationSetting.update({
      where: { key: req.key },
      data: { value: paraGravar, updatedBy: actorId, updatedAt: new Date() },
    });
  }

  // A mudança tem de valer na hora nesta instância; sem isto, o cache de 30 s do
  // `settingsProvider` continuaria entregando o valor antigo para quem já o consultou.
  clearSettingsCache(req.key);

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'settings.update',
      entityType: 'IntegrationSetting',
      entityId: req.key,
      // Nunca registramos o valor do segredo, só se foi definido ou limpo. Campo com opções
      // não é segredo e o valor importa na auditoria: trocar o provedor de pagamento é a
      // mudança mais consequente desta tela.
      payloadJson: JSON.stringify({
        key: req.key,
        cleared: valor === '',
        ...(campo.options && valor ? { value: valor.toLowerCase() } : {}),
      }),
    },
  });
}
