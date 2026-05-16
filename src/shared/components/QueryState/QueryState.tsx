import { ReactNode } from 'react';
import './QueryState.css';

interface QueryStateProps {
  loading: boolean;
  error: unknown;
  empty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

export function QueryState({
  loading,
  error,
  empty,
  emptyLabel = 'Nenhum dado encontrado.',
  children,
}: QueryStateProps) {
  if (loading)
    return (
      <div className="query-state">
        <span className="query-state__spinner" />
        <span>Carregando...</span>
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
