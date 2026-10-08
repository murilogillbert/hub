import { config } from '../../config.js';
import { getSetting } from '../settingsProvider.js';
import { AsaasGateway } from './asaas.js';
import { MercadoPagoGateway } from './mercadoPago.js';
import { MockPaymentGateway } from './mock.js';
import type { IPaymentGateway } from './types.js';

/**
 * Gateway de pagamento, escolhido **em tempo de execução** por `Payments:Provider`.
 *
 * Antes era uma constante de módulo resolvida no boot a partir de `PAYMENT_PROVIDER`, e trocar
 * de provedor exigia redeploy. Isso criava uma assimetria ruim: as credenciais do Asaas já
 * entravam pela tela de Integrações e valiam na hora, mas **ligar** o Asaas era variável de
 * ambiente. O resultado prático é que o sistema ficava em `mock` — fingindo cobrar, com QR
 * falso e aprovação automática depois de 5 minutos — com as credenciais corretas no lugar.
 *
 * A precedência é a mesma de qualquer configuração aqui: banco > env > padrão. O padrão
 * continua `mock`, de propósito: um ambiente novo não deve começar cobrando de ninguém.
 *
 * As três implementações são sem estado, então são instanciadas uma vez e reusadas; o que
 * muda a cada chamada é só qual delas responde.
 */
const INSTANCIAS: Record<string, IPaymentGateway> = {
  mock: new MockPaymentGateway(),
  asaas: new AsaasGateway(),
  mercadopago: new MercadoPagoGateway(),
};

/** Stub injetado em teste; quando presente, vence tudo. */
let stubDeTeste: IPaymentGateway | null = null;

export async function getPaymentGateway(): Promise<IPaymentGateway> {
  if (stubDeTeste) return stubDeTeste;

  // `getSetting` tem cache de 30 s, então isto não é uma consulta ao banco por cobrança.
  const escolhido = (await getSetting('Payments:Provider')) ?? config.paymentProvider;
  const chave = escolhido.trim().toLowerCase();

  /**
   * Valor não reconhecido cai em `mock`, e isso é deliberadamente **conservador**: na dúvida,
   * não cobrar de verdade. O que impede a configuração errada de passar despercebida é a
   * validação na escrita (`settingsService`, campo com `options`) e o aviso no admin — não o
   * silêncio aqui.
   */
  return INSTANCIAS[chave] ?? INSTANCIAS.mock!;
}

/** Nome do provedor em vigor, para gravar no pagamento e para a interface. */
export async function getPaymentProviderName(): Promise<string> {
  return (await getPaymentGateway()).provider;
}

/** Só para testes: injeta um gateway stub (ex.: sempre aprova). */
export function __setPaymentGatewayForTests(gateway: IPaymentGateway | null): void {
  stubDeTeste = gateway;
}

export type { IPaymentGateway } from './types.js';

/**
 * Grita no log do boot quando o pagamento está simulado.
 *
 * Não recusa o boot: simular pagamento é legítimo em desenvolvimento e homologação, e derrubar
 * o serviço por isso trocaria um problema silencioso por indisponibilidade. O que faltava era o
 * **sinal** — com o gateway simulado, a diferença entre "cobrou" e "fingiu que cobrou" não
 * aparecia nem na interface nem no log, e o pior jeito de descobrir isso é semanas depois.
 *
 * Nunca lança: é diagnóstico, e falha ao ler configuração não pode impedir o serviço de atender.
 */
export async function avisarSePagamentoSimulado(): Promise<void> {
  try {
    const g = await getPaymentGateway();
    if (g.provider !== 'mock') {
      console.log(`Pagamento: provedor ativo "${g.provider}".`);
      return;
    }
    console.warn(
      [
        '',
        '  ATENCAO: pagamento SIMULADO. Nada e cobrado de verdade.',
        '  O Pix gera um QR falso e a cobranca e aprovada sozinha depois de 5 minutos.',
        '',
        '  Para cobrar de verdade: Admin > Integracoes > Provedor de pagamento.',
        '  Vale na hora, sem redeploy.',
        '',
      ].join('\n'),
    );
  } catch (err) {
    console.warn('Nao consegui descobrir o provedor de pagamento ativo:', err);
  }
}
