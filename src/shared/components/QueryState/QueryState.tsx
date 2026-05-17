import { ReactNode } from 'react';
import './QueryState.css';

interface QueryStateProps {
  loading: boolean;
  error: unknown;
  empty?: boolean;
  emptyLabel?: string;
  variant?: 'panel' | 'cards' | 'list';
  children: ReactNode;
}

export function QueryState({
  loading,
  error,
  empty,
  emptyLabel = 'Nenhum dado encontrado.',
  variant = 'panel',
  children,
}: QueryStateProps) {
  if (loading)
    return (
      <div className={`query-skeleton query-skeleton--${variant}`} aria-busy="true">
        {variant === 'cards' ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div className="query-skeleton__card" key={idx}>
              <span className="query-skeleton__media" />
              <span className="query-skeleton__line is-strong" />
              <span className="query-skeleton__line" />
              <span className="query-skeleton__line is-short" />
            </div>
          ))
        ) : (
          Array.from({ length: variant === 'list' ? 5 : 3 }).map((_, idx) => (
            <div className="query-skeleton__row" key={idx}>
              <span className="query-skeleton__dot" />
              <span className="query-skeleton__line is-strong" />
              <span className="query-skeleton__line" />
            </div>
          ))
        )}
      </div>
    );
  if (error)
    return (
      <div className="query-state query-state--error">
        ⚠ {error instanceof Error ? error.message : 'Falha ao carregar dados.'}
      </div>
    );
  if (empty)
    return <div className="query-state query-state--empty">{emptyLabel}</div>;
  return <>{children}</>;
}
