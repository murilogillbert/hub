import { Decimal } from 'decimal.js';

/** Regras puras de negócio (cashback e repasse ao parceiro). Usa decimal.js
 * internamente para evitar erro de ponto flutuante em cálculos monetários
 * (equivalente ao `decimal` do C#, que o `number` do JS não é). */
export type Money = number | string | Decimal;

export function cashbackFor(price: Money, cashbackPercent: Money): number {
  return new Decimal(price).times(cashbackPercent).div(100).toDecimalPlaces(2).toNumber();
}

export function platformFeeFor(price: Money, feePercent: Money): number {
  return new Decimal(price).times(feePercent).div(100).toDecimalPlaces(2).toNumber();
}

/** Comissão do motorista afiliado = percentual sobre o subtotal vendido
 * pelo parceiro daquele pedido (programa loja↔motorista, distinto da
 * pesquisa de opinião). */
export function driverCommissionFor(subtotal: Money, commissionPercent: Money): number {
  return new Decimal(subtotal).times(commissionPercent).div(100).toDecimalPlaces(2).toNumber();
}

/** Líquido do parceiro = pago − taxa da plataforma − cashback do cliente −
 * comissão do motorista afiliado (se houver). A taxa da plataforma nunca
 * muda por causa da comissão — só reduz o líquido do próprio parceiro. */
export function partnerNet(paidPrice: Money, platformFee: Money, cashback: Money, commission: Money = 0): number {
  return new Decimal(paidPrice)
    .minus(platformFee)
    .minus(cashback)
    .minus(commission)
    .toDecimalPlaces(2)
    .toNumber();
}

/** Arredonda um valor monetário para 2 casas decimais (equivalente a Math.Round(_, 2)). */
export function round2(value: Money): number {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}
