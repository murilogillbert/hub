import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { adminApi } from '@shared/api/endpoints';
import { formatCurrency } from '@shared/utils/formatters';
import './AdminPages.css';

/** Repasse manual de saldo devedor de motorista — duas fontes independentes:
 * comissão do programa de afiliação loja↔motorista (DriverCommissionEntry) e
 * recompensa da pesquisa de opinião (SurveyLead.rewardAmount). "Marcar pago"
 * lança o repasse pelo valor devedor inteiro (zera) e desconta o mesmo valor
 * do cashbackBalance do motorista — ele foi pago por fora (Pix), não pode
 * também gastar esse valor no app. */
export function AdminDriverPayoutsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ['driver-payout-summary'],
    queryFn: () => adminApi.driverPayoutSummary(),
  });
  const historyQuery = useQuery({
    queryKey: ['driver-payouts'],
    queryFn: () => adminApi.driverPayouts({ pageSize: 50 }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['driver-payout-summary'] });
    qc.invalidateQueries({ queryKey: ['driver-payouts'] });
  };

  const markPaid = useMutation({
    mutationFn: (vars: { driverId: string; source: 'DriverCommission' | 'SurveyReward' }) =>
      adminApi.markDriverRewardPaid(vars.driverId, { source: vars.source }),
    onSuccess: () => {
      invalidate();
      toast.success('Saldo marcado como pago.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao marcar como pago.'),
  });

  const summary = summaryQuery.data ?? [];
  const history = historyQuery.data?.items ?? [];

  const sourceLabel = (s: string) => (s === 'DriverCommission' ? 'Comissão de indicação' : 'Pesquisa de opinião');

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Pagamentos de motoristas</h2>
          <p className="text-muted">
            Saldo devedor de comissão de afiliação (loja↔motorista) e de
            recompensa da pesquisa de opinião — pago por fora (Pix). Marcar
            como pago lança o repasse e desconta o valor do saldo de cashback
            do motorista, pra não pagar em dobro.
          </p>
        </div>
      </header>

      <Card padded={false}>
        <QueryState
          loading={summaryQuery.isLoading}
          error={summaryQuery.error}
          empty={summary.length === 0}
          variant="list"
          emptyLabel="Nenhum motorista com comissão ou recompensa ainda."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Comissão ganha</th>
                <th>Comissão paga</th>
                <th>Comissão devida</th>
                <th />
                <th>Pesquisa ganha</th>
                <th>Pesquisa paga</th>
                <th>Pesquisa devida</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.driverId}>
                  <td>
                    <strong>{s.driverName}</strong>
                    <small className="text-muted" style={{ display: 'block' }}>{s.driverEmail}</small>
                  </td>
                  <td>{formatCurrency(s.commissionEarned)}</td>
                  <td>{formatCurrency(s.commissionPaid)}</td>
                  <td className="text-accent">{formatCurrency(s.commissionOwed)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={s.commissionOwed <= 0 || markPaid.isPending}
                      onClick={() => markPaid.mutate({ driverId: s.driverId, source: 'DriverCommission' })}
                    >
                      Marcar pago
                    </Button>
                  </td>
                  <td>{formatCurrency(s.surveyEarned)}</td>
                  <td>{formatCurrency(s.surveyPaid)}</td>
                  <td className="text-accent">{formatCurrency(s.surveyOwed)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={s.surveyOwed <= 0 || markPaid.isPending}
                      onClick={() => markPaid.mutate({ driverId: s.driverId, source: 'SurveyReward' })}
                    >
                      Marcar pago
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={historyQuery.isLoading}
          error={historyQuery.error}
          empty={history.length === 0}
          variant="list"
          emptyLabel="Nenhum repasse lançado ainda."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Motorista</th>
                <th>Fonte</th>
                <th>Valor</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>{p.driverName}</td>
                  <td>{sourceLabel(p.source)}</td>
                  <td className="text-accent">{formatCurrency(p.amount)}</td>
                  <td>{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
