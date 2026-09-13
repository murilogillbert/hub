import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export const createOrderSchema = z.object({
  productId: z.string().uuid().optional(),
  useCashback: z.boolean().default(false),
  items: z.array(cartItemSchema).optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export interface OrderItemDto {
  id: string;
  productId: string;
  productTitle: string;
  imageUrl: string;
  category: string;
  partnerId: string;
  partnerName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  cashbackEarned: number;
  redeemed: boolean;
  redeemedAt: Date | null;
}

export interface OrderDto {
  id: string;
  code: string;
  productId: string;
  productTitle: string;
  partnerId: string;
  partnerName: string;
  customerId: string;
  customerName: string;
  paidPrice: number;
  cashbackEarned: number;
  cashbackUsed: number;
  status: string;
  createdAt: Date;
  redeemedAt: Date | null;
  items: OrderItemDto[];
}

export interface CashbackEntryDto {
  id: string;
  type: string;
  amount: number;
  orderId: string | null;
  orderCode: string | null;
  description: string;
  createdAt: Date;
}

export const cardInputSchema = z.object({
  number: z.string().default(''),
  holder: z.string().default(''),
  expiry: z.string().default(''),
  cvv: z.string().default(''),
  // CEP + número do endereço do titular — exigidos pelo Asaas na tokenização
  // do cartão (creditCardHolderInfo).
  postalCode: z.string().optional(),
  addressNumber: z.string().optional(),
  token: z.string().optional(),
  paymentMethodId: z.string().optional(),
  installments: z.number().int().optional(),
});

export const processPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['pix', 'credit_card', 'debit_card', 'credit', 'debit']),
  card: cardInputSchema.optional().nullable(),
});
export type ProcessPaymentRequest = z.infer<typeof processPaymentSchema>;

export const redeemRequestSchema = z.object({
  code: z.string().min(1),
});

export interface RedeemResult {
  orderId: string;
  productTitle: string;
  customerName: string;
  paidPrice: number;
  feePercent: number;
  platformFee: number;
  customerCashback: number;
  partnerNet: number;
  redeemed: boolean;
}
