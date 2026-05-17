import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { catalogApi } from '@shared/api/endpoints';
import { resolveImageUrl } from '@shared/api/client';
import { StoreMap } from '@shared/components/StoreMap/StoreMap';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { ProductReviewsSection } from '@shared/components/Reviews/Reviews';
import { useCart } from '@shared/context/CartContext';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatPercent } from '@shared/utils/formatters';
import './ProductPage.css';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cart = useCart();
  const toast = useToast();

  const productQuery = useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.product(id!),
    enabled: !!id,
  });
  const product = productQuery.data;

  const storesQuery = useQuery({
    queryKey: ['stores', product?.partnerId],
    queryFn: () => catalogApi.stores(product!.partnerId),
    enabled: !!product?.partnerId,
  });
  const partnerQuery = useQuery({
    queryKey: ['partner', product?.partnerId],
    queryFn: () => catalogApi.partner(product!.partnerId),
    enabled: !!product?.partnerId,
  });

  if (productQuery.isLoading || productQuery.error || !product) {
    return (
      <QueryState
        loading={productQuery.isLoading}
        error={productQuery.error}
        empty={!product && !productQuery.isLoading}
        emptyLabel="Produto não encontrado."
      >
        <div />
      </QueryState>
    );
  }

  const partner = partnerQuery.data;
  const partnerStores = storesQuery.data ?? [];
  const cashback = (product.price * product.cashbackPercent) / 100;

  return (
    <div className="product-page">
      <Link to="/" className="product-page__back">
        ← Voltar
      </Link>

      <section className="product-page__main">
        <div className="product-page__media">
          <img src={resolveImageUrl(product.imageUrl)} alt={product.title} />
        </div>
        <div className="product-page__info">
          <div className="row">
            <span className="badge badge-primary">{product.category}</span>
            <span className="badge">
              ★ {product.rating > 0 ? product.rating.toFixed(1) : 'novo'}
            </span>
          </div>
          <h1>{product.title}</h1>
          <p className="text-muted">{product.description}</p>

          <div className="product-page__partner">
            <img src={partner?.logoUrl} alt={partner?.name} />
            <div>
              <small className="text-soft">Vendido por</small>
              <strong>{partner?.name}</strong>
            </div>
          </div>

          <div className="product-page__price-box">
            <div>
              <span className="text-soft">Preço</span>
              <strong className="product-page__price">{formatCurrency(product.price)}</strong>
            </div>
            <div>
              <span className="text-soft">Cashback</span>
              <strong className="product-page__cashback">
                {formatCurrency(cashback)} <small>({formatPercent(product.cashbackPercent)})</small>
              </strong>
            </div>
          </div>

          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Button
              size="lg"
              fullWidth
              onClick={() => navigate(`/checkout/${product.id}`)}
            >
              Comprar agora
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                cart.add({
                  productId: product.id,
                  title: product.title,
                  category: product.category,
                  imageUrl: product.imageUrl,
                  price: product.price,
                  cashbackPercent: product.cashbackPercent,
                  partnerId: product.partnerId,
                  partnerName: product.partnerName,
                });
                toast.success('Adicionado ao carrinho.');
              }}
            >
              + Carrinho
            </Button>
          </div>
          <small className="text-soft">
            Pague no Pix ou cartão · receba código + QR para resgate em qualquer ponto físico ou
            digital
          </small>
        </div>
      </section>

      {partnerStores.length > 0 && (
        <section className="product-page__stores">
          <header>
            <h2>Onde resgatar</h2>
            <p className="text-muted">Use o QR code do voucher em qualquer unidade do parceiro.</p>
          </header>
          <StoreMap stores={partnerStores} height={320} />
          <ul className="product-page__store-list">
            {partnerStores.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <small className="text-muted">{s.address}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProductReviewsSection productId={product.id} />
    </div>
  );
}
