import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import './Layouts.css';

export function PartnerLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="layout-internal">
      <aside className="layout-internal__sidebar">
        <div className="layout-internal__bar">
          <div className="layout-internal__brand">
            <span className="layout-internal__logo">◇</span>
            <div>
              <strong>OpenDriverHub</strong>
              <small>Painel do parceiro</small>
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
          <NavLink to="/parceiro/catalogo" end>
            🧾 Catálogo
          </NavLink>
          <NavLink to="/parceiro/venda">📷 Resgate / Venda</NavLink>
          <NavLink to="/parceiro/metricas">📊 Métricas</NavLink>
        </nav>
        <SidebarUser />
      </aside>
      <main className="layout-internal__main">
        <Outlet />
      </main>
    </div>
  );
}
