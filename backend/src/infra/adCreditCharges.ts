import { AppError } from '../errors.js';
import { baseUrlAndHeaders, extractError, mapStatus } from './paymentGateways/asaas.js';
import { getPaymentProviderName } from './paymentGateways/index.js';
import { prisma } from './prisma.js';

/**
 * Cobrança Pix **sem pedido**, para o anunciante comprar crédito de veiculação no OpenAd.
 *
 * ============================================================================
 * Por que o hub cria a cobrança, e não o OpenAd
 * ============================================================================
 *
 * As credenciais do Asaas vivem em `public.integration_settings`, que é do hub, e a integração
 * já existe aqui completa: cliente, cobrança, QR Pix, split por carteira e reconsulta de status
 * no webhook. Duplicá-la no OpenAd significaria duas implementações do mesmo provedor e — o
 * pior — a chave do Asaas em dois lugares. O OpenAd pede, o hub cobra.
 *
 * ============================================================================
 * Por que não passa pelo `IPaymentGateway`
 * ============================================================================
 *
 * Porque a interface é de **pagamento de pedido**: `process(order, ...)` precisa de cliente,
 * itens e split por parceiro. Crédito de veiculação não tem nenhum dos três. Alargar a
 * interface faria as três implementações carregarem um método que duas delas não têm como
 * cumprir de verdade.
 *
 * ============================================================================
 * Em `mock` a cobrança é recusada, não simulada
 * ============================================================================
 *
 * O gateway simulado gera QR falso e aprova sozinho depois de 5 minutos. Para um pedido em
 * desenvolvimento isso é útil. Para crédito de veiculação seria pior do que inútil: o
 * anunciante receberia um código Pix que o banco dele não reconhece, e ficaria tentando pagar.
 * Recusar com mensagem clara manda a operação para o caminho certo — o lançamento manual em
 * `POST /internal/ads/credits/adjust` do OpenAd, que existe exatamente para isso.
 */

/**
 * Prefixo que marca a cobrança como de crédito do OpenAd.
 *
 * É o que permite ao webhook distinguir, **pela resposta do próprio Asaas**, um pagamento que
 * não tem pedido no hub porque é de outro serviço, de um que não tem pedido porque alguém
 * mandou um id inexistente. Sem a marca, os dois casos são indistinguíveis e o segundo viraria
 * uma chamada ao OpenAd com um identificador aleatório.
 */
const PREFIXO = 'OA-';

export interface CobrancaDeCredito {
  externalId: string;
  copyPaste: string;
  expiresAt: string | null;
}

export function referenciaDeCompra(purchaseId: string): string {
  return `${PREFIXO}${purchaseId}`;
}

/** Devolve o `purchaseId` quando a referência é de crédito do OpenAd; `null` caso contrário. */
export function compraDaReferencia(referencia: string | null | undefined): string | null {
  if (typeof referencia !== 'string' || !referencia.startsWith(PREFIXO)) return null;
  const id = referencia.slice(PREFIXO.length).trim();
  /**
   * Confere que é UUID antes de devolver. A referência vem de fora (é texto que o Asaas nos
   * devolve), e repassá-la sem validar faria uma referência adulterada chegar à URL da chamada
   * ao OpenAd.
   */
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** `true` quando o provedor em vigor sabe cobrar de verdade. */
export async function cobrancaDisponivel(): Promise<boolean> {
  return (await getPaymentProviderName()) === 'asaas';
}

export async function criarCobrancaPix(params: {
  purchaseId: string;
  userId: string;
  amountCents: number;
  description: string;
}): Promise<CobrancaDeCredito> {
  const provedor = await getPaymentProviderName();
  if (provedor !== 'asaas') {
    throw new AppError(
      `Provedor de pagamento em "${provedor}": cobrança Pix de crédito de veiculação indisponível. ` +
        'Troque em Admin → Integrações, ou lance o crédito manualmente.',
      503,
    );
  }

  const { baseUrl, headers } = await baseUrlAndHeaders();
  const pagador = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, email: true, cpf: true, phone: true },
  });
  if (!pagador) throw new AppError('Usuário pagador não encontrado.', 404);

  const customerId = await garantirCliente(baseUrl, headers, pagador);

  /**
   * `value` em reais com duas decimais, como o Asaas espera. A conversão de centavos acontece
   * **aqui e só aqui**: do lado do OpenAd o dinheiro é inteiro de ponta a ponta, e é na
   * fronteira com o provedor que ele vira decimal.
   */
  const valor = Math.round(params.amountCents) / 100;
  const body = {
    customer: customerId,
    billingType: 'PIX',
    value: valor,
    dueDate: new Date().toISOString().slice(0, 10),
    externalReference: referenciaDeCompra(params.purchaseId),
    description: params.description,
    /**
     * Sem `split`: o crédito de veiculação é receita da plataforma, e o repasse ao motorista
     * sai depois, por veiculação, em `opendriver.driver_earnings`. Dividir aqui pagaria o
     * motorista por um anúncio que ainda não tocou.
     */
  };

  const resp = await fetch(`${baseUrl}payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
  if (!resp.ok) throw new AppError(`Asaas: ${extractError(raw)}`, 502);

  const paymentId = raw.id as string | undefined;
  if (!paymentId) throw new AppError('Asaas não retornou o id da cobrança.', 502);

  const pix = await buscarPix(baseUrl, headers, paymentId);
  if (!pix) {
    /**
     * A cobrança existe no Asaas mas o QR não veio. Falhar é o certo: o anunciante está na tela
     * esperando o código, e devolver sucesso sem ele o deixaria aguardando um pagamento que não
     * tem como fazer. A cobrança órfã vence sozinha no mesmo dia (`dueDate` é hoje).
     */
    throw new AppError('Asaas criou a cobrança mas não devolveu o código Pix.', 502);
  }

  return { externalId: paymentId, copyPaste: pix.copyPaste, expiresAt: pix.expiresAt };
}

/**
 * Status da cobrança **e** a referência, lidos do Asaas.
 *
 * As duas informações vêm da mesma consulta, de propósito: é o que permite ao webhook decidir
 * sem confiar em nada do corpo recebido. Um POST forjado com `externalReference` de uma compra
 * real e `status: RECEIVED` creditaria saldo se a decisão saísse do corpo.
 */
export async function consultarCobranca(paymentId: string): Promise<{
  status: 'approved' | 'rejected' | 'pending';
  statusDetail: string | null;
  purchaseId: string | null;
} | null> {
  if ((await getPaymentProviderName()) !== 'asaas') return null;
  const { baseUrl, headers } = await baseUrlAndHeaders();
  const resp = await fetch(`${baseUrl}payments/${encodeURIComponent(paymentId)}`, { headers });
  if (!resp.ok) return null;
  const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
  return {
    status: mapStatus(raw.status),
    statusDetail: (raw.status as string | undefined) ?? null,
    purchaseId: compraDaReferencia(raw.externalReference),
  };
}

async function garantirCliente(
  baseUrl: string,
  headers: Record<string, string>,
  pagador: { id: string; name: string; email: string; cpf: string | null; phone: string | null },
): Promise<string> {
  /**
   * O Asaas exige CPF/CNPJ no cliente para Pix. Diferente do checkout de pedido, aqui **não**
   * há queda para `Asaas:DefaultCpfCnpj`: aquele é um CPF de teste, e usá-lo numa cobrança real
   * emitiria um Pix no nome de outra pessoa. Faltando o documento, o pedido é recusado com
   * mensagem que diz o que preencher — e é recusado **antes** de criar qualquer coisa no
   * provedor.
   */
  if (!pagador.cpf) {
    throw new AppError('Cadastre o CPF ou CNPJ do anunciante antes de gerar a cobrança Pix.', 400);
  }

  const body: Record<string, unknown> = {
    name: pagador.name,
    email: pagador.email,
    externalReference: pagador.id,
    cpfCnpj: pagador.cpf,
  };
  if (pagador.phone) body.phone = pagador.phone;

  const resp = await fetch(`${baseUrl}customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
  if (!resp.ok) throw new AppError(`Asaas (cliente): ${extractError(raw)}`, 502);
  const id = raw.id as string | undefined;
  if (!id) throw new AppError('Asaas não retornou o id do cliente.', 502);
  return id;
}

async function buscarPix(
  baseUrl: string,
  headers: Record<string, string>,
  paymentId: string,
): Promise<{ copyPaste: string; expiresAt: string | null } | null> {
  const resp = await fetch(`${baseUrl}payments/${paymentId}/pixQrCode`, { headers });
  if (!resp.ok) return null;
  const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
  const payload = (raw.payload as string | undefined) ?? '';
  if (!payload) return null;
  const expiresAt = raw.expirationDate
    ? new Date(raw.expirationDate).toISOString()
    : new Date(Date.now() + 30 * 60 * 1000).toISOString();
  return { copyPaste: payload, expiresAt };
}
