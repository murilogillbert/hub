import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/Button/Button';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { formatCode, formatCurrency } from '@shared/utils/formatters';
import './PurchaseConfirmationPage.css';

interface ConfirmationState {
  code: string;
  productTitle: string;
  price: number;
  cashback: number;
}

export function PurchaseConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ConfirmationState | null;

  if (!state) {
    return (
      <div className="confirmation confirmation--empty">
        <h2>Nenhuma compra recente</h2>
        <p className="text-muted">Você pode acessar seus vouchers em "Meus itens".</p>
        <Link to="/conta/itens">
          <Button>Ir para meus itens</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="confirmation">
      <span className="confirmation__success">✓ Pagamento aprovado</span>
      <h1>Seu voucher está pronto 🎉</h1>
      <p className="text-muted">
        Apresente o QR code abaixo no parceiro para resgatar seu produto. O
        cashback de <strong>{formatCurrency(state.cashback)}</strong> já foi
        creditado na sua conta e pode ser usado na próxima compra.
      </p>

      <div className="confirmation__voucher">
        <div className="confirmation__voucher-info">
          <small className="text-soft">Produto</small>
          <h3>{state.productTitle}</h3>
          <small className="text-soft">Valor pago</small>
          <strong>{formatCurrency(state.price)}</strong>
          <small className="text-soft">Código do voucher</small>
          <code className="confirmation__code">{formatCode(state.code)}</code>
        </div>
        <div className="confirmation__voucher-qr">
          <QrCode value={state.code} size={200} label={formatCode(state.code)} />
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
