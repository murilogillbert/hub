import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { opendriverAdmin, type PayoutRow } from '../api';
import { errorText, Pagination, RequireOpenDriver } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

const statusLabel: Record<PayoutRow['status'], string> = { Pending: 'Pendente', Paid: 'Pago', Rejected: 'Recusado' };

/**
 * Saques de motoristas (RF12/RF14): faça o Pix para a chave mostrada e marque
 * como pago — o valor sai do saldo do motorista no mesmo instante.
 */
export function OpenDriverPayoutsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('Pending');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['od', 'payouts', status, page], queryFn: () => opendriverAdmin.payouts({ status: status || undefined, page }) });

  const resolve = useMutation({
    mutationFn: (v: { id: string; paid: boolean; note?: string }) => (v.paid ? opendriverAdmin.markPayoutPaid(v.id, v.note) : opendriverAdmin.rejectPayout(v.id, v.note ?? '')),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['od', 'payouts'] });
      qc.invalidateQueries({ queryKey: ['od', 'metrics'] });
      toast.success(v.paid ? 'Saque marcado como pago.' : 'Saque recusado; o valor volta ao saldo do motorista.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const markPaid = (p: PayoutRow) => {
    if (!window.confirm(`Confirma que o Pix de ${formatCurrency(p.amount)} para ${p.pixKey} já foi feito?`)) return;
    resolve.mutate({ id: p.id, paid: true });
  };
  const reject = (p: PayoutRow) => {
    const note = window.prompt('Motivo da recusa (o motorista verá):');
    if (!note || note.trim().length < 3) return;
    resolve.mutate({ id: p.id, paid: false, note: note.trim() });
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Saques de motoristas</h2>
          <p className="text-muted">Faça o Pix para a chave do pedido e depois marque como pago.</p>
        </div>
      </header>
      <RequireOpenDriver>
        <div className="admin-filters">
          <div className="admin-filters__select">
            <label htmlFor="od-payout-status">Situação</label>
            <select
              id="od-payout-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="Pending">Pendentes</option>
              <option value="Paid">Pagos</option>
              <option value="Rejected">Recusados</option>
              <option value="">Todos</option>
            </select>
          </div>
        </div>
        <Card padded={false}>
          <QueryState loading={q.isLoading} error={q.error} empty={q.data?.items.length === 0} variant="list" emptyLabel="Nenhum saque.">
            <table className="history__table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Motorista</th>
                  <th>Chave Pix</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data?.items.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.requestedAt)}</td>
                    <td>
                      <strong>{p.driverName}</strong>
                      <small className="text-muted" style={{ display: 'block' }}>
                        {p.driverEmail}
                      </small>
                    </td>
                    <td>
                      <code>{p.pixKey}</code> <small className="text-muted">({p.pixKeyType})</small>
                    </td>
                    <td className="text-accent">{formatCurrency(p.amount)}</td>
                    <td>
                      {statusLabel[p.status]}
                      {p.note ? <small className="text-muted" style={{ display: 'block' }}>{p.note}</small> : null}
                    </td>
                    <td>
                      {p.status === 'Pending' ? (
                        <div className="od-actions">
                          <Button size="sm" disabled={resolve.isPending} onClick={() => markPaid(p)}>
                            Marcar pago
                          </Button>
                          <Button size="sm" variant="ghost" disabled={resolve.isPending} onClick={() => reject(p)}>
                            Recusar
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </QueryState>
        </Card>
        {q.data ? <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} /> : null}
      </RequireOpenDriver>
    </div>
  );
}
