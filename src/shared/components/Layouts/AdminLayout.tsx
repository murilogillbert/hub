import { NavLink, Outlet } from 'react-router-dom';
import { SidebarUser } from '@shared/components/SidebarUser/SidebarUser';
import './Layouts.css';

export function AdminLayout() {
  return (
    <div className="layout-internal layout-internal--admin">
      <aside className="layout-internal__sidebar">
        <div className="layout-internal__brand">
          <span className="layout-internal__logo">◇</span>
          <div>
            <strong>OpenDriverHub</strong>
            <small>Administração</small>
          </div>
        </div>
        <nav className="layout-internal__nav">
          <NavLink to="/admin" end>
            📊 Dashboard
          </NavLink>
          <NavLink to="/admin/vendas">💳 Análise de vendas</NavLink>
          <NavLink to="/admin/parceiros">🤝 Parceiros</NavLink>
          <NavLink to="/admin/usuarios">👥 Usuários</NavLink>
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
