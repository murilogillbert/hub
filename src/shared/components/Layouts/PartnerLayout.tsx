import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import { Logo } from '@shared/components/Logo/Logo';
import { affiliateApi } from '@shared/api/endpoints';
import './Layouts.css';

export function PartnerLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Define se este parceiro é uma loja do marketplace ou um afiliado do
  // programa solar — os dois papéis dividem a mesma área /parceiro mas com
  // menus completamente diferentes.
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  const isAffiliate = meQuery.data?.kind === 'solar_affiliate';

  return (
    <div className="layout-internal">
      <aside className="layout-internal__sidebar">
        <div className="layout-internal__bar">
          <div className="layout-internal__brand">
            <Logo subtitle={isAffiliate ? 'Área do afiliado' : 'Painel do parceiro'} size={34} />
          </div>
          <button
            type="button"
            className="layout-internal__burger"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
        <nav
          className={`layout-internal__nav ${open ? 'is-open' : ''}`}
          onClick={close}
        >
          {isAffiliate ? (
            <>
              <NavLink to="/parceiro/afiliado/carteira" end>
                💰 Carteira
              </NavLink>
              <NavLink to="/parceiro/afiliado/saque">Solicitar saque</NavLink>
              <NavLink to="/parceiro/afiliado/materiais">📦 Materiais</NavLink>
              <NavLink to="/parceiro/afiliado/link">🔗 Meu link</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/parceiro/catalogo" end>
                🧾 Catálogo
              </NavLink>
              <NavLink to="/parceiro/unidades">Unidades</NavLink>
              <NavLink to="/parceiro/venda">📷 Resgate / Venda</NavLink>
              <NavLink to="/parceiro/metricas">📊 Métricas</NavLink>
            </>
          )}
        </nav>
        <SidebarUser />
      </aside>
      <main className="layout-internal__main">
        <Outlet />
      </main>
    </div>
  );
}

/** Rota índice de /parceiro — manda pro catálogo (loja) ou pra carteira
 * (afiliado solar) conforme o tipo do parceiro logado. */
export function PartnerIndexRedirect() {
  const meQuery = useQuery({ queryKey: ['affiliate-me'], queryFn: () => affiliateApi.me() });
  if (meQuery.isLoading) return null;
  return (
    <Navigate
      to={meQuery.data?.kind === 'solar_affiliate' ? 'afiliado/carteira' : 'catalogo'}
      replace
    />
  );
}
