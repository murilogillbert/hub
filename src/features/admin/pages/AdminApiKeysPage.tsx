import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime } from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

const SCOPES = [
  { value: 'affiliate:read', label: 'Consultar afiliados' },
  { value: 'affiliate:write', label: 'Registrar eventos de link (lead/venda)' },
];

/** Chaves de API para integrações servidor-a-servidor (n8n, energia-solar-api,
 * ...) chamando /api/v1/service/*. */
export function AdminApiKeysPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>(['affiliate:read']);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin-service-api-keys'],
    queryFn: () => adminApi.serviceApiKeys(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-service-api-keys'] });

  const create = useMutation({
    mutationFn: () => adminApi.createServiceApiKey({ label, scopes }),
    onSuccess: (dto) => {
      setJustCreated(dto.key);
      setLabel('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao criar chave.'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeServiceApiKey(id),
    onSuccess: () => {
      invalidate();
      toast.success('Chave revogada.');
    },
  });

  const items = q.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim() || scopes.length === 0) return;
    create.mutate();
  };

  const toggleScope = (value: string) =>
    setScopes((s) => (s.includes(value) ? s.filter((x) => x !== value) : [...s, value]));

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Chaves de API de serviço</h2>
          <p className="text-muted">
            Usadas por integrações externas (energia-solar-api, n8n, ...) para
            consultar afiliados e registrar leads/vendas via{' '}
            <code>Authorization: Bearer &lt;chave&gt;</code>.
          </p>
        </div>
      </header>

      {justCreated && (
        <Card className="admin-success-banner">
          <strong>Chave criada — copie agora, ela não será mostrada de novo:</strong>
          <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', margin: 'var(--space-2) 0' }}>
            {justCreated}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setJustCreated(null)}>
            Já copiei, fechar
          </Button>
        </Card>
      )}

      <Card>
        <form className="stack" onSubmit={submit}>
          <Input
            label="Nome da integração"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: energia-solar-api"
          />
          <div className="input-field">
            <label className="input-field__label">Permissões</label>
            <div className="row">
              {SCOPES.map((s) => (
                <label key={s.value} className="row" style={{ gap: 'var(--space-1)' }}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(s.value)}
                    onChange={() => toggleScope(s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={create.isPending || !label.trim() || scopes.length === 0}>
            {create.isPending ? 'Criando...' : 'Criar chave'}
          </Button>
        </form>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={items.length === 0}
          variant="list"
          emptyLabel="Nenhuma chave criada."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Integração</th>
                <th>Prefixo</th>
                <th>Permissões</th>
                <th>Último uso</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((k) => (
                <tr key={k.id}>
                  <td>
                    <strong>{k.label}</strong>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{k.keyPreview}</td>
                  <td>{k.scopes.join(', ')}</td>
                  <td>{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : '—'}</td>
                  <td>
                    <span className={`badge ${k.active ? 'badge-accent' : 'badge-danger'}`}>
                      {k.active ? 'Ativa' : 'Revogada'}
                    </span>
                  </td>
                  <td>
                    {k.active && (
                      <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}>
                        Revogar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
