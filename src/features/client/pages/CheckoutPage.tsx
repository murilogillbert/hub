import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { resolveImageUrl } from '@shared/api/client';
import { useAuth } from '@shared/hooks/useAuth';
import { formatCurrency, formatPercent } from '@shared/utils/formatters';
import {
  catalogApi,
  ordersApi,
  paymentsApi,
  PaymentSnapshot,
} from '@shared/api/endpoints';
import './CheckoutPage.css';

type Method = 'pix' | 'credit_card' | 'debit_card';

const METHODS: { id: Method; label: string; description: string }[] = [
  { id: 'pix', label: 'Pix', description: 'Confirmação automática · 0% de taxa' },
  {
    id: 'credit_card',
    label: 'Cartão de Crédito',
    description: 'Processado via Mercado Pago',
  },
  {
    id: 'debit_card',
    label: 'Cartão de Débito',
    description: 'Aprovação imediata · Mercado Pago',
  },
];

type Phase = 'form' | 'pix_waiting' | 'processing' | 'approved' | 'error';

export function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.product(id!),
    enabled: !!id,
  });
  const product = productQuery.data;

  const [method, setMethod] = useState<Method>('pix');
  const [card, setCard] = useState({ number: '', holder: '', expiry: '', cvv: '' });
  const [phase, setPhase] = useState<Phase>('form');
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  if (productQuery.isLoading || productQuery.error || !product) {
    return (
      <QueryState
        loading={productQuery.isLoading}
        error={productQuery.error}
        empty={!product && !productQuery.isLoading}
        emptyLabel="Produto inválido."
      >
        <div />
      </QueryState>
    );
  }

  const cashback = (product.price * product.cashbackPercent) / 100;

  const goToConfirmation = (snap: PaymentSnapshot) => {
    navigate('/compra/confirmacao', {
      state: {
        code: snap.voucherCode ?? snap.paymentReference ?? orderIdRef.current,
        productTitle: product.title,
        price: product.price,
        cashback,
      },
    });
  };

  const startPixPolling = (orderId: string) => {
    pollRef.current = window.setInterval(async () => {
      const snap = await paymentsApi.status(orderId);
      setSnapshot(snap);
      if (snap.paymentStatus === 'approved') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setPhase('approved');
        window.setTimeout(() => goToConfirmation(snap), 1200);
      }
    }, 2500);
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const order = await ordersApi.create(product.id);
      orderIdRef.current = order.id;

      if (method === 'pix') {
        const snap = await paymentsApi.process({
          orderId: order.id,
          method: 'pix',
          card: null,
        });
        setSnapshot(snap);
        setPhase('pix_waiting');
        startPixPolling(order.id);
        return;
      }

      setPhase('processing');
      const snap = await paymentsApi.process({
        orderId: order.id,
        method,
        card,
      });
      setSnapshot(snap);
      if (snap.paymentStatus === 'approved') {
        setPhase('approved');
        window.setTimeout(() => goToConfirmation(snap), 1000);
      } else {
        setPhase('error');
        setError('Pagamento recusado. Verifique os dados do cartão.');
      }
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Falha no pagamento.');
    }
  };

  return (
    <form className="checkout" onSubmit={handlePay}>
      <div className="checkout__left">
        <div className="row-between">
          <h2>Pagamento</h2>
          <span className="badge badge-primary">via Mercado Pago</span>
        </div>
        <p className="text-muted">
          Checkout integrado ao gateway de pagamento.
        </p>

        {phase === 'form' && (
          <>
            <div className="checkout__methods">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`checkout__method ${method === m.id ? 'is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                  />
                  <div>
                    <strong>{m.label}</strong>
                    <small>{m.description}</small>
                  </div>
                </label>
              ))}
            </div>

            {method !== 'pix' && (
              <div className="checkout__card stack">
                <Input
                  label="Número do cartão"
                  placeholder="5031 4332 1540 6351"
                  value={card.number}
                  onChange={(e) =>
                    setCard((c) => ({ ...c, number: e.target.value }))
                  }
                  hint="Use 5031 4332 1540 6351 para simular recusa"
                  required
                />
                <Input
                  label="Nome impresso no cartão"
                  value={card.holder}
                  onChange={(e) =>
                    setCard((c) => ({ ...c, holder: e.target.value }))
                  }
                  required
                />
                <div className="row">
                  <Input
                    label="Validade"
                    placeholder="MM/AA"
                    value={card.expiry}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, expiry: e.target.value }))
                    }
                    required
                  />
                  <Input
                    label="CVV"
                    placeholder="000"
                    value={card.cvv}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, cvv: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'pix_waiting' && snapshot?.pix && (
          <div className="checkout__pix">
            <QrCode value={snapshot.pix.copiaECola} size={180} />
            <div>
              <strong>Escaneie o QR ou copie o código Pix</strong>
              <p className="text-muted">
                Aguardando confirmação... A tela atualiza sozinha quando o
                pagamento cair (~8s, reconciliação do servidor).
              </p>
              <code className="checkout__pix-code">
                {snapshot.pix.copiaECola}
              </code>
              <div className="checkout__pix-status">
                <span className="checkout__spinner" /> Aguardando pagamento
              </div>
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="checkout__state">
            <span className="checkout__spinner checkout__spinner--lg" />
            <strong>Processando pagamento...</strong>
          </div>
        )}

        {phase === 'approved' && (
          <div className="checkout__state checkout__state--ok">
            <span className="checkout__check">✓</span>
            <strong>Pagamento aprovado! Gerando seu voucher...</strong>
          </div>
        )}

        {phase === 'error' && (
          <div className="checkout__state checkout__state--err">
            <strong>⚠ {error}</strong>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPhase('form');
                setError(null);
              }}
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </div>

      <aside className="checkout__right">
        <h3>Resumo</h3>
        <div className="checkout__item">
          <img src={resolveImageUrl(product.imageUrl)} alt={product.title} />
          <div>
            <strong>{product.title}</strong>
            <small className="text-muted">{product.category}</small>
          </div>
        </div>

        <dl className="checkout__summary">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(product.price)}</dd>
          </div>
          <div>
            <dt>Cashback que você ganhará</dt>
            <dd className="checkout__cashback">+{formatCurrency(cashback)}</dd>
          </div>
          {user && user.cashbackBalance > 0 && (
            <div>
              <dt>Saldo de cashback disponível</dt>
              <dd>{formatCurrency(user.cashbackBalance)}</dd>
            </div>
          )}
          <div className="checkout__total">
            <dt>Total a pagar</dt>
            <dd>{formatCurrency(product.price)}</dd>
          </div>
        </dl>
        <small className="text-soft">
          Cashback ({formatPercent(product.cashbackPercent)}) creditado após o
          resgate no parceiro.
        </small>
        {phase === 'form' && (
          <Button type="submit" size="lg" fullWidth>
            {method === 'pix'
              ? `Gerar Pix de ${formatCurrency(product.price)}`
              : `Pagar ${formatCurrency(product.price)}`}
          </Button>
        )}
        <Link to={`/produto/${product.id}`} className="checkout__cancel">
          Cancelar
        </Link>
      </aside>
    </form>
  );
}
