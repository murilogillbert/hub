/**
 * Cliente HTTP central. Injeta JWT, trata 401 (refresh→logout) e
 * desembrulha o envelope { data } da API .NET.
 */

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';

/** Origem do servidor (sem /api/v1) — usada para servir /uploads. */
export const SERVER_ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, '');

/** Resolve URL de imagem: caminhos /uploads viram absolutos; URLs externas passam direto. */
export function resolveImageUrl(url?: string): string {
  if (!url) return '';
  return url.startsWith('/uploads') ? `${SERVER_ORIGIN}${url}` : url;
}

const TOKEN_KEY = 'odh.token';
const REFRESH_KEY = 'odh.refresh';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (token: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

async function rawRequest<T>(
  path: string,
  opts: RequestOptions,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  // 401 em requisição autenticada: tenta refresh; se não houver/falhar,
  // limpa a sessão (dispara redirect p/ login via guards). Requisições
  // públicas (login/cadastro) não disparam logout global.
  if (res.status === 401 && opts.auth !== false) {
    if (retry && tokenStore.getRefresh()) {
      const refreshed = await tryRefresh();
      if (refreshed) return rawRequest<T>(path, opts, false);
    }
    onUnauthorized?.();
    throw new ApiError('Sessão expirada. Faça login novamente.', 401);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error ?? `Erro ${res.status}`, res.status);
  }
  return (json?.data ?? json) as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const refreshToken = tokenStore.getRefresh();
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    tokenStore.set(json.data.token, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    rawRequest<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => rawRequest<T>(path, { method: 'DELETE' }),
  postPublic: <T>(path: string, body?: unknown) =>
    rawRequest<T>(path, { method: 'POST', body, auth: false }),
};
