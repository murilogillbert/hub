import { z } from 'zod';

/**
 * Pedido de cobrança Pix de crédito de veiculação, enviado pelo OpenAd.
 *
 * `reference` é o identificador da **compra no OpenAd**, e é por ele que a confirmação volta.
 * Mandar o id da compra, em vez de o hub gerar um valor novo, é o que liga os dois lados sem
 * precisar de uma tabela de correspondência.
 */
export const adCreditChargeSchema = z.object({
  reference: z.string().uuid(),
  /** `public.users.id` do anunciante. É dele que saem nome, e-mail e CPF do cliente no Asaas. */
  userId: z.string().uuid(),
  /**
   * Centavos inteiros, como todo dinheiro nesta fronteira.
   *
   * O piso e o teto de negócio ficam no OpenAd, que é quem conhece o preço por segundo e o que
   * um ciclo de reserva consome. Aqui são limites de sanidade: `int` positivo recusa zero,
   * fração e negativo antes de qualquer chamada ao provedor, e o teto barra erro de digitação
   * que viraria uma cobrança de milhões.
   */
  amountCents: z.number().int().positive().max(100_000_000),
  description: z.string().min(3).max(200),
});
export type AdCreditChargeRequest = z.infer<typeof adCreditChargeSchema>;
