import { ReactNode, useEffect, useRef, useState } from 'react';
import { Card } from '@shared/components/Card/Card';
import { opendriverConfigured } from '../api';

/** Aviso quando o painel não sabe onde está a API do OpenDriver. */
export function RequireOpenDriver({ children }: { children: ReactNode }) {
  if (opendriverConfigured) return <>{children}</>;
  return (
    <Card>
      <h3>API do OpenDriver não configurada</h3>
      <p className="text-muted">
        Defina <code>VITE_OPENDRIVER_API_URL</code> no build do painel (ex.: https://api-app.opendriver.com.br) e inclua a
        origem deste painel em <code>CORS_ORIGINS</code> da API do OpenDriver.
      </p>
    </Card>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Próxima
      </button>
    </div>
  );
}

/** Imagem/áudio privado: baixa com o token e libera o blob ao sair. `key` identifica o arquivo. */
export function usePrivateBlob(key: string | null, load: () => Promise<string>) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    if (!key) return;
    setUrl(null);
    setError(null);
    const load = loadRef.current;
    let alive = true;
    let created: string | null = null;
    load()
      .then((u) => {
        created = u;
        if (alive) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.'));
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [key]);
  return { url, error };
}

export function PrivateImage({ fileKey, load, alt }: { fileKey: string; load: () => Promise<string>; alt: string }) {
  const { url, error } = usePrivateBlob(fileKey, load);
  if (error) return <p className="text-muted">{error}</p>;
  if (!url) return <p className="text-muted">Carregando…</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className="od-doc" />
    </a>
  );
}

export const errorText = (e: unknown, fallback = 'Não foi possível concluir.') => (e instanceof Error ? e.message : fallback);
