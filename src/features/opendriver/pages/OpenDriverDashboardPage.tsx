import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { formatCurrency } from '@shared/utils/formatters';
import { opendriverAdmin } from '../api';
import { RequireOpenDriver } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

/** Visão geral do OpenDriver (RF17): o que precisa de atenção agora. */
export function OpenDriverDashboardPage() {
  const q = useQuery({ queryKey: ['od', 'metrics'], queryFn: () => opendriverAdmin.metrics(), refetchInterval: 30_000 });
  const m = q.data;
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>OpenDriver — corridas</h2>
          <p className="text-muted">Operação do app de corridas. Atualiza a cada 30 segundos.</p>
        </div>
      </header>
      <RequireOpenDriver>
        <QueryState loading={q.isLoading} error={q.error} variant="cards">
          {m ? (
            <>
              <div className="admin-page__stats">
                <StatCard label="Corridas hoje" value={String(m.ridesToday)} hint={`${m.activeRides} em andamento`} />
                <StatCard label="Motoristas online" value={String(m.driversOnline)} />
                <StatCard label="Faturamento 7 dias" value={formatCurrency(m.last7Days.gmv)} hint={`Receita da plataforma ${formatCurrency(m.last7Days.platformRevenue)}`} />
                <StatCard
                  label="Conclusão 7 dias"
                  value={`${m.last7Days.completionRate.toFixed(1).replace('.', ',')}%`}
                  hint={`${m.last7Days.completed} concluídas · ${m.last7Days.cancelled} canceladas · ${m.last7Days.noDrivers} sem motorista`}
                />
              </div>
              <div className="admin-page__stats">
                <Link to="/admin/opendriver/motoristas?status=InReview">
                  <StatCard label="Cadastros para analisar" value={String(m.driversInReview)} hint={`${m.vehiclesInReview} veículo(s) em análise`} />
                </Link>
                <Link to="/admin/opendriver/saques">
                  <StatCard label="Saques pendentes" value={String(m.pendingPayouts.count)} hint={formatCurrency(m.pendingPayouts.amount)} />
                </Link>
                <Link to="/admin/opendriver/seguranca">
                  <StatCard label="Ocorrências abertas" value={String(m.openIncidents)} />
                </Link>
                <Link to="/admin/opendriver/corridas">
                  <StatCard label="Pagamentos com falha" value={String(m.failedPayments)} />
                </Link>
              </div>
            </>
          ) : null}
        </QueryState>
      </RequireOpenDriver>
    </div>
  );
}
