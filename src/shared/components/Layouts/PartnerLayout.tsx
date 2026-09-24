import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import { Logo } from '@shared/components/Logo/Logo';
import { Icon } from '@shared/components/Icon/Icon';
import { VerifyEmailBanner } from '@shared/components/VerifyEmailBanner/VerifyEmailBanner';
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
            <Icon name={open ? 'x' : 'menu'} size={20} />
          </button>
        </div>
        <nav
          className={`layout-internal__nav ${open ? 'is-open' : ''}`}
          onClick={close}
        >
          {isAffiliate ? (
            <>
              <NavLink to="/parceiro/afiliado/carteira" end>
                <Icon name="wallet" size={17} /> Carteira
              </NavLink>
              <NavLink to="/parceiro/afiliado/saque">
                <Icon name="banknote" size={17} /> Solicitar saque
              </NavLink>
              <NavLink to="/parceiro/afiliado/materiais">
                <Icon name="package" size={17} /> Materiais
              </NavLink>
              <NavLink to="/parceiro/afiliado/link">
                <Icon name="link" size={17} /> Meu link
              </NavLink>
              <NavLink to="/parceiro/perfil">
                <Icon name="user" size={17} /> Meu perfil
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/parceiro/catalogo" end>
                <Icon name="receipt" size={17} /> Catálogo
              </NavLink>
              <NavLink to="/parceiro/unidades">
                <Icon name="store" size={17} /> Unidades
              </NavLink>
              <NavLink to="/parceiro/venda">
                <Icon name="camera" size={17} /> Resgate / Venda
              </NavLink>
              <NavLink to="/parceiro/afiliados-motoristas">
                <Icon name="handshake" size={17} /> Motoristas afiliados
              </NavLink>
              <NavLink to="/parceiro/metricas">
                <Icon name="chart" size={17} /> Métricas
              </NavLink>
              <NavLink to="/parceiro/perfil">
                <Icon name="user" size={17} /> Meu perfil
              </NavLink>
              <NavLink to="/produtos">
                <Icon name="cart" size={17} /> Comprar no hub
              </NavLink>
            </>
          )}
        </nav>
        <SidebarUser />
      </aside>
      <main className="layout-internal__main">
        <VerifyEmailBanner />
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
