import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import { Logo } from '@shared/components/Logo/Logo';
import { Icon } from '@shared/components/Icon/Icon';
import './Layouts.css';

export function FinanceiroLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="layout-internal layout-internal--admin">
      <aside className="layout-internal__sidebar">
        <div className="layout-internal__bar">
          <div className="layout-internal__brand">
            <Logo subtitle="Financeiro" size={34} />
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
          <NavLink to="/financeiro" end>
            <Icon name="banknote" size={17} /> Saques
          </NavLink>
          <NavLink to="/financeiro/afiliados">
            <Icon name="handshake" size={17} /> Afiliados
          </NavLink>
          <NavLink to="/financeiro/perfil">
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
