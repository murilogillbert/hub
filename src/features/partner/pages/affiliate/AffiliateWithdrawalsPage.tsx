import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { affiliateApi } from '@shared/api/endpoints';
import '../PartnerPages.css';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  paid: 'Pago',
};
const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-primary',
  rejected: 'badge-danger',
  paid: 'badge-accent',
};

export function AffiliateWithdrawalsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const withdrawalsQuery = useQuery({
    queryKey: ['affiliate-withdrawals'],
    queryFn: () => affiliateApi.withdrawals(),
  });

  const request = useMutation({
    mutationFn: () => affiliateApi.requestWithdrawal(Number(amount), note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['affiliate-withdrawals'] });
      qc.invalidateQueries({ queryKey: ['affiliate-me'] });
      setAmount('');
      setNote('');
      toast.success('Pedido de saque enviado — aguarde a aprovação do financeiro.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao solicitar saque.'),
  });

  const withdrawals = withdrawalsQuery.data ?? [];
  const balance = meQuery.data?.commissionBalance ?? 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    request.mutate();
  };

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Solicitar saque</h2>
          <p className="text-muted">
            Saldo disponível: <strong>{formatCurrency(balance)}</strong>. O
            financeiro aprova (ou rejeita) o pedido.
          </p>
        </div>
      </header>

      <Card>
        <form className="row" onSubmit={submit}>
          <Input
            label="Valor (R$)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
          />
          <Input
            label="Observação (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Chave Pix"
          />
          <Button type="submit" disabled={request.isPending}>
            {request.isPending ? 'Enviando...' : 'Solicitar saque'}
          </Button>
        </form>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={withdrawalsQuery.isLoading}
          error={withdrawalsQuery.error}
          empty={withdrawals.length === 0}
          variant="list"
          emptyLabel="Você ainda não solicitou nenhum saque."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Solicitado em</th>
                <th>Valor</th>
                <th>Observação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td>{formatDateTime(w.requestedAt)}</td>
                  <td className="text-accent">{formatCurrency(w.amount)}</td>
                  <td>{w.note || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[w.status]}`}>{STATUS_LABEL[w.status]}</span>
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
