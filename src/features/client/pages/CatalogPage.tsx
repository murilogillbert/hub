import { FormEvent, useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ProductCard } from '../components/ProductCard';
import { catalogApi, CatalogQuery } from '@shared/api/endpoints';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import './CatalogPage.css';

const SORTS = [
  { v: 'relevance', l: 'Relevância' },
  { v: 'price_asc', l: 'Menor preço' },
  { v: 'price_desc', l: 'Maior preço' },
  { v: 'rating', l: 'Melhor avaliados' },
] as const;

export function CatalogPage() {
  const [filters, setFilters] = useState<CatalogQuery>({
    page: 1,
    pageSize: 20,
    sort: 'relevance',
  });
  const [searchInput, setSearchInput] = useState('');

  const filtersQuery = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: () => catalogApi.filters(),
  });
  const catalogQuery = useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => catalogApi.search(filters),
    placeholderData: keepPreviousData,
  });

  const f = filtersQuery.data;
  const data = catalogQuery.data;

  // Sempre que um filtro muda, volta para a página 1.
  const patch = (p: Partial<CatalogQuery>) =>
    setFilters((cur) => ({ ...cur, ...p, page: 1 }));

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    patch({ q: searchInput.trim() || undefined });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters.page]);

  const clearAll = () => {
    setSearchInput('');
    setFilters({ page: 1, pageSize: filters.pageSize, sort: 'relevance' });
  };

  return (
    <div className="catalog">
      <header className="catalog__head">
        <div>
          <h1>Catálogo</h1>
          <p className="text-muted">
            {data
              ? `${data.total} produto(s) — página ${data.page} de ${data.totalPages}`
              : 'Carregando ofertas...'}
          </p>
        </div>
        <form className="catalog__search" onSubmit={submitSearch}>
          <input
            placeholder="Buscar produto ou loja..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" size="sm">
            Buscar
          </Button>
        </form>
      </header>

      <div className="catalog__layout">
        <aside className="catalog__filters">
          <div className="catalog__filter">
            <label>Categoria</label>
            <select
              value={filters.category ?? ''}
              onChange={(e) =>
                patch({ category: e.target.value || undefined })
              }
            >
              <option value="">Todas</option>
              {f?.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog__filter">
            <label>Estado</label>
            <select
              value={filters.state ?? ''}
              onChange={(e) => patch({ state: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {f?.states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog__filter">
            <label>Cidade</label>
            <select
              value={filters.city ?? ''}
              onChange={(e) => patch({ city: e.target.value || undefined })}
            >
              <option value="">Todas</option>
              {f?.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog__filter">
            <label>
              Faixa de preço (R$ {filters.minPrice ?? f?.minPrice ?? 0} –{' '}
              {filters.maxPrice ?? f?.maxPrice ?? 0})
            </label>
            <div className="row">
              <input
                type="number"
                placeholder="mín"
                min={f?.minPrice ?? 0}
                value={filters.minPrice ?? ''}
                onChange={(e) =>
                  patch({
                    minPrice: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
              <input
                type="number"
                placeholder="máx"
                max={f?.maxPrice ?? 0}
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  patch({
                    maxPrice: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="catalog__filter">
            <label>Ordenar por</label>
            <select
              value={filters.sort}
              onChange={(e) =>
                patch({ sort: e.target.value as CatalogQuery['sort'] })
              }
            >
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog__filter">
            <label>Itens por página</label>
            <select
              value={filters.pageSize}
              onChange={(e) =>
                patch({ pageSize: Number(e.target.value) })
              }
            >
              {[20, 30, 40, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" fullWidth onClick={clearAll}>
            Limpar filtros
          </Button>
        </aside>

        <section className="catalog__results">
          <QueryState
            loading={catalogQuery.isLoading}
            error={catalogQuery.error}
            empty={!!data && data.items.length === 0}
            emptyLabel="Nenhum produto encontrado com esses filtros."
          >
            <div className="catalog__grid">
              {data?.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {data && data.totalPages > 1 && (
              <div className="catalog__pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() =>
                    setFilters((c) => ({ ...c, page: (c.page ?? 1) - 1 }))
                  }
                >
                  ← Anterior
                </Button>
                <span className="catalog__page-info">
                  {data.page} / {data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() =>
                    setFilters((c) => ({ ...c, page: (c.page ?? 1) + 1 }))
                  }
                >
                  Próxima →
                </Button>
              </div>
            )}
          </QueryState>
        </section>
      </div>
    </div>
  );
}
