import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { financeiroApi } from '@shared/api/endpoints';
import '../../admin/pages/AdminPages.css';

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

export function FinanceiroWithdrawalsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('pending');

  const q = useQuery({
    queryKey: ['financeiro-withdrawals', status],
    queryFn: () => financeiroApi.withdrawals(status || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['financeiro-withdrawals'] });

  const approve = useMutation({
    mutationFn: (id: string) => financeiroApi.approveWithdrawal(id),
    onSuccess: () => {
      invalidate();
      toast.success('Saque aprovado e debitado do saldo do afiliado.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao aprovar.'),
  });
  const reject = useMutation({
    mutationFn: (id: string) => financeiroApi.rejectWithdrawal(id),
    onSuccess: () => {
      invalidate();
      toast.success('Saque rejeitado.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao rejeitar.'),
  });

  const items = q.data ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Pedidos de saque</h2>
          <p className="text-muted">
            Aprovar debita o valor do saldo de comissão do afiliado — confirme
            que o pagamento (Pix, etc.) já foi feito por fora antes de aprovar.
          </p>
        </div>
        <div className="admin-filters__select">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pendentes</option>
            <option value="paid">Pagos</option>
            <option value="rejected">Rejeitados</option>
            <option value="">Todos</option>
          </select>
        </div>
      </header>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={items.length === 0}
          variant="list"
          emptyLabel="Nenhum pedido de saque."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Afiliado</th>
                <th>Valor</th>
                <th>Chave Pix</th>
                <th>Observação</th>
                <th>Solicitado em</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td>
                    <strong>{w.partnerName}</strong>
                  </td>
                  <td className="text-accent">{formatCurrency(w.amount)}</td>
                  <td>{w.pixKey ? `${w.pixKeyType}: ${w.pixKey}` : '—'}</td>
                  <td>{w.note || '—'}</td>
                  <td>{formatDateTime(w.requestedAt)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[w.status]}`}>
                      {STATUS_LABEL[w.status]}
                    </span>
                  </td>
                  <td>
                    {w.status === 'pending' && (
                      <div className="row">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(w.id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => reject.mutate(w.id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          Rejeitar
                        </Button>
                      </div>
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
