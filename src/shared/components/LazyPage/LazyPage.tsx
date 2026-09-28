import { ComponentType, Suspense, lazy } from 'react';
import { QueryState } from '@shared/components/QueryState/QueryState';

/**
 * Carrega a página só quando a rota é aberta (chunk próprio). O fallback fica
 * dentro do layout, então cabeçalho e menu não piscam durante o carregamento.
 * Uso: `const AdminSalesPage = lazyPage(() => import('...'), 'AdminSalesPage');`
 */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M & string>(
  loader: () => Promise<M>,
  name: K,
): ComponentType {
  const Page = lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
  function LazyPage() {
    return (
      <Suspense
        fallback={
          <QueryState loading error={null}>
            {null}
          </QueryState>
        }
      >
        <Page />
      </Suspense>
    );
  }
  LazyPage.displayName = `Lazy(${name})`;
  return LazyPage;
}
