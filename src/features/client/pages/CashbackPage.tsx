import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { ordersApi } from '@shared/api/endpoints';
import { formatCode, formatCurrency, formatDateTime } from '@shared/utils/formatters';
import './ClientArea.css';

export function CashbackPage() {
  const entriesQuery = useQuery({
    queryKey: ['cashback-entries'],
    queryFn: () => ordersApi.cashbackEntries(),
  });

  const entries = entriesQuery.data ?? [];
  const earned = entries
    .filter((entry) => entry.type === 'earned')
    .reduce((acc, entry) => acc + entry.amount, 0);
  const used = entries
    .filter((entry) => entry.type === 'used')
    .reduce((acc, entry) => acc + entry.amount, 0);

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Meu cashback</h2>
          <p className="text-muted">
            Entradas e usos do saldo gerado nas compras.
          </p>
        </div>
      </header>

      <div className="history__stats">
        <Card>
          <small className="text-muted">Ganho registrado</small>
          <strong className="history__stat text-accent">
            {formatCurrency(earned)}
          </strong>
        </Card>
        <Card>
          <small className="text-muted">Usado em compras</small>
          <strong className="history__stat">{formatCurrency(used)}</strong>
        </Card>
        <Card>
          <small className="text-muted">Movimentacoes</small>
          <strong className="history__stat">{entries.length}</strong>
        </Card>
      </div>

      <Card padded={false}>
        <QueryState
          loading={entriesQuery.isLoading}
          error={entriesQuery.error}
          empty={entries.length === 0}
          emptyLabel="Ainda nao ha movimentacoes de cashback."
          variant="list"
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Pedido</th>
                <th>Descricao</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>
                    <span
                      className={`badge ${
                        entry.type === 'earned' ? 'badge-accent' : 'badge-warning'
                      }`}
                    >
                      {entry.type === 'earned' ? 'Ganho' : 'Uso'}
                    </span>
                  </td>
                  <td>
                    {entry.orderId ? (
                      <Link to={`/meus-itens/${entry.orderId}`}>
                        {entry.orderCode ? formatCode(entry.orderCode) : 'Ver pedido'}
                      </Link>
                    ) : (
                      'Sem pedido'
                    )}
                  </td>
                  <td>{entry.description}</td>
                  <td
                    className={
                      entry.type === 'earned' ? 'text-accent' : 'cashback-entry__used'
                    }
                  >
                    {entry.type === 'earned' ? '+' : '-'}
                    {formatCurrency(entry.amount)}
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
