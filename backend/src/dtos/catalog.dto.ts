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
  stock: number;
  digital: boolean;
  cities: string[];
  states: string[];
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
  city: string;
  state: string;
  lat: number;
  lng: number;
  asaasWalletId: string | null;
}

export const partnerUpsertSchema = z.object({
  name: z.string().min(1),
  segment: z.string().min(1),
  logoUrl: z.string().default(''),
  feePercent: z.number().min(0).max(100),
  active: z.boolean(),
  cnpj: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  asaasWalletId: z.string().optional().nullable(),
});
export type PartnerUpsertRequest = z.infer<typeof partnerUpsertSchema>;

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
});
export type StoreUpsertRequest = z.infer<typeof storeUpsertSchema>;

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
