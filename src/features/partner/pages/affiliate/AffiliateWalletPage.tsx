import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { affiliateApi, PixKeyType } from '@shared/api/endpoints';
import '../PartnerPages.css';

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'Email', label: 'E-mail' },
  { value: 'Phone', label: 'Telefone' },
  { value: 'Random', label: 'Chave aleatória' },
];

function PixKeyCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const [editing, setEditing] = useState(false);
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');

  useEffect(() => {
    if (meQuery.data?.pixKey) {
      setPixKey(meQuery.data.pixKey);
      setPixKeyType(meQuery.data.pixKeyType ?? 'CPF');
    }
  }, [meQuery.data]);

  const mutation = useMutation({
    mutationFn: () => affiliateApi.updatePixKey(pixKey.trim(), pixKeyType),
    onSuccess: () => {
      toast.success('Chave Pix salva.');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['affiliate-me'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao salvar chave Pix.'),
  });

  const hasSavedKey = !!meQuery.data?.pixKey;

  return (
    <Card>
      <h3>Dados de pagamento</h3>
      <p className="text-muted">
        Chave Pix usada por padrão em todo saque. Dá pra usar outra só numa
        solicitação específica na hora de pedir o saque.
      </p>
      {!editing ? (
        <div className="row-between" style={{ marginTop: 12 }}>
          <span>
            {hasSavedKey ? (
              <>
                <strong>{meQuery.data?.pixKeyType}:</strong> {meQuery.data?.pixKey}
              </>
            ) : (
              'Nenhuma chave Pix cadastrada ainda.'
            )}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {hasSavedKey ? 'Alterar' : 'Cadastrar'}
          </Button>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <div className="input-field" style={{ maxWidth: 200 }}>
              <label className="input-field__label">Tipo de chave</label>
              <div className="input-field__box">
                <select
                  className="input-field__el"
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
                >
                  {PIX_KEY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Input label="Chave Pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required />
          </div>
          <div className="row">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !pixKey.trim()}
            >
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function AffiliateWalletPage() {
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const entriesQuery = useQuery({ queryKey: ['affiliate-entries'], queryFn: () => affiliateApi.entries() });

  const entries = entriesQuery.data ?? [];

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Minha carteira</h2>
          <p className="text-muted">Saldo de comissão e extrato de lançamentos.</p>
        </div>
      </header>

      <div className="partner-page__stats">
        <StatCard
          label="Saldo disponível"
          value={meQuery.data ? formatCurrency(meQuery.data.commissionBalance) : '—'}
        />
      </div>

      <PixKeyCard />

      <Card padded={false}>
        <QueryState
          loading={entriesQuery.isLoading}
          error={entriesQuery.error}
          empty={entries.length === 0}
          variant="list"
          emptyLabel="Nenhum lançamento ainda."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTime(e.createdAt)}</td>
                  <td>
                    <span className={`badge ${e.type === 'credit' ? 'badge-accent' : 'badge-danger'}`}>
                      {e.type === 'credit' ? 'Crédito' : 'Débito'}
                    </span>
                  </td>
                  <td className="text-accent">{formatCurrency(e.amount)}</td>
                  <td>{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
