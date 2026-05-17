import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { reviewsApi } from '@shared/api/endpoints';
import { resolveImageUrl } from '@shared/api/client';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime } from '@shared/utils/formatters';
import './Reviews.css';

export function Stars({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <span className="rv-stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`rv-stars__star ${n <= value ? 'is-on' : ''} ${
            onChange ? 'is-clickable' : ''
          }`}
          onClick={onChange ? () => onChange(n) : undefined}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          disabled={!onChange}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/** Lista pública de avaliações + média. Use em ProductPage. */
export function ProductReviewsSection({ productId }: { productId: string }) {
  const q = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => reviewsApi.forProduct(productId),
    enabled: Boolean(productId),
  });
  const data = q.data;
  if (!data || data.count === 0) {
    return (
      <section className="rv-section">
        <h2>Avaliações</h2>
        <p className="text-muted">
          Este produto ainda não tem avaliações. Compre e resgate para ser o
          primeiro a avaliar.
        </p>
      </section>
    );
  }
  return (
    <section className="rv-section">
      <header className="rv-section__head">
        <h2>Avaliações</h2>
        <div className="rv-section__avg">
          <strong>{data.average.toFixed(1)}</strong>
          <Stars value={Math.round(data.average)} />
          <small className="text-muted">
            {data.count} avaliaç{data.count > 1 ? 'ões' : 'ão'}
          </small>
        </div>
      </header>
      <ul className="rv-list">
        {data.items.map((r) => (
          <li key={r.id} className="rv-list__item">
            <div className="rv-list__top">
              {r.userAvatarUrl ? (
                <img
                  src={resolveImageUrl(r.userAvatarUrl) || r.userAvatarUrl}
                  alt={r.userName}
                  className="rv-list__avatar"
                />
              ) : (
                <span className="rv-list__avatar rv-list__avatar--ph">
                  {r.userName.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <strong>{r.userName}</strong>
                <small className="text-muted">
                  {formatDateTime(r.createdAt)}
                </small>
              </div>
              <Stars value={r.rating} size={14} />
            </div>
            {r.comment && <p className="rv-list__comment">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Formulário de avaliação — só aparece se o pedido foi resgatado. */
export function ReviewForm({ productId }: { productId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const elig = useQuery({
    queryKey: ['review-eligibility', productId],
    queryFn: () => reviewsApi.eligibility(productId),
    enabled: Boolean(productId),
  });

  const submit = useMutation({
    mutationFn: () =>
      reviewsApi.create({ productId, rating, comment: comment || undefined }),
    onSuccess: () => {
      toast.success('Avaliação enviada. Obrigado!');
      qc.invalidateQueries({ queryKey: ['review-eligibility', productId] });
      qc.invalidateQueries({ queryKey: ['reviews', productId] });
      qc.invalidateQueries({ queryKey: ['product', productId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao avaliar.'),
  });

  if (elig.isLoading) return null;
  if (elig.data?.alreadyReviewed) {
    return (
      <Card>
        <h3>Avaliação</h3>
        <p className="text-muted">Você já avaliou este produto. Obrigado!</p>
      </Card>
    );
  }
  if (!elig.data?.canReview) return null;

  return (
    <Card>
      <h3>Avalie este produto</h3>
      <p className="text-muted">
        Você resgatou este item — conte como foi a experiência.
      </p>
      <div className="rv-form">
        <Stars value={rating} onChange={setRating} size={28} />
        <textarea
          className="rv-form__text"
          placeholder="Comentário (opcional)"
          maxLength={1000}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button
          onClick={() => submit.mutate()}
          disabled={rating < 1 || submit.isPending}
        >
          {submit.isPending ? 'Enviando...' : 'Enviar avaliação'}
        </Button>
      </div>
    </Card>
  );
}
