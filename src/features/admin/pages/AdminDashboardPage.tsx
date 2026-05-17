import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { Card } from '@shared/components/Card/Card';
import { BarChart } from '@shared/components/BarChart/BarChart';
import { MetricList } from '@shared/components/MetricList/MetricList';
import { QueryState } from '@shared/components/QueryState/QueryState';
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
} from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

export function AdminDashboardPage() {
  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => adminApi.metrics(),
  });
  const salesQuery = useQuery({
    queryKey: ['admin-sales', 'recent'],
    queryFn: () => adminApi.sales({ page: 1, pageSize: 5 }),
  });

  const m = metricsQuery.data;
  const latestOrders = salesQuery.data?.items ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Visão geral da plataforma</h2>
          <p className="text-muted">Indicadores em tempo real (banco SQL).</p>
        </div>
        <span className="badge badge-primary">
          Hoje · {new Date().toLocaleDateString('pt-BR')}
        </span>
      </header>

      <QueryState
        loading={metricsQuery.isLoading}
        error={metricsQuery.error}
        empty={!m}
      >
        {m && (
          <>
            <div className="admin-page__stats">
              <StatCard
                label="GMV (vendas brutas)"
                value={formatCurrency(m.gmv)}
                hint={`${m.ordersToday} pedido(s) hoje`}
              />
              <StatCard
                label="Receita líquida"
                value={formatCurrency(m.netRevenue)}
                hint="taxa OpenDriverHub − cashback"
              />
              <StatCard
                label="Ticket médio"
                value={formatCurrency(m.averageTicket)}
              />
              <StatCard
                label="Cashback em aberto"
                value={formatCurrency(m.cashbackOutstanding)}
                hint="passivo a abater (saldo dos clientes)"
              />
              <StatCard
                label="Clientes"
                value={m.customers.toLocaleString('pt-BR')}
                hint={`+${m.newCustomers30d} nos últimos 30 dias`}
              />
              <StatCard
                label="Parceiros ativos"
                value={`${m.activePartners}/${m.partners}`}
              />
              <StatCard
                label="Conversão de pagamento"
                value={formatPercent(m.paymentConversion)}
                hint="pagos / (pagos + cancelados)"
              />
              <StatCard
                label="Taxa de resgate"
                value={formatPercent(m.redemptionRate)}
                hint={`${m.redeemedCount} resgatados`}
              />
            </div>

            <div className="admin-page__charts">
              <Card>
                <h3>Receita líquida por mês</h3>
                <BarChart
                  data={m.revenueByMonth}
                  formatValue={(v) => formatCurrency(v)}
                  accent="var(--color-primary)"
                />
              </Card>
              <Card>
                <h3>Top parceiros por receita</h3>
                <ul className="admin-toplist">
                  {m.topPartners.map((p, idx) => (
                    <li key={p.partnerId}>
                      <span className="admin-toplist__rank">{idx + 1}</span>
                      <strong>{p.partnerName}</strong>
                      <span className="admin-toplist__value">
                        {formatCurrency(p.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="admin-page__charts">
              <Card>
                <h3>Funil de pedidos</h3>
                <MetricList
                  items={[
                    { name: 'Aguardando pagamento', value: 0, count: m.pendingCount },
                    { name: 'Pagos', value: 0, count: m.paidCount },
                    { name: 'Resgatados', value: 0, count: m.redeemedCount },
                    { name: 'Cancelados', value: 0, count: m.cancelledCount },
                  ]}
                  accent="var(--color-warning)"
                />
              </Card>
              <Card>
                <h3>Métodos de pagamento</h3>
                <MetricList
                  items={m.paymentMethods}
                  formatValue={formatCurrency}
                  accent="var(--color-accent)"
                />
              </Card>
            </div>

            <div className="admin-page__charts">
              <Card>
                <h3>Vendas por categoria</h3>
                <MetricList
                  items={m.salesByCategory}
                  formatValue={formatCurrency}
                  accent="var(--color-info)"
                />
              </Card>
              <Card>
                <h3>Leads do bot por temperatura</h3>
                <MetricList
                  items={m.leadsByTemperature}
                  accent="var(--color-primary)"
                />
              </Card>
            </div>
          </>
        )}
      </QueryState>

      <Card padded={false}>
        <header style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <h3>Últimas transações</h3>
        </header>
        <QueryState
          loading={salesQuery.isLoading}
          error={salesQuery.error}
          empty={latestOrders.length === 0}
          emptyLabel="Sem transações."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Parceiro</th>
                <th>Produto</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {latestOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.code.slice(0, 9)}…</code>
                  </td>
                  <td>{o.customerName}</td>
                  <td>{o.partnerName}</td>
                  <td>{o.productTitle}</td>
                  <td>{formatDateTime(o.createdAt)}</td>
                  <td>{formatCurrency(o.paidPrice)}</td>
                  <td>
                    <span
                      className={`badge ${
                        o.status === 'redeemed' ? 'badge-accent' : 'badge-primary'
                      }`}
                    >
                      {o.status}
                    </span>
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
