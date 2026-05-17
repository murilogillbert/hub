import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { ordersApi } from '@shared/api/endpoints';
import { formatCode, formatCurrency } from '@shared/utils/formatters';
import './PurchaseConfirmationPage.css';

export function PurchaseConfirmationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const orderQuery = useQuery({
    queryKey: ['my-order', id],
    queryFn: () => ordersApi.myOrder(id!),
    enabled: !!id,
  });
  const order = orderQuery.data;

  if (!id) {
    return (
      <div className="confirmation confirmation--empty">
        <h2>Nenhuma compra recente</h2>
        <p className="text-muted">Voce pode acessar seus vouchers em "Meus itens".</p>
        <Link to="/conta/itens">
          <Button>Ir para meus itens</Button>
        </Link>
      </div>
    );
  }

  if (orderQuery.isLoading || orderQuery.error || !order) {
    return (
      <QueryState
        loading={orderQuery.isLoading}
        error={orderQuery.error}
        empty={!order && !orderQuery.isLoading}
        emptyLabel="Pedido nao encontrado."
      >
        <div />
      </QueryState>
    );
  }

  return (
    <div className="confirmation">
      <span className="confirmation__success">Pagamento aprovado</span>
      <h1>Seu voucher esta pronto</h1>
      <p className="text-muted">
        Apresente o QR code abaixo no parceiro para resgatar seu produto. O
        cashback de <strong>{formatCurrency(order.cashbackEarned)}</strong> ja foi
        creditado na sua conta e pode ser usado na proxima compra.
      </p>

      <div className="confirmation__voucher">
        <div className="confirmation__voucher-info">
          <small className="text-soft">Produto</small>
          <h3>{order.productTitle}</h3>
          <small className="text-soft">Valor pago</small>
          <strong>{formatCurrency(order.paidPrice)}</strong>
          <small className="text-soft">Codigo do voucher</small>
          <code className="confirmation__code">{formatCode(order.code)}</code>
        </div>
        <div className="confirmation__voucher-qr">
          <QrCode value={order.code} size={200} label={formatCode(order.code)} />
        </div>
      </div>

      <div className="row">
        <Button onClick={() => navigate('/conta/itens')}>Ver em meus itens</Button>
        <Link to="/">
          <Button variant="secondary">Continuar comprando</Button>
        </Link>
      </div>
    </div>
  );
}
