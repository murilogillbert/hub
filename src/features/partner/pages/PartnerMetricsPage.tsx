import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { Card } from '@shared/components/Card/Card';
import { BarChart } from '@shared/components/BarChart/BarChart';
import { MetricList } from '@shared/components/MetricList/MetricList';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCurrency, formatPercent } from '@shared/utils/formatters';
import { partnerApi } from '@shared/api/endpoints';
import './PartnerPages.css';

export function PartnerMetricsPage() {
  const metricsQuery = useQuery({
    queryKey: ['partner-metrics'],
    queryFn: () => partnerApi.metrics(),
  });
  const m = metricsQuery.data;

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Métricas e valores a receber</h2>
          <p className="text-muted">
            Vendas, ticket médio, cashback e o que o OpenDriverHub tem a te
            repassar (repasse centralizado).
          </p>
        </div>
      </header>

      <QueryState
        loading={metricsQuery.isLoading}
        error={metricsQuery.error}
        empty={!m}
      >
        {m && (
          <>
            <div className="partner-page__stats">
              <StatCard
                label="Receita (pago + resgatado)"
                value={formatCurrency(m.totalRevenue)}
                hint={`${m.totalSales} venda(s)`}
              />
              <StatCard
                label="Ticket médio"
                value={formatCurrency(m.averageTicket)}
                hint={`${m.uniqueCustomers} cliente(s) único(s)`}
              />
              <StatCard
                label="A receber"
                value={formatCurrency(m.pendingTransfer)}
                hint="resgatado, aguardando repasse (10 dias)"
              />
              <StatCard
                label="Recebido"
                value={formatCurrency(m.paidTransfer)}
                hint="já creditado a você"
              />
              <StatCard
                label="Cashback concedido"
                value={formatCurrency(m.cashbackGranted)}
                hint="creditado aos clientes"
              />
              <StatCard
                label="Taxa de resgate"
                value={formatPercent(m.redemptionRate)}
                hint={`${m.redeemedCount} resgatados / ${m.paidCount} pagos`}
              />
            </div>

            <div className="partner-page__charts">
              <Card>
                <h3>Funil de pedidos</h3>
                <MetricList
                  items={[
                    { name: 'Aguardando pagamento', value: 0, count: m.pendingCount },
                    { name: 'Pagos (a resgatar)', value: 0, count: m.paidCount },
                    { name: 'Resgatados', value: 0, count: m.redeemedCount },
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

            <div className="partner-page__charts">
              <Card>
                <h3>Receita nos últimos 7 dias</h3>
                <BarChart
                  data={m.revenueLastDays}
                  formatValue={(v) => formatCurrency(v)}
                  accent="var(--color-primary)"
                />
              </Card>
              <Card>
                <h3>Movimento por horário</h3>
                {m.salesByHour.length > 0 ? (
                  <BarChart data={m.salesByHour} accent="var(--color-accent)" />
                ) : (
                  <p className="text-soft">Sem vendas registradas por hora.</p>
                )}
              </Card>
            </div>

            <div className="partner-page__charts">
              <Card>
                <h3>Top produtos por receita</h3>
                <MetricList
                  items={m.topProducts}
                  formatValue={formatCurrency}
                  accent="var(--color-primary)"
                />
              </Card>
              <Card>
                <h3>Vendas por categoria</h3>
                <MetricList
                  items={m.salesByCategory}
                  formatValue={formatCurrency}
                  accent="var(--color-info)"
                />
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
