import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import './Layouts.css';

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="layout-internal layout-internal--admin">
      <aside className="layout-internal__sidebar">
        <div className="layout-internal__bar">
          <div className="layout-internal__brand">
            <span className="layout-internal__logo">◇</span>
            <div>
              <strong>OpenDriverHub</strong>
              <small>Administração</small>
            </div>
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
          <NavLink to="/admin" end>
            📊 Dashboard
          </NavLink>
          <NavLink to="/admin/vendas">💳 Análise de vendas</NavLink>
          <NavLink to="/admin/parceiros">🤝 Parceiros</NavLink>
          <NavLink to="/admin/usuarios">👥 Usuários</NavLink>
          <NavLink to="/admin/categorias">🏷️ Categorias</NavLink>
          <NavLink to="/admin/integracoes">🔌 Integrações</NavLink>
        </nav>
        <SidebarUser />
      </aside>
      <main className="layout-internal__main">
        <Outlet />
      </main>
    </div>
  );
}
