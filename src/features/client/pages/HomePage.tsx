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

// Ícones inline (mantém zero dependência nova). Estilo: stroke 2.
const I = {
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 11l-8 8a2 2 0 0 1-2.8 0L3 12.3V3.5h8.8L20.5 11z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 1 1 3 6.7L21 17l-3 3-4-3.3a4 4 0 0 1-6.7-3" />
      <path d="M9 5l-4 4 3 3 4-4z" />
    </svg>
  ),
  handshake: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l4-4 4 4-2 2 4 4 6-6-4-4 2-2-4-4-4 4" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l2-4h14l2 4" />
      <path d="M3 7v13h18V7" />
      <path d="M3 7c0 2 1 3 3 3s3-1 3-3 1 3 3 3 3-1 3-3 1 3 3 3 3-1 3-3" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M14 9a3 3 0 0 0-6 0c0 4 6 2 6 6a3 3 0 0 1-6 0" />
      <line x1="12" y1="6" x2="12" y2="18" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 16h14l-2-6H7l-2 6z" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="17" r="1.5" />
    </svg>
  ),
};

const ADVANTAGES = [
  {
    icon: I.tag,
    title: 'Descontos Exclusivos',
    text: 'Economize em combustível, manutenção, pneus, lavagem e muito mais.',
  },
  {
    icon: I.wrench,
    title: 'Serviços Automotivos',
    text: 'Oficinas, centros automotivos e serviços perto de você.',
  },
  {
    icon: I.handshake,
    title: 'Parceiros Confiáveis',
    text: 'Rede de empresas parceiras selecionadas para oferecer o melhor.',
  },
  {
    icon: I.chart,
    title: 'Mais Ganhos',
    text: 'Aumente sua renda com oportunidades e indicações exclusivas.',
  },
];

const STEPS = [
  { icon: I.phone, title: '1. Cadastre-se', text: 'Crie sua conta de motorista.' },
  { icon: I.tag, title: '2. Aproveite', text: 'Acesse descontos e serviços exclusivos.' },
  { icon: I.store, title: '3. Use e economize', text: 'Utilize os serviços dos nossos parceiros.' },
  { icon: I.money, title: '4. Ganhe mais', text: 'Aumente seus ganhos com oportunidades.' },
];

const AUDIENCE = [
  { icon: I.car, label: 'Motoristas de aplicativos', desc: 'de todas as plataformas' },
  { icon: I.store, label: 'Frotistas e gestores', desc: 'de transporte' },
  { icon: I.handshake, label: 'Empresas e parceiros', desc: 'do setor automotivo' },
];

const PARTNERS_DEMO = [
  'Ipiranga',
  'PneuStore',
  'Lubrax+',
  'Wizard',
  'LavaJá',
  'Porto Seguro',
];

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

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => catalogApi.products() });
  const storesQuery = useQuery({ queryKey: ['stores'], queryFn: () => catalogApi.stores() });
  const partnersQuery = useQuery({ queryKey: ['partners'], queryFn: () => catalogApi.partners() });

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

  const activePartners = useMemo(
    () => partners.filter((p) => p.active).length,
    [partners],
  );
  const maxCashback = useMemo(
    () =>
      products.length ? Math.max(...products.map((p) => p.cashbackPercent)) : 0,
    [products],
  );
  const cities = useMemo(
    () =>
      new Set(stores.map((s) => `${s.city}/${s.state}`).filter((s) => s !== '/')),
    [stores],
  );

  const openStoreCatalog = (store: { id: string; partnerId: string; city: string; state: string }) => {
    const qs = new URLSearchParams({
      partnerId: store.partnerId,
      city: store.city,
      state: store.state,
      store: store.id,
    });
    navigate(`/produtos?${qs.toString()}`);
  };

  return (
    <div className="home">
      {/* ================= HERO ================= */}
      <section className="home__hero">
        <div className="home__hero-copy">
          <span className="eyebrow">OpenDriverHub · marketplace de parceiros</span>
          <h1>
            O hub completo de serviços e benefícios{' '}
            <span className="home__hero-highlight">
              para motoristas de aplicativos.
            </span>
          </h1>
          <p>
            Economize, ganhe mais e tenha tudo que você precisa em um só lugar.
          </p>
          <div className="row home__hero-ctas">
            <Link to="/cadastro/cliente">
              <Button size="lg">Sou Motorista →</Button>
            </Link>
            <Link to="/cadastro/parceiro">
              <Button size="lg" variant="secondary" className="on-dark">
                Quero ser Parceiro
              </Button>
            </Link>
          </div>
          <div className="home__hero-mini">
            <span><i className="home__hero-mini-i">{I.tag}</i> Descontos exclusivos</span>
            <span><i className="home__hero-mini-i">{I.handshake}</i> Parcerias confiáveis</span>
            <span><i className="home__hero-mini-i">{I.chart}</i> Mais ganhos para você</span>
          </div>
        </div>
        <div className="home__hero-visual">
          <div className="home__hero-badge home__hero-badge--1">
            <span>%</span>
            <strong>Descontos<br/>Exclusivos</strong>
          </div>
          <div className="home__hero-badge home__hero-badge--2">
            {I.wrench}
            <strong>Serviços<br/>Automotivos</strong>
          </div>
          <div className="home__hero-badge home__hero-badge--3">
            {I.money}
            <strong>Mais<br/>Ganhos</strong>
          </div>
        </div>
      </section>

      {/* ================= VANTAGENS ================= */}
      <section className="home__advantages">
        <header>
          <h2>
            Vantagens que fazem <span className="text-info">a diferença</span> no
            seu dia a dia
          </h2>
        </header>
        <div className="home__advantages-grid">
          {ADVANTAGES.map((a) => (
            <div key={a.title} className="home__advantage">
              <span className="home__icon-circle">{a.icon}</span>
              <strong>{a.title}</strong>
              <p>{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section className="home__how">
        <header>
          <h2>
            Como <span className="text-info">funciona</span>
          </h2>
        </header>
        <ol className="home__steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="home__step-circle">{s.icon}</span>
              <strong>{s.title}</strong>
              <small>{s.text}</small>
              {i < STEPS.length - 1 && <span className="home__step-arrow">›</span>}
            </li>
          ))}
        </ol>
      </section>

      {/* ================= PARA QUEM É + STATS ================= */}
      <section className="home__audience">
        <div className="home__audience-card">
          <h2>
            Para quem é o<br />
            <span className="text-lime">Open Driver Hub?</span>
          </h2>
          <ul>
            {AUDIENCE.map((a) => (
              <li key={a.label}>
                <span className="home__audience-i">{a.icon}</span>
                <div>
                  <strong>{a.label}</strong>
                  <small>{a.desc}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="home__stats">
          <div>
            <strong>{partners.length > 0 ? `+${partners.length}` : '+100'}</strong>
            <small>parceiros na rede</small>
          </div>
          <div>
            <strong>+{stores.length || 1500}</strong>
            <small>pontos físicos</small>
          </div>
          <div>
            <strong>+{cities.size || 300}</strong>
            <small>cidades atendidas</small>
          </div>
          <div>
            <strong>
              {maxCashback > 0 ? `até ${formatPercent(maxCashback)}` : 'até 15%'}
            </strong>
            <small>de cashback em compras</small>
          </div>
        </div>
      </section>

      {/* ================= PARCEIROS (ilustrativos) ================= */}
      <section className="home__partners">
        <header>
          <h2>Alguns dos nossos parceiros</h2>
          <p className="text-muted">Marcas de referência no setor automotivo.</p>
        </header>
        <div className="home__partners-grid">
          {PARTNERS_DEMO.map((p) => (
            <div key={p} className="home__partner">
              {p}
            </div>
          ))}
        </div>
        <small className="text-muted">E muitos outros...</small>
      </section>

      {/* ================= MAPA (existente) ================= */}
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
            nearby ? 'Nenhum ponto físico próximo.' : 'Nenhum ponto físico cadastrado ainda.'
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

      {/* ================= CATÁLOGO ================= */}
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

      {/* ================= FAIXA CTA FINAL ================= */}
      <section className="home__cta-band">
        <div>
          <span className="home__cta-shield">{I.shield}</span>
          <div>
            <strong>Segurança, confiança e tecnologia</strong>
            <small>para transformar o dia a dia de quem move o Brasil.</small>
          </div>
        </div>
        <div>
          <strong>Junte-se ao OpenDriverHub</strong>
          <small>e descubra um mundo de vantagens.</small>
        </div>
        <Link to="/cadastro">
          <Button size="lg" className="home__cta-band-btn">
            Cadastre-se grátis →
          </Button>
        </Link>
      </section>
    </div>
  );
}
