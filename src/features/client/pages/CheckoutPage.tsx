import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { resolveImageUrl } from '@shared/api/client';
import { useAuth } from '@shared/hooks/useAuth';
import { useCart } from '@shared/context/CartContext';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency } from '@shared/utils/formatters';
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
const PIX_MIN_VISIBLE_MS = 5 * 60 * 1000;

export function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const cart = useCart();

  // Modo 1 produto (/checkout/:id) ou modo carrinho (/checkout).
  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.product(id!),
    enabled: !!id,
  });
  const product = productQuery.data;

  const lines = id
    ? product
      ? [
          {
            productId: product.id,
            title: product.title,
            category: product.category,
            imageUrl: product.imageUrl,
            price: product.price,
            cashbackPercent: product.cashbackPercent,
            quantity: 1,
          },
        ]
      : []
    : cart.items.map((l) => ({
        productId: l.productId,
        title: l.title,
        category: l.category,
        imageUrl: l.imageUrl,
        price: l.price,
        cashbackPercent: l.cashbackPercent,
        quantity: l.quantity,
      }));

  const [method, setMethod] = useState<Method>('pix');
  const [useCashbackOpt, setUseCashbackOpt] = useState(false);
  const [card, setCard] = useState({ number: '', holder: '', expiry: '', cvv: '' });
  const [phase, setPhase] = useState<Phase>('form');
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null);
  const [pixVisibleUntil, setPixVisibleUntil] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  if (id && (productQuery.isLoading || productQuery.error || !product)) {
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

  if (lines.length === 0) {
    return (
      <div className="checkout">
        <div className="checkout__left">
          <h2>Carrinho vazio</h2>
          <p className="text-muted">
            Adicione itens ao carrinho para finalizar a compra.
          </p>
          <Link to="/produtos">
            <Button>Explorar catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const cashback = lines.reduce(
    (s, l) => s + (l.price * l.quantity * l.cashbackPercent) / 100,
    0,
  );
  const balance = user?.cashbackBalance ?? 0;
  const cashbackApplied = useCashbackOpt
    ? Math.min(Math.round(balance * 100) / 100, subtotal)
    : 0;
  const total = Math.max(0, subtotal - cashbackApplied);

  const goToConfirmation = (snap: PaymentSnapshot) => {
    const orderId = snap.orderId ?? orderIdRef.current;
    if (!id) cart.clear(); // pedido criado a partir do carrinho
    if (orderId) navigate(`/compra/confirmacao/${orderId}`, { replace: true });
  };

  const keepPixPayload = (snap: PaymentSnapshot) => {
    setSnapshot((current) => ({
      ...snap,
      pix: snap.pix ?? current?.pix ?? null,
    }));
  };

  const startPixPolling = (orderId: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const snap = await paymentsApi.status(orderId);
        keepPixPayload(snap);
        if (snap.paymentStatus === 'approved') {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setPhase('approved');
          toast.success('Pagamento aprovado.');
          window.setTimeout(() => goToConfirmation(snap), 1200);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Falha ao atualizar pagamento.';
        setError(message);
        toast.error(message);
      }
    }, 2500);
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const order = await ordersApi.create(
        lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        useCashbackOpt,
      );
      orderIdRef.current = order.id;

      if (method === 'pix') {
        const snap = await paymentsApi.process({
          orderId: order.id,
          method: 'pix',
          card: null,
        });
        keepPixPayload(snap);
        const gatewayExpiry = snap.pix?.expiresAt
          ? new Date(snap.pix.expiresAt).getTime()
          : 0;
        setPixVisibleUntil(
          new Date(Math.max(Date.now() + PIX_MIN_VISIBLE_MS, gatewayExpiry)),
        );
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
        toast.success('Pagamento aprovado.');
        window.setTimeout(() => goToConfirmation(snap), 1000);
      } else {
        setPhase('error');
        setError('Pagamento recusado. Verifique os dados do cartão.');
      }
    } catch (err) {
      setPhase('error');
      const message = err instanceof Error ? err.message : 'Falha no pagamento.';
      setError(message);
      toast.error(message);
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

        {phase === 'form' && total <= 0 && (
          <div className="checkout__state checkout__state--ok">
            <span className="checkout__check">✓</span>
            <strong>
              Seu cashback cobre todo o valor. É só concluir — nenhum pagamento
              extra necessário.
            </strong>
          </div>
        )}

        {phase === 'form' && total > 0 && (
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
                Aguardando confirmação. O QR Code permanece disponível por
                pelo menos 5 minutos nesta tela.
              </p>
              {pixVisibleUntil && (
                <small className="text-soft">
                  Visível até {pixVisibleUntil.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              )}
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
        {lines.map((l) => (
          <div className="checkout__item" key={l.productId}>
            <img src={resolveImageUrl(l.imageUrl)} alt={l.title} />
            <div>
              <strong>
                {l.quantity > 1 ? `${l.quantity}x ` : ''}
                {l.title}
              </strong>
              <small className="text-muted">{l.category}</small>
            </div>
            <span>{formatCurrency(l.price * l.quantity)}</span>
          </div>
        ))}

        {phase === 'form' && balance > 0 && (
          <label className="checkout__usecash">
            <input
              type="checkbox"
              checked={useCashbackOpt}
              onChange={(e) => setUseCashbackOpt(e.target.checked)}
            />
            <span>
              Usar meu cashback ({formatCurrency(balance)}) para abater este
              pagamento
            </span>
          </label>
        )}

        <dl className="checkout__summary">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(subtotal)}</dd>
          </div>
          {cashbackApplied > 0 && (
            <div>
              <dt>Cashback aplicado</dt>
              <dd className="checkout__cashback">
                −{formatCurrency(cashbackApplied)}
              </dd>
            </div>
          )}
          <div>
            <dt>Cashback que você ganhará</dt>
            <dd className="checkout__cashback">+{formatCurrency(cashback)}</dd>
          </div>
          <div className="checkout__total">
            <dt>Total a pagar</dt>
            <dd>{formatCurrency(total)}</dd>
          </div>
        </dl>
        <small className="text-soft">
          O cashback é creditado na sua conta assim que o pagamento é
          confirmado.
        </small>
        {phase === 'form' && (
          <Button type="submit" size="lg" fullWidth>
            {total <= 0
              ? 'Concluir com cashback'
              : method === 'pix'
                ? `Gerar Pix de ${formatCurrency(total)}`
                : `Pagar ${formatCurrency(total)}`}
          </Button>
        )}
        <Link
          to={id ? `/produto/${id}` : '/carrinho'}
          className="checkout__cancel"
        >
          Cancelar
        </Link>
      </aside>
    </form>
  );
}
