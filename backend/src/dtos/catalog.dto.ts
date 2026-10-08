import { z } from 'zod';

export interface ProductDto {
  id: string;
  partnerId: string;
  partnerName: string;
  title: string;
  description: string;
  price: number;
  cashbackPercent: number;
  kind: string;
  imageUrl: string;
  category: string;
  rating: number;
  /**
   * Estoque da **rede inteira**. É o que autoriza a compra.
   *
   * Significado inalterado de propósito: três aplicativos publicados leem este campo. Onde dá
   * para retirar é outra pergunta, respondida por `availableStores`.
   */
  stock: number;
  digital: boolean;
  cities: string[];
  states: string[];
  /**
   * Aditivo. Unidades onde o produto está disponível.
   *
   * Vazio tem **dois** significados, e por isso vem acompanhado de `storeStockDeclared`:
   * produto sem nenhuma linha de estoque por unidade está disponível em todas as unidades do
   * parceiro (é o comportamento de hoje, e o acervo inteiro está assim), enquanto produto com
   * linhas declaradas e nenhuma disponível está realmente esgotado em todas.
   */
  availableStores: string[];
  /** `false` quando o produto não tem estoque por unidade declarado. */
  storeStockDeclared: boolean;
}

export const productUpsertSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  price: z.number().nonnegative(),
  cashbackPercent: z.number().min(0).max(100),
  kind: z.string(),
  imageUrl: z.string().default(''),
  category: z.string().default(''),
  stock: z.number().int().nonnegative(),
});
export type ProductUpsertRequest = z.infer<typeof productUpsertSchema>;

export interface PartnerDto {
  id: string;
  name: string;
  segment: string;
  logoUrl: string;
  active: boolean;
  feePercent: number;
  joinedAt: Date;
  cnpj: string;
  documentType: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  asaasWalletId: string | null;
  evolutionInstance: string | null;
}

export const partnerUpsertSchema = z.object({
  name: z.string().min(1),
  segment: z.string().min(1),
  logoUrl: z.string().default(''),
  feePercent: z.number().min(0).max(100),
  active: z.boolean(),
  cnpj: z.string().optional().nullable(),
  documentType: z.enum(['CPF', 'CNPJ']).optional(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  asaasWalletId: z.string().optional().nullable(),
  // Instância do afiliado no Evolution API — só relevante pra Partner.kind =
  // SolarAffiliate, mas fica no mesmo upsert de sempre (igual asaasWalletId).
  evolutionInstance: z.string().optional().nullable(),
});
export type PartnerUpsertRequest = z.infer<typeof partnerUpsertSchema>;

/** Autoatendimento: o próprio parceiro/afiliado edita seus dados — mesmos
 * campos de partnerUpsertSchema, exceto feePercent/active/asaasWalletId
 * (exclusivos do Admin). Tudo opcional: um afiliado manda só city/state,
 * uma loja manda tudo. */
export const updateMyPartnerProfileSchema = z.object({
  name: z.string().min(1).optional(),
  segment: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
  cnpj: z.string().optional().nullable(),
  documentType: z.enum(['CPF', 'CNPJ']).optional(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});
export type UpdateMyPartnerProfileRequest = z.infer<typeof updateMyPartnerProfileSchema>;

// ---------- Sugestão de categoria/segmento (opção "Outro") ----------
export interface CategorySuggestionDto {
  id: string;
  name: string;
  type: string;
  status: string;
  partnerId: string | null;
  partnerName: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface StoreDto {
  id: string;
  partnerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  category: string;
  imageUrl: string;
  /** Aditivos. Cliente que não conhece ignora; os apps publicados não os enviam nem leem. */
  active: boolean;
  timezone: string;
  openingHours: Record<string, { de: string; ate: string }[]> | null;
  /**
   * Resposta pronta, calculada no fuso da unidade.
   *
   * Vai no DTO em vez de deixar o cliente calcular porque o cliente não tem o fuso certo nem a
   * regra do intervalo que cruza a meia-noite — e três clientes diferentes implementariam a
   * mesma regra três vezes, com três resultados nas bordas.
   */
  openNow: boolean;
  /** `null` quando não há horário declarado ou nenhuma abertura nos próximos 7 dias. */
  nextOpening: { dia: string; hora: string } | null;
}

export interface NearbyStoreDto extends StoreDto {
  distanceKm: number;
}

export const storeUpsertSchema = z.object({
  partnerId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  category: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  /**
   * Campos novos, todos opcionais.
   *
   * Opcionais por necessidade, não por conveniência: o painel web atual e o app enviam o corpo
   * inteiro neste mesmo `PUT`, sem conhecer estes campos. Se fossem obrigatórios, salvar uma
   * unidade pela tela de hoje passaria a responder 400. E `undefined` precisa significar "não
   * mexe", não "apaga" — senão editar o endereço pela tela antiga zeraria o horário.
   */
  active: z.boolean().optional(),
  timezone: z.string().min(1).max(60).optional(),
  /**
   * Forma validada em `domain/openingHours.ts`, não aqui.
   *
   * O zod pararia na forma (`{ de, ate }` com texto); o que precisa de verificação é a
   * semântica — HH:MM em faixa, sobreposição no mesmo dia, início igual ao fim. Essa regra tem
   * teste próprio e mensagem que diz qual dia e qual intervalo está errado, o que um
   * `z.record` não daria.
   *
   * `null` explícito apaga o horário; `undefined` deixa como está.
   */
  openingHours: z.unknown().optional(),
});
export type StoreUpsertRequest = z.infer<typeof storeUpsertSchema>;

// ---------- Estoque por unidade ----------

export interface ProductStoreStockDto {
  storeId: string;
  storeName: string;
  city: string;
  state: string;
  quantity: number;
  active: boolean;
  /** `null` quando a unidade nunca foi preenchida para este produto. */
  updatedAt: Date | null;
}

/**
 * Define a disponibilidade de um produto nas unidades, em lote.
 *
 * Em lote, e não uma rota por unidade, porque a tela do lojista mostra todas as unidades juntas
 * e o gesto natural é "ajustar e salvar". Uma chamada por linha produziria estado meio salvo se
 * a terceira falhasse.
 */
export const productStoreStockSchema = z.object({
  items: z
    .array(
      z.object({
        storeId: z.string().uuid(),
        quantity: z.number().int().nonnegative(),
        active: z.boolean().default(true),
      })
    )
    .min(1)
    .max(200),
});
export type ProductStoreStockRequest = z.infer<typeof productStoreStockSchema>;

export interface CategoryDto {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

export const categoryUpsertSchema = z.object({
  name: z.string().min(1),
  active: z.boolean(),
  type: z.enum(['product', 'store']).default('product'),
});
export type CategoryUpsertRequest = z.infer<typeof categoryUpsertSchema>;

export interface CatalogQuery {
  category?: string;
  q?: string;
  city?: string;
  state?: string;
  partnerId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page: number;
  pageSize: number;
  /** Aditivos. Ausentes = comportamento de antes, sem filtro nenhum. */
  storeId?: string;
  openNow?: boolean;
}

export interface CatalogPage {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CatalogFiltersDto {
  categories: string[];
  cities: string[];
  states: string[];
  minPrice: number;
  maxPrice: number;
}
