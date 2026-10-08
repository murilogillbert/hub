import * as adCreditCharges from '../infra/adCreditCharges.js';
import * as openadCredit from '../infra/openadCredit.js';

/**
 * Ponte entre o webhook de pagamento do hub e o livro-caixa de crédito do OpenAd.
 *
 * ============================================================================
 * Por que o gancho é no pagamento **sem pedido**
 * ============================================================================
 *
 * Uma cobrança de crédito de veiculação não tem `Order` no hub. Hoje, quando o webhook recebe um
 * pagamento que não casa com nenhum pedido, `reconcileByExternal` registra `status: 'ignored'` e
 * encerra — é exatamente ali que todo pagamento do OpenAd cai. Aproveitar esse ramo tem duas
 * vantagens sobre ramificar no roteador: é o funil por onde passa **todo** webhook de pagamento,
 * de qualquer provedor, e a linha em `payment_events` sai de graça, com trilha do que foi feito.
 *
 * ============================================================================
 * A decisão sai da resposta do Asaas, não do corpo do webhook
 * ============================================================================
 *
 * `consultarCobranca` reconsulta o pagamento e lê dali **as duas** informações que importam: o
 * status e a referência. Se qualquer uma viesse do corpo recebido, um POST forjado com a
 * referência de uma compra real e `status: RECEIVED` creditaria saldo de graça. O token do
 * webhook já barra isso, mas autenticação e autorização são camadas diferentes: o token diz que
 * quem chamou é o Asaas, não que o conteúdo é verdade.
 */

/**
 * Trata um pagamento que não tem pedido no hub.
 *
 * Devolve `null` quando o pagamento não é do OpenAd — e aí o chamador mantém o resultado que já
 * tinha, sem nenhuma mudança de comportamento para o fluxo de pedidos.
 */
export async function tratarPagamentoSemPedido(paymentId: string): Promise<string | null> {
  const cobranca = await adCreditCharges.consultarCobranca(paymentId);
  if (!cobranca?.purchaseId) return null;

  if (cobranca.status === 'approved') {
    await openadCredit.confirmarCredito(cobranca.purchaseId, paymentId);
    return 'openad_credit_confirmed';
  }

  if (cobranca.status === 'rejected') {
    /**
     * `rejected` aqui é devolução ou contestação — `mapStatus` agrupa `REFUNDED`,
     * `REFUND_*` e `CHARGEBACK_*`. O estorno no OpenAd é um lançamento compensatório, e o
     * `statusDetail` vai como motivo para o extrato dizer **qual** evento devolveu o dinheiro.
     */
    await openadCredit.estornarCredito(
      cobranca.purchaseId,
      `Asaas: ${cobranca.statusDetail ?? 'pagamento devolvido'}`,
    );
    return 'openad_credit_refunded';
  }

  /**
   * Pendente: o Asaas avisa de eventos intermediários (cobrança criada, cobrança vencida). Não
   * há nada a lançar, e responder sucesso é o certo — devolver erro faria o provedor reenviar
   * para sempre um evento que não tem desfecho.
   */
  return 'openad_credit_pending';
}
