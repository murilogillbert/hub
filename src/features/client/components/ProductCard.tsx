import { Link } from 'react-router-dom';
import { Product } from '@shared/types';
import { resolveImageUrl } from '@shared/api/client';
import { formatCurrency, formatPercent } from '@shared/utils/formatters';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
}

const KIND_LABEL: Record<Product['kind'], string> = {
  voucher: 'Voucher',
  physical: 'Físico',
  digital: 'Digital',
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link to={`/produto/${product.id}`} className="product-card">
      <div className="product-card__image">
        <img
          src={resolveImageUrl(product.imageUrl)}
          alt={product.title}
          loading="lazy"
        />
        <span className="product-card__kind">{KIND_LABEL[product.kind]}</span>
      </div>
      <div className="product-card__body">
        <div className="row-between">
          <small className="text-soft">{product.category}</small>
          <small className="text-soft">★ {product.rating.toFixed(1)}</small>
        </div>
        <h4 className="product-card__title">{product.title}</h4>
        <div className="product-card__price">
          <strong>{formatCurrency(product.price)}</strong>
          <span className="badge badge-accent">
            {formatPercent(product.cashbackPercent)} cashback
          </span>
        </div>
      </div>
    </Link>
  );
}
