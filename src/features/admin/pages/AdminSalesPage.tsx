import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

export function AdminSalesPage() {
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const partnersQuery = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => adminApi.partners({ page: 1, pageSize: 100 }),
  });
  const salesQuery = useQuery({
    queryKey: ['admin-sales', partnerFilter, statusFilter, search, page],
    queryFn: () =>
      adminApi.sales({
        partnerId: partnerFilter === 'all' ? undefined : partnerFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: search || undefined,
        page,
        pageSize: 20,
      }),
  });

  const partners = partnersQuery.data?.items ?? [];
  const orders = salesQuery.data?.items ?? [];
  const salesPage = salesQuery.data;

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          !search ||
          o.customerName.toLowerCase().includes(search.toLowerCase()) ||
          o.productTitle.toLowerCase().includes(search.toLowerCase()) ||
          o.code.toLowerCase().includes(search.toLowerCase()),
      ),
    [orders, search],
  );

  const totals = useMemo(() => {
    const gross = filtered.reduce((acc, o) => acc + o.paidPrice, 0);
    const fee = gross * 0.1;
    const cashback = filtered.reduce((acc, o) => acc + o.cashbackEarned, 0);
    return { gross, fee, cashback, net: fee - cashback };
  }, [filtered]);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Análise de vendas</h2>
          <p className="text-muted">
            Filtre por parceiro, status ou busque por cliente/produto.
          </p>
        </div>
      </header>

      <div className="admin-page__stats">
        <StatCard label="GMV filtrado" value={formatCurrency(totals.gross)} />
        <StatCard label="Taxa retida (10%)" value={formatCurrency(totals.fee)} />
        <StatCard
          label="Cashback concedido"
          value={formatCurrency(totals.cashback)}
        />
        <StatCard
          label="Resultado líquido"
          value={formatCurrency(totals.net)}
        />
      </div>

      <Card>
        <div className="admin-filters">
          <Input
            label="Buscar"
            placeholder="Cliente, produto ou código"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <div className="admin-filters__select">
            <label>Parceiro</label>
            <select
              value={partnerFilter}
              onChange={(e) => {
                setPartnerFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-filters__select">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              <option value="PendingPayment">Aguardando</option>
              <option value="Paid">Pago</option>
              <option value="Redeemed">Resgatado</option>
              <option value="Cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={salesQuery.isLoading}
          error={salesQuery.error}
          empty={filtered.length === 0}
          emptyLabel="Nenhuma venda para o filtro."
          variant="list"
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Parceiro</th>
                <th>Produto</th>
                <th>Data</th>
                <th>Bruto</th>
                <th>Cashback</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.code.slice(0, 9)}…</code>
                  </td>
                  <td>{o.customerName}</td>
                  <td>{o.partnerName}</td>
                  <td>{o.productTitle}</td>
                  <td>{formatDateTime(o.createdAt)}</td>
                  <td>{formatCurrency(o.paidPrice)}</td>
                  <td className="text-accent">
                    {formatCurrency(o.cashbackEarned)}
                  </td>
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

      {salesPage && (
        <div className="admin-pagination">
          <span>
            Pagina {salesPage.page} de {salesPage.totalPages} - {salesPage.total} venda(s)
          </span>
          <div className="row">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= salesPage.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
