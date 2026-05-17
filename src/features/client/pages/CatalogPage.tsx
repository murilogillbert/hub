import { FormEvent, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { catalogApi, CatalogQuery } from '@shared/api/endpoints';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { PartnerStore } from '@shared/types';
import './CatalogPage.css';

const SORTS = [
  { v: 'relevance', l: 'Relevancia' },
  { v: 'price_asc', l: 'Menor preco' },
  { v: 'price_desc', l: 'Maior preco' },
  { v: 'rating', l: 'Melhor avaliados' },
] as const;

function toNumber(value: string | null) {
  return value ? Number(value) || undefined : undefined;
}

function readFilters(params: URLSearchParams): CatalogQuery {
  return {
    category: params.get('category') || undefined,
    q: params.get('q') || undefined,
    city: params.get('city') || undefined,
    state: params.get('state') || undefined,
    partnerId: params.get('partnerId') || undefined,
    minPrice: toNumber(params.get('minPrice')),
    maxPrice: toNumber(params.get('maxPrice')),
    sort: (params.get('sort') as CatalogQuery['sort']) || 'relevance',
    page: toNumber(params.get('page')) ?? 1,
    pageSize: toNumber(params.get('pageSize')) ?? 20,
  };
}

function writeFilters(filters: CatalogQuery, storeId?: string) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'relevance') {
      params.set(key, String(value));
    }
  });
  if ((filters.page ?? 1) <= 1) params.delete('page');
  if ((filters.pageSize ?? 20) === 20) params.delete('pageSize');
  if (storeId) params.set('store', storeId);
  return params;
}

function storeLabel(store: PartnerStore, partnerName: string) {
  return `${partnerName} - ${store.name} (${store.city}/${store.state})`;
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<CatalogQuery>(() =>
    readFilters(searchParams),
  );
  const [selectedStoreId, setSelectedStoreId] = useState(
    searchParams.get('store') ?? '',
  );
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [placeSearch, setPlaceSearch] = useState('');

  const filtersQuery = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: () => catalogApi.filters(),
  });
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => catalogApi.stores(),
  });
  const partnersQuery = useQuery({
    queryKey: ['partners'],
    queryFn: () => catalogApi.partners(),
  });
  const catalogQuery = useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => catalogApi.search(filters),
    placeholderData: keepPreviousData,
  });

  const f = filtersQuery.data;
  const data = catalogQuery.data;
  const stores = storesQuery.data ?? [];
  const partners = partnersQuery.data ?? [];

  const partnerName = (partnerId: string) =>
    partners.find((partner) => partner.id === partnerId)?.name ?? 'Parceiro';

  const citiesForState = useMemo(() => {
    const source = filters.state
      ? stores.filter((store) => store.state === filters.state)
      : stores;
    return Array.from(new Set(source.map((store) => store.city).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }, [filters.state, stores]);

  const placeOptions = useMemo(() => {
    const term = placeSearch.trim().toLowerCase();
    return stores
      .map((store) => ({
        store,
        label: storeLabel(store, partnerName(store.partnerId)),
      }))
      .filter((option) => !term || option.label.toLowerCase().includes(term))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 80);
  }, [placeSearch, stores, partners]);

  useEffect(() => {
    setSearchParams(writeFilters(filters, selectedStoreId), { replace: true });
  }, [filters, selectedStoreId, setSearchParams]);

  useEffect(() => {
    if (placeSearch || !stores.length || !filters.partnerId) return;
    const selected =
      stores.find((store) => store.id === selectedStoreId) ??
      stores.find(
        (store) =>
          store.partnerId === filters.partnerId &&
          (!filters.city || store.city === filters.city) &&
          (!filters.state || store.state === filters.state),
      );
    if (selected) setPlaceSearch(storeLabel(selected, partnerName(selected.partnerId)));
  }, [filters.partnerId, filters.city, filters.state, selectedStoreId, stores, partners, placeSearch]);

  const patch = (p: Partial<CatalogQuery>, storeId = selectedStoreId) => {
    setFilters((cur) => ({ ...cur, ...p, page: 1 }));
    setSelectedStoreId(storeId);
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    patch({ q: searchInput.trim() || undefined });
  };

  const applyPlace = () => {
    const typed = placeSearch.trim();
    const exact = placeOptions.find((option) => option.label === typed);
    if (exact) {
      patch(
        {
          partnerId: exact.store.partnerId,
          city: exact.store.city || undefined,
          state: exact.store.state || undefined,
          q: undefined,
        },
        exact.store.id,
      );
      setSearchInput('');
      return;
    }
    patch(
      {
        q: typed || undefined,
        partnerId: undefined,
        city: undefined,
        state: undefined,
      },
      '',
    );
    setSearchInput(typed);
  };

  const clearPlace = () => {
    setPlaceSearch('');
    patch({ partnerId: undefined, city: undefined, state: undefined }, '');
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters.page]);

  const clearAll = () => {
    setSearchInput('');
    setPlaceSearch('');
    setSelectedStoreId('');
    setFilters({ page: 1, pageSize: filters.pageSize, sort: 'relevance' });
  };

  return (
    <div className="catalog">
      <header className="catalog__head">
        <div>
          <h1>Catalogo</h1>
          <p className="text-muted">
            {data
              ? `${data.total} produto(s) - pagina ${data.page} de ${data.totalPages}`
              : 'Carregando ofertas...'}
          </p>
        </div>
        <form className="catalog__search" onSubmit={submitSearch}>
          <input
            placeholder="Buscar produto, loja ou restaurante..."
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
          <div className="catalog__filter catalog__filter--place">
            <label>Local ou restaurante</label>
            <div className="catalog__place-row">
              <input
                list="catalog-place-options"
                placeholder="Digite nome, bairro, cidade..."
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
              />
              <Button size="sm" onClick={applyPlace}>
                Aplicar
              </Button>
            </div>
            <datalist id="catalog-place-options">
              {placeOptions.map((option) => (
                <option key={option.store.id} value={option.label} />
              ))}
            </datalist>
            {(filters.partnerId || selectedStoreId) && (
              <button
                type="button"
                className="catalog__clear-place"
                onClick={clearPlace}
              >
                Remover local selecionado
              </button>
            )}
          </div>

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
              onChange={(e) =>
                patch({
                  state: e.target.value || undefined,
                  city: undefined,
                  partnerId: undefined,
                }, '')
              }
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
              onChange={(e) =>
                patch({
                  city: e.target.value || undefined,
                  partnerId: undefined,
                }, '')
              }
            >
              <option value="">Todas</option>
              {citiesForState.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog__filter">
            <label>
              Faixa de preco (R$ {filters.minPrice ?? f?.minPrice ?? 0} -{' '}
              {filters.maxPrice ?? f?.maxPrice ?? 0})
            </label>
            <div className="row">
              <input
                type="number"
                placeholder="min"
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
                placeholder="max"
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
            <label>Itens por pagina</label>
            <select
              value={filters.pageSize}
              onChange={(e) => patch({ pageSize: Number(e.target.value) })}
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
          {(filters.partnerId || filters.city || filters.state || filters.q) && (
            <div className="catalog__active">
              {filters.partnerId && <span>Parceiro: {partnerName(filters.partnerId)}</span>}
              {filters.city && <span>Cidade: {filters.city}</span>}
              {filters.state && <span>Estado: {filters.state}</span>}
              {filters.q && <span>Busca: {filters.q}</span>}
            </div>
          )}

          <QueryState
            loading={catalogQuery.isLoading}
            error={catalogQuery.error}
            empty={!!data && data.items.length === 0}
            emptyLabel="Nenhum produto encontrado com esses filtros."
            variant="cards"
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
                  Anterior
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
                  Proxima
                </Button>
              </div>
            )}
          </QueryState>
        </section>
      </div>
    </div>
  );
}
