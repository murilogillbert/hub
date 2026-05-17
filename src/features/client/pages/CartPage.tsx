import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { useCart } from '@shared/context/CartContext';
import { resolveImageUrl } from '@shared/api/client';
import { formatCurrency } from '@shared/utils/formatters';
import './ClientArea.css';

export function CartPage() {
  const navigate = useNavigate();
  const { items, subtotal, cashbackTotal, setQuantity, remove, clear } =
    useCart();

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Carrinho</h2>
          <p className="text-muted">
            Itens de qualquer parceiro em um único pedido. Você recebe um
            voucher e cada parceiro valida os itens dele.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="secondary" onClick={clear}>
            Esvaziar
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <Card>
          <p className="text-muted">Seu carrinho está vazio.</p>
          <Link to="/produtos">
            <Button>Explorar catálogo</Button>
          </Link>
        </Card>
      ) : (
        <div className="cart">
          <Card padded={false}>
            <table className="history__table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Parceiro</th>
                  <th>Preço</th>
                  <th>Qtd</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.productId}>
                    <td>
                      <div className="admin-partners__cell">
                        <img
                          src={resolveImageUrl(l.imageUrl)}
                          alt={l.title}
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: 'cover',
                            borderRadius: 8,
                          }}
                        />
                        <strong>{l.title}</strong>
                      </div>
                    </td>
                    <td>{l.partnerName}</td>
                    <td>{formatCurrency(l.price)}</td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) =>
                          setQuantity(
                            l.productId,
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        style={{ width: 64 }}
                      />
                    </td>
                    <td>{formatCurrency(l.price * l.quantity)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(l.productId)}
                      >
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="cart__summary">
            <dl className="checkout__summary">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCurrency(subtotal)}</dd>
              </div>
              <div>
                <dt>Cashback que você ganhará</dt>
                <dd className="text-accent">+{formatCurrency(cashbackTotal)}</dd>
              </div>
            </dl>
            <Button size="lg" fullWidth onClick={() => navigate('/checkout')}>
              Finalizar compra
            </Button>
            <Link to="/produtos" className="checkout__cancel">
              Continuar comprando
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
