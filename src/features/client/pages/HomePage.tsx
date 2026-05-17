import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '../components/ProductCard';
import { catalogApi, NearbyStore } from '@shared/api/endpoints';
import { StoreMap } from '@shared/components/StoreMap/StoreMap';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatPercent } from '@shared/utils/formatters';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Todos');
  const [query, setQuery] = useState('');
  const [nearby, setNearby] = useState<NearbyStore[] | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocalização não suportada neste navegador.');
      return;
    }
    setGeoStatus('Obtendo sua localização...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const list = await catalogApi.storesNearby(
            pos.coords.latitude,
            pos.coords.longitude,
            25,
          );
          setNearby(list);
          setGeoStatus(
            list.length
              ? `${list.length} ponto(s) num raio de 25 km`
              : 'Nenhum ponto físico num raio de 25 km.',
          );
        } catch {
          setGeoStatus('Falha ao buscar lojas próximas.');
        }
      },
      () => setGeoStatus('Permissão de localização negada.'),
    );
  };

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => catalogApi.products(),
  });
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => catalogApi.stores(),
  });
  const partnersQuery = useQuery({
    queryKey: ['partners'],
    queryFn: () => catalogApi.partners(),
  });

  const products = productsQuery.data ?? [];
  const stores = storesQuery.data ?? [];
  const partners = partnersQuery.data ?? [];

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['Todos', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = category === 'Todos' || p.category === category;
      const q = query.toLowerCase();
      const matchesQuery =
        p.title.toLowerCase().includes(q) ||
        p.partnerName.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, category, query]);

  // Métricas do hero derivadas 100% dos dados reais da API.
  const activePartners = useMemo(
    () => partners.filter((p) => p.active).length,
    [partners],
  );
  const maxCashback = useMemo(
    () =>
      products.length
        ? Math.max(...products.map((p) => p.cashbackPercent))
        : 0,
    [products],
  );

  const stat = (loading: boolean, value: string) => (loading ? '—' : value);

  const openStoreCatalog = (store: {
    id: string;
    partnerId: string;
    city: string;
    state: string;
  }) => {
    const qs = new URLSearchParams({
      partnerId: store.partnerId,
      city: store.city,
      state: store.state,
      store: store.id,
    });
    navigate(`/produtos?${qs.toString()}`);
  };

  return (
    <div className="home stack">
      <section className="home__hero">
        <div>
          <span className="badge badge-primary">
            OpenDriverHub · marketplace de parceiros
          </span>
          <h1>
            Produtos, vouchers e serviços de parceiros locais —
            <span className="home__hero-highlight">
              {' '}
              com cashback em todas as compras.
            </span>
          </h1>
          <p className="text-muted">
            Compre uma vez, retire onde quiser. Receba parte do valor de volta
            para usar na próxima aquisição.
          </p>
          <div className="row" style={{ marginTop: 'var(--space-4)' }}>
            <Link to="/cadastro">
              <Button size="lg">Criar conta grátis</Button>
            </Link>
            <Link to="/catalogo">
              <Button size="lg" variant="secondary">
                Ver catálogo
              </Button>
            </Link>
          </div>
        </div>
        <div className="home__hero-stats">
          <div>
            <strong>
              {stat(partnersQuery.isLoading, String(activePartners))}
            </strong>
            <small>parceiros ativos</small>
          </div>
          <div>
            <strong>{stat(storesQuery.isLoading, String(stores.length))}</strong>
            <small>pontos físicos</small>
          </div>
          <div>
            <strong>
              {stat(
                productsQuery.isLoading,
                maxCashback > 0 ? `até ${formatPercent(maxCashback)}` : '—',
              )}
            </strong>
            <small>de cashback</small>
          </div>
        </div>
      </section>

      <section className="home__map-section">
        <header className="row-between">
          <div>
            <h2>Parceiros pertinho de você</h2>
            <p className="text-muted">
              Encontre lojas físicas onde você pode usar o seu voucher ou
              retirar o produto.
            </p>
          </div>
          <div className="row">
            {geoStatus && <span className="text-soft">{geoStatus}</span>}
            <Button variant="secondary" onClick={useMyLocation}>
              📍 Usar minha localização
            </Button>
            {nearby && (
              <Button
                variant="ghost"
                onClick={() => {
                  setNearby(null);
                  setGeoStatus(null);
                }}
              >
                Ver todos
              </Button>
            )}
          </div>
        </header>
        <QueryState
          loading={storesQuery.isLoading}
          error={storesQuery.error}
          empty={(nearby ?? stores).length === 0}
          variant="list"
          emptyLabel={
            nearby
              ? 'Nenhum ponto físico próximo.'
              : 'Nenhum ponto físico cadastrado ainda.'
          }
        >
          <StoreMap
            stores={nearby ?? stores}
            height={380}
            onStoreSelect={openStoreCatalog}
            selectLabel="Ver ofertas deste local"
          />
        </QueryState>
      </section>

      <section id="catalogo" className="home__catalog">
        <header className="row-between">
          <div>
            <h2>Catálogo</h2>
            <p className="text-muted">
              {productsQuery.isLoading
                ? 'Carregando ofertas...'
                : `${products.length} ofertas de ${activePartners} parceiro(s).`}
            </p>
          </div>
          <input
            className="home__search"
            placeholder="Buscar produto ou parceiro..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>

        <div className="home__categories">
          {categories.map((c) => (
            <button
              key={c}
              className={`home__chip ${category === c ? 'is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <QueryState
          loading={productsQuery.isLoading}
          error={productsQuery.error}
          empty={filtered.length === 0}
          variant="cards"
          emptyLabel="Nenhum produto encontrado."
        >
          <div className="home__grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </QueryState>
      </section>
    </div>
  );
}
