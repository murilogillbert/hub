import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { Modal } from '@shared/components/Modal/Modal';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { financeiroApi } from '@shared/api/endpoints';
import '../../admin/pages/AdminPages.css';

export function FinanceiroAffiliatesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [adjustFor, setAdjustFor] = useState<{ id: string; name: string } | null>(null);
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [extractFor, setExtractFor] = useState<{ id: string; name: string } | null>(null);

  const q = useQuery({
    queryKey: ['financeiro-affiliates'],
    queryFn: () => financeiroApi.affiliates(),
  });

  const entriesQuery = useQuery({
    queryKey: ['financeiro-affiliate-entries', extractFor?.id],
    queryFn: () => financeiroApi.affiliateEntries(extractFor!.id),
    enabled: Boolean(extractFor),
  });

  const adjust = useMutation({
    mutationFn: () =>
      financeiroApi.adjustBalance(adjustFor!.id, { type, amount: Number(amount), description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financeiro-affiliates'] });
      qc.invalidateQueries({ queryKey: ['financeiro-affiliate-entries'] });
      toast.success('Saldo ajustado.');
      setAdjustFor(null);
      setAmount('');
      setDescription('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao ajustar saldo.'),
  });

  const items = q.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(amount) > 0) || !description.trim()) return;
    adjust.mutate();
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Afiliados</h2>
          <p className="text-muted">
            Ajuste manual do saldo de comissão (ex.: venda fechada por fora do
            fluxo automatizado).
          </p>
        </div>
      </header>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={items.length === 0}
          variant="list"
          emptyLabel="Nenhum afiliado cadastrado."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Afiliado</th>
                <th>Código do link</th>
                <th>Cliques / Leads / Vendas</th>
                <th>Saldo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.ownedByCompany && (
                      <>
                        {' '}
                        <span className="badge badge-primary">Conta da empresa</span>
                      </>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{p.referralCode ?? '—'}</td>
                  <td>
                    {p.linkViews} / {p.linkLeads} / {p.linkSales}
                  </td>
                  <td className="text-accent">{formatCurrency(p.commissionBalance)}</td>
                  <td>
                    <div className="row">
                      <Button size="sm" variant="secondary" onClick={() => setExtractFor(p)}>
                        Extrato
                      </Button>
                      <Button size="sm" onClick={() => setAdjustFor(p)}>
                        Ajustar saldo
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

      <Modal
        open={Boolean(adjustFor)}
        title={`Ajustar saldo — ${adjustFor?.name ?? ''}`}
        onClose={() => setAdjustFor(null)}
        closeDisabled={adjust.isPending}
      >
        <form className="stack" onSubmit={submit}>
          <div className="input-field">
            <label className="input-field__label">Tipo</label>
            <div className="input-field__box">
              <select
                className="input-field__el"
                value={type}
                onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
              >
                <option value="credit">Crédito (aumentar saldo)</option>
                <option value="debit">Débito (diminuir saldo)</option>
              </select>
            </div>
          </div>
          <Input
            label="Valor (R$)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
            required
          />
          <Input
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Comissão venda #123 fechada por telefone"
            required
          />
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending ? 'Salvando...' : 'Confirmar ajuste'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(extractFor)}
        title={`Extrato — ${extractFor?.name ?? ''}`}
        onClose={() => setExtractFor(null)}
      >
        <QueryState
          loading={entriesQuery.isLoading}
          error={entriesQuery.error}
          empty={(entriesQuery.data ?? []).length === 0}
          variant="list"
          emptyLabel="Sem lançamentos ainda."
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
              {(entriesQuery.data ?? []).map((e) => (
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
      </Modal>
    </div>
  );
}
