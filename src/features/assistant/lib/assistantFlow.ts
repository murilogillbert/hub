/**
 * Fluxo do chatbot — portado do Opendriver (apps/web/src/lib/assistantFlow.ts)
 * e adaptado ao domínio OpenDriverHub: marketplace de parceiros com cashback.
 */

export type AssistantQuickReply = {
  label: string;
  value: string;
};

export type AssistantIntent =
  | 'cashback'
  | 'economia'
  | 'praticidade'
  | 'exclusivo'
  | 'parceiro'
  | 'suporte'
  | 'unknown';

export const profileReplies: AssistantQuickReply[] = [
  { label: 'Quero comprar', value: 'Quero comprar' },
  { label: 'Sou parceiro', value: 'Sou parceiro' },
  { label: 'Só pesquisando', value: 'Só pesquisando' },
];

export const categoryReplies: AssistantQuickReply[] = [
  { label: 'Alimentação', value: 'Alimentação' },
  { label: 'Cafeteria', value: 'Cafeteria' },
  { label: 'Entretenimento', value: 'Entretenimento' },
  { label: 'Educação', value: 'Educação' },
];

export const goalReplies: AssistantQuickReply[] = [
  { label: 'Ganhar cashback', value: 'Ganhar cashback' },
  { label: 'Pagar mais barato', value: 'Pagar mais barato' },
  { label: 'Praticidade', value: 'Praticidade' },
  { label: 'Produtos exclusivos', value: 'Produtos exclusivos' },
];

export const assistantWelcomeText =
  'Oi! Sou o assistente do OpenDriverHub. Em 3 perguntas rápidas eu te mostro os melhores produtos com cashback — e, se quiser, te passo para um atendente no WhatsApp.';

export const intentResponses: Record<
  Exclude<AssistantIntent, 'unknown'>,
  { label: string; response: string; summary: string; score: number }
> = {
  cashback: {
    label: 'cashback nas compras',
    response:
      'Boa escolha. No OpenDriverHub cada compra devolve uma parte em cashback, que entra como crédito para abater na próxima aquisição.',
    summary: 'interesse em acumular cashback',
    score: 3,
  },
  economia: {
    label: 'preços menores',
    response:
      'Perfeito. Os parceiros oferecem preços exclusivos para a nossa base — você paga menos do que no balcão e ainda recebe cashback.',
    summary: 'interesse em economizar nas compras',
    score: 3,
  },
  praticidade: {
    label: 'praticidade no resgate',
    response:
      'Show. O fluxo é simples: comprou, recebeu um QR code, mostrou no parceiro e pronto. Sem fila e sem burocracia.',
    summary: 'interesse em praticidade/QR code',
    score: 2,
  },
  exclusivo: {
    label: 'produtos exclusivos',
    response:
      'Temos vouchers e combos que só existem aqui no hub, negociados direto com os parceiros.',
    summary: 'interesse em produtos exclusivos',
    score: 2,
  },
  parceiro: {
    label: 'vender como parceiro',
    response:
      'Ótimo! Como parceiro você acessa a nossa base de clientes, vende físico/digital/voucher e acompanha métricas em tempo real. A taxa só incide sobre vendas concretizadas.',
    summary: 'interesse em se tornar parceiro',
    score: 3,
  },
  suporte: {
    label: 'falar com atendimento',
    response:
      'Sem problema. Posso te encaminhar para um atendente humano com todo o contexto já preenchido.',
    summary: 'interesse em suporte direto',
    score: 1,
  },
};

export const fallbackPainResponse =
  'Entendi. Vou considerar como interesse em aproveitar melhor os benefícios e o cashback do hub.';
