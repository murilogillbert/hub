import { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { formatCurrency } from '@shared/utils/formatters';
import { FloatingAssistant } from '@features/assistant/components/FloatingAssistant';
import './Layouts.css';

interface ClientLayoutProps {
  children?: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="layout-client">
      <header className="layout-client__header">
        <div className="container layout-client__top">
          <Link to="/" className="layout-client__brand">
            <span className="layout-client__logo">◇</span>
            <span>OpenDriverHub</span>
          </Link>
          <nav className="layout-client__nav">
            <NavLink to="/" end>
              Início
            </NavLink>
            <NavLink to="/produtos">Catálogo</NavLink>
            {isAuthenticated && <NavLink to="/conta/itens">Meus itens</NavLink>}
            {isAuthenticated && <NavLink to="/conta/historico">Histórico</NavLink>}
          </nav>
          <div className="layout-client__user">
            {isAuthenticated && user ? (
              <>
                <span className="badge badge-accent">
                  Cashback: {formatCurrency(user.cashbackBalance)}
                </span>
                <Link to="/conta/perfil" className="layout-client__avatar">
                  <img src={user.avatarUrl} alt={user.name} />
                </Link>
                <button onClick={handleLogout} className="layout-client__logout">
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="layout-client__login">
                  Entrar
                </Link>
                <Link to="/cadastro" className="layout-client__signup">
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="layout-client__main">
        <div className="container">{children ?? <Outlet />}</div>
      </main>

      <footer className="layout-client__footer">
        <div className="container row-between">
          <small>&copy; {new Date().getFullYear()} OpenDriverHub</small>
          <small className="text-soft">Hub de parceiros com cashback</small>
        </div>
      </footer>

      <FloatingAssistant />
    </div>
  );
}
