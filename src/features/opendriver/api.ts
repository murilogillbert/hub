/**
 * Cliente da API do OpenDriver (app de corridas) para as telas de
 * administração. Mesmo banco e mesmo JWT do hub: o token do admin logado
 * aqui vale lá. Base: VITE_OPENDRIVER_API_URL (ex.: https://api-app.opendriver.com.br).
 */
import { api as hubApi, ApiError, tokenStore } from '@shared/api/client';

const ORIGIN = (import.meta.env.VITE_OPENDRIVER_API_URL ?? '').replace(/\/+$/, '');
const BASE = `${ORIGIN}/api/v1/admin`;

export const opendriverConfigured = ORIGIN.length > 0;

async function send(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  if (!opendriverConfigured) throw new ApiError('API do OpenDriver não configurada (VITE_OPENDRIVER_API_URL).', 0);
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && tokenStore.getRefresh()) {
    // Uma chamada autenticada ao hub renova o token (ou encerra a sessão).
    await hubApi.get('/auth/me').catch(() => undefined);
    return send(path, init, false);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.error ?? 'Não foi possível concluir. Tente novamente.', res.status);
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  const body = await res.json();
  return (body?.data ?? body) as T;
}

/** Arquivo privado (documento, gravação) decifrado pela API → URL local (blob). */
async function blobUrl(path: string): Promise<string> {
  const res = await send(path);
  return URL.createObjectURL(await res.blob());
}

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v !== undefined && v !== '' && s.set(k, String(v)));
  const out = s.toString();
  return out ? `?${out}` : '';
};

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type DriverStatus = 'PendingDocuments' | 'InReview' | 'Approved' | 'Rejected' | 'Suspended';
export type RideStatus = 'Searching' | 'DriverAssigned' | 'DriverArrived' | 'InProgress' | 'Completed' | 'Cancelled' | 'NoDrivers';

export interface Metrics {
  ridesToday: number;
  activeRides: number;
  last7Days: { completed: number; cancelled: number; noDrivers: number; completionRate: number; gmv: number; platformRevenue: number };
  driversOnline: number;
  driversInReview: number;
  vehiclesInReview: number;
  failedPayments: number;
  openIncidents: number;
  pendingPayouts: { count: number; amount: number };
}

export interface DriverRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: DriverStatus;
  isOnline: boolean;
  rating: number | null;
  updatedAt: string;
}

export interface VehicleRow {
  id: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: number;
  category: 'Economy' | 'Comfort';
  status: 'InReview' | 'Approved' | 'Rejected';
  active: boolean;
  hasCrlv: boolean;
  rejectionReason: string | null;
}

export interface DriverDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  status: DriverStatus;
  rejectionReason: string | null;
  cnhNumber: string | null;
  cnhCategory: string | null;
  cnhExpiresAt: string | null;
  birthDate: string | null;
  hasCnhPhoto: boolean;
  hasSelfie: boolean;
  pixKey: string | null;
  pixKeyType: string | null;
  isOnline: boolean;
  completedRides: number;
  balance: number;
  rating: number | null;
  vehicles: VehicleRow[];
}

export interface RideRow {
  id: string;
  status: RideStatus;
  paymentStatus: string;
  category: string;
  passenger: string;
  driver: string | null;
  origin: string;
  destination: string;
  fare: number;
  requestedAt: string;
  completedAt: string | null;
}

export interface RideDetail {
  ride: {
    id: string;
    status: RideStatus;
    category: string;
    origin: { address: string };
    destination: { address: string };
    distanceM: number;
    durationS: number;
    fare: number;
    platformFee: number;
    driverEarning: number;
    cashbackUsed: number;
    cancellationFee: number;
    payment: { status: string; methodType: string; label: string; failureReason: string | null };
    passengerName: string;
    driverName: string | null;
    requestedAt: string;
  };
  events: { type: string; actor: string; at: string; payload: unknown }[];
  offers: { driverId: string; status: string; etaS: number; sentAt: string }[];
  payments: { id: string; provider: string; method: string; amount: number; status: string; externalId: string | null; detail: string | null; at: string }[];
  incidents: { id: string; type: string; status: string; description: string | null; at: string }[];
  recordings: { id: string; sizeBytes: number; expiresAt: string; deleted: boolean }[];
}

export interface PayoutRow {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  status: 'Pending' | 'Paid' | 'Rejected';
  note: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface Pricing {
  category: 'Economy' | 'Comfort';
  label: string;
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  platformFeePercent: number;
  cancellationFee: number;
  active: boolean;
  updatedAt: string;
}

export interface IncidentRow {
  id: string;
  rideId: string | null;
  type: 'Emergency' | 'Report';
  status: 'Open' | 'InReview' | 'Closed';
  description: string | null;
  reporter: string;
  reporterPhone: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

const post = <T>(path: string, body?: unknown) => json<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const opendriverAdmin = {
  metrics: () => json<Metrics>('/metrics'),
  drivers: (p: { status?: string; q?: string; page?: number }) => json<Page<DriverRow>>(`/drivers${qs({ ...p, pageSize: 20 })}`),
  driver: (id: string) => json<DriverDetail>(`/drivers/${id}`),
  driverDocument: (id: string, kind: 'cnh' | 'selfie') => blobUrl(`/drivers/${id}/documents/${kind}`),
  approveDriver: (id: string) => post<DriverDetail>(`/drivers/${id}/approve`),
  rejectDriver: (id: string, reason: string) => post<DriverDetail>(`/drivers/${id}/reject`, { reason }),
  suspendDriver: (id: string, reason: string) => post<DriverDetail>(`/drivers/${id}/suspend`, { reason }),
  reactivateDriver: (id: string) => post<DriverDetail>(`/drivers/${id}/reactivate`),
  vehicleCrlv: (id: string) => blobUrl(`/vehicles/${id}/crlv`),
  approveVehicle: (id: string) => post<DriverDetail>(`/vehicles/${id}/approve`),
  rejectVehicle: (id: string, reason: string) => post<DriverDetail>(`/vehicles/${id}/reject`, { reason }),
  rides: (p: { status?: string; page?: number }) => json<Page<RideRow>>(`/rides${qs({ ...p, pageSize: 20 })}`),
  ride: (id: string) => json<RideDetail>(`/rides/${id}`),
  cancelRide: (id: string, reason: string) => post<RideDetail>(`/rides/${id}/cancel`, { reason }),
  payouts: (p: { status?: string; page?: number }) => json<Page<PayoutRow>>(`/payouts${qs({ ...p, pageSize: 30 })}`),
  markPayoutPaid: (id: string, note?: string) => post<{ id: string }>(`/payouts/${id}/paid`, { note }),
  rejectPayout: (id: string, note: string) => post<{ id: string }>(`/payouts/${id}/reject`, { note }),
  pricing: () => json<Pricing[]>('/pricing'),
  updatePricing: (category: string, body: Omit<Pricing, 'category' | 'updatedAt'>) =>
    json<Pricing[]>(`/pricing/${category}`, { method: 'PUT', body: JSON.stringify(body) }),
  incidents: (p: { status?: string; page?: number }) => json<Page<IncidentRow>>(`/incidents${qs({ ...p, pageSize: 30 })}`),
  setIncidentStatus: (id: string, status: IncidentRow['status']) => json<{ id: string }>(`/incidents/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  recording: (id: string) => blobUrl(`/recordings/${id}`),
};

export const driverStatusLabel: Record<DriverStatus, string> = {
  PendingDocuments: 'Cadastro incompleto',
  InReview: 'Em análise',
  Approved: 'Aprovado',
  Rejected: 'Recusado',
  Suspended: 'Suspenso',
};

export const rideStatusLabel: Record<RideStatus, string> = {
  Searching: 'Procurando',
  DriverAssigned: 'A caminho',
  DriverArrived: 'Motorista chegou',
  InProgress: 'Em viagem',
  Completed: 'Concluída',
  Cancelled: 'Cancelada',
  NoDrivers: 'Sem motorista',
};
