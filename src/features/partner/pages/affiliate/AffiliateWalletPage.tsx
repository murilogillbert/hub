import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { affiliateApi } from '@shared/api/endpoints';
import '../PartnerPages.css';

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
