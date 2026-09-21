import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import { Logo } from '@shared/components/Logo/Logo';
import { Icon } from '@shared/components/Icon/Icon';
import './Layouts.css';

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="layout-internal layout-internal--admin">
      <aside className="layout-internal__sidebar">
        <div className="layout-internal__bar">
          <div className="layout-internal__brand">
            <Logo subtitle="Administração" size={34} />
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
          <span className="layout-internal__nav-label">Visão geral</span>
          <NavLink to="/admin" end>
            <Icon name="layoutGrid" size={17} /> Dashboard
          </NavLink>
          <NavLink to="/admin/vendas">
            <Icon name="creditCard" size={17} /> Análise de vendas
          </NavLink>

          <span className="layout-internal__nav-label">Parceiros</span>
          <NavLink to="/admin/parceiros">
            <Icon name="handshake" size={17} /> Parceiros
          </NavLink>
          <NavLink to="/admin/repasses">
            <Icon name="banknote" size={17} /> Repasses
          </NavLink>
          <NavLink to="/admin/unidades">
            <Icon name="store" size={17} /> Unidades
          </NavLink>

          <span className="layout-internal__nav-label">Afiliados</span>
          <NavLink to="/admin/afiliados/solicitacoes">
            <Icon name="briefcase" size={17} /> Solicitações
          </NavLink>
          <NavLink to="/admin/afiliados/materiais">
            <Icon name="package" size={17} /> Materiais de campanha
          </NavLink>
          <NavLink to="/admin/afiliados/chaves-api">
            <Icon name="key" size={17} /> Chaves de API
          </NavLink>

          <span className="layout-internal__nav-label">Sistema</span>
          <NavLink to="/admin/usuarios">
            <Icon name="users" size={17} /> Usuários
          </NavLink>
          <NavLink to="/admin/categorias">
            <Icon name="tag" size={17} /> Categorias
          </NavLink>
          <NavLink to="/admin/integracoes">
            <Icon name="plug" size={17} /> Integrações
          </NavLink>
          <NavLink to="/admin/auditoria">
            <Icon name="clipboard" size={17} /> Auditoria
          </NavLink>
          <NavLink to="/admin/perfil">
            <Icon name="user" size={17} /> Meu perfil
          </NavLink>
        </nav>
        <SidebarUser />
      </aside>
      <main className="layout-internal__main">
        <Outlet />
      </main>
    </div>
  );
}
