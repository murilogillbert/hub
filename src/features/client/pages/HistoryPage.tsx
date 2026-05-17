import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@shared/components/Card/Card';
import { QueryState } from '@shared/components/QueryState/QueryState';
import {
  formatCode,
  formatCurrency,
  formatDateTime,
} from '@shared/utils/formatters';
import { ordersApi } from '@shared/api/endpoints';
import { OrderStatus } from '@shared/types';
import './ClientArea.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: 'Voucher ativo',
  pending: 'Aguardando pagamento',
  redeemed: 'Resgatado',
  cancelled: 'Cancelado',
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  paid: 'badge-primary',
  pending: 'badge-warning',
  redeemed: 'badge-accent',
  cancelled: 'badge-danger',
};

export function HistoryPage() {
  const ordersQuery = useQuery({
    queryKey: ['my-orders', 'history'],
    queryFn: () => ordersApi.myOrders(),
  });
  const myOrders = ordersQuery.data ?? [];
  const totalCashback = myOrders.reduce((acc, o) => acc + o.cashbackEarned, 0);
  const totalSpent = myOrders.reduce((acc, o) => acc + o.paidPrice, 0);

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Histórico de compras</h2>
          <p className="text-muted">Todas as suas aquisições no OpenDriverHub.</p>
        </div>
      </header>

      <div className="history__stats">
        <Card>
          <small className="text-muted">Total gasto</small>
          <strong className="history__stat">{formatCurrency(totalSpent)}</strong>
        </Card>
        <Card>
          <small className="text-muted">Cashback acumulado</small>
          <strong className="history__stat text-accent">
            {formatCurrency(totalCashback)}
          </strong>
        </Card>
        <Card>
          <small className="text-muted">Compras realizadas</small>
          <strong className="history__stat">{myOrders.length}</strong>
        </Card>
      </div>

      <Card padded={false}>
        <QueryState
          loading={ordersQuery.isLoading}
          error={ordersQuery.error}
          empty={myOrders.length === 0}
          emptyLabel="Nenhuma compra ainda."
          variant="list"
        >
        <table className="history__table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Parceiro</th>
              <th>Código</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Cashback</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {myOrders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/meus-itens/${o.id}`}>{o.productTitle}</Link>
                </td>
                <td>{o.partnerName}</td>
                <td>
                  <code>{formatCode(o.code)}</code>
                </td>
                <td>{formatDateTime(o.createdAt)}</td>
                <td>{formatCurrency(o.paidPrice)}</td>
                <td className="text-accent">+{formatCurrency(o.cashbackEarned)}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
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
