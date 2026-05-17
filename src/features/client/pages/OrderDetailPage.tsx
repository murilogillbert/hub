import { useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { StoreMap } from '@shared/components/StoreMap/StoreMap';
import { ReviewForm } from '@shared/components/Reviews/Reviews';
import { catalogApi, ordersApi } from '@shared/api/endpoints';
import {
  formatCode,
  formatCurrency,
  formatDateTime,
} from '@shared/utils/formatters';
import { OrderStatus } from '@shared/types';
import './ClientArea.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: 'Pago',
  pending: 'Aguardando pagamento',
  redeemed: 'Resgatado',
  cancelled: 'Cancelado',
};

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);

  const orderQuery = useQuery({
    queryKey: ['my-order', id],
    queryFn: () => ordersApi.myOrder(id!),
    enabled: Boolean(id),
  });

  const storesQuery = useQuery({
    queryKey: ['partner-stores', orderQuery.data?.partnerId],
    queryFn: () => catalogApi.stores(orderQuery.data!.partnerId),
    enabled: Boolean(orderQuery.data?.partnerId),
  });

  const order = orderQuery.data;
  const stores = storesQuery.data ?? [];
  const charged = order ? Math.max(0, order.paidPrice - order.cashbackUsed) : 0;
  const selectedStore = stores[0];

  const timeline = useMemo(
    () => [
      { label: 'Pedido criado', done: Boolean(order), date: order?.createdAt },
      {
        label: 'Pagamento confirmado',
        done: order?.status === 'paid' || order?.status === 'redeemed',
        date: order?.createdAt,
      },
      {
        label: 'Voucher resgatado',
        done: order?.status === 'redeemed',
        date: order?.redeemedAt,
      },
    ],
    [order],
  );

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Detalhe do pedido</h2>
          <p className="text-muted">Acompanhe status, valores e local de uso.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/conta/itens')}>
          Voltar
        </Button>
      </header>

      <QueryState loading={orderQuery.isLoading} error={orderQuery.error} empty={!order}>
        {order && (
          <div className="order-detail">
            <Card className="order-detail__main">
              <div className="row-between">
                <div>
                  <small className="text-muted">Pedido</small>
                  <h3>{order.productTitle}</h3>
                  <p className="text-muted">{order.partnerName}</p>
                </div>
                <span className="badge badge-primary">
                  {STATUS_LABEL[order.status]}
                </span>
              </div>

              <dl className="my-items__summary">
                <div>
                  <dt>Valor do item</dt>
                  <dd>{formatCurrency(order.paidPrice)}</dd>
                </div>
                <div>
                  <dt>Cashback abatido</dt>
                  <dd>{formatCurrency(order.cashbackUsed)}</dd>
                </div>
                <div>
                  <dt>Valor cobrado</dt>
                  <dd>{formatCurrency(charged)}</dd>
                </div>
                <div>
                  <dt>Cashback gerado</dt>
                  <dd className="text-accent">{formatCurrency(order.cashbackEarned)}</dd>
                </div>
              </dl>

              <div className="order-detail__code">
                <span className="text-muted">Codigo do voucher</span>
                <code>{formatCode(order.code)}</code>
              </div>
            </Card>

            <Card>
              <h3>Linha do tempo</h3>
              <ol className="order-timeline">
                {timeline.map((step) => (
                  <li key={step.label} className={step.done ? 'is-done' : ''}>
                    <span />
                    <div>
                      <strong>{step.label}</strong>
                      {step.date && <small>{formatDateTime(step.date)}</small>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            {order.status === 'redeemed' && (
              <ReviewForm productId={order.productId} />
            )}

            <Card className="order-detail__stores">
              <div className="row-between">
                <div>
                  <h3>Unidade do parceiro</h3>
                  <p className="text-muted">
                    {selectedStore
                      ? `${selectedStore.name} - ${selectedStore.city}/${selectedStore.state}`
                      : 'Este parceiro ainda nao possui unidade com mapa.'}
                  </p>
                </div>
                {stores.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  >
                    Ver no mapa
                  </Button>
                )}
              </div>

              {selectedStore && (
                <address className="order-detail__address">
                  {selectedStore.address}
                </address>
              )}

              {stores.length > 0 && (
                <div ref={mapRef}>
                  <StoreMap stores={stores} height={320} />
                </div>
              )}
            </Card>

            <Link to="/conta/historico" className="order-detail__history-link">
              Ver historico completo
            </Link>
          </div>
        )}
      </QueryState>
    </div>
  );
}
