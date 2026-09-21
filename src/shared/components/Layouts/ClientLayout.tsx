import { ReactNode, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { useCart } from '@shared/context/CartContext';
import { formatCurrency } from '@shared/utils/formatters';
import { resolveImageUrl } from '@shared/api/client';
import { FloatingAssistant } from '@features/assistant/components/FloatingAssistant';
import { NotificationsBell } from '@shared/components/NotificationsBell/NotificationsBell';
import { Logo } from '@shared/components/Logo/Logo';
import { Icon } from '@shared/components/Icon/Icon';
import { VerifyEmailBanner } from '@shared/components/VerifyEmailBanner/VerifyEmailBanner';
import './Layouts.css';

interface ClientLayoutProps {
  children?: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/');
  };

  return (
    <div className="layout-client">
      <header className="layout-client__header">
        <div className="container layout-client__top">
          <Link to="/" className="layout-client__brand" onClick={closeMenu}>
            <Logo size={34} />
          </Link>
          <button
            type="button"
            className="layout-client__burger"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
          </button>
          <nav
            className={`layout-client__nav ${menuOpen ? 'is-open' : ''}`}
            onClick={closeMenu}
          >
            <NavLink to="/" end>
              Início
            </NavLink>
            <NavLink to="/produtos">Catálogo</NavLink>
            <NavLink to="/carrinho">
              Carrinho{cart.count > 0 ? ` (${cart.count})` : ''}
            </NavLink>
            {isAuthenticated && <NavLink to="/conta/itens">Meus itens</NavLink>}
            {isAuthenticated && <NavLink to="/conta/historico">Histórico</NavLink>}
            {isAuthenticated && <NavLink to="/conta/cashback">Meu cashback</NavLink>}
          </nav>
          <div className="layout-client__user">
            {isAuthenticated && user ? (
              <>
                <span className="badge badge-accent">
                  Cashback: {formatCurrency(user.cashbackBalance)}
                </span>
                <NotificationsBell />
                <Link to="/conta/perfil" className="layout-client__avatar">
                  <img src={resolveImageUrl(user.avatarUrl) || user.avatarUrl} alt={user.name} />
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

      <VerifyEmailBanner />

      <main className="layout-client__main">
        <div className="container">{children ?? <Outlet />}</div>
      </main>

      <footer className="layout-client__footer">
        <div className="container row-between">
          <small>&copy; {new Date().getFullYear()} OpenDriverHub</small>
          <Link to="/lucro-real-motorista" className="layout-client__footer-link">
            Motorista, descubra se seu dia compensou →
          </Link>
          <Link to="/afiliados" className="layout-client__footer-link">
            Quero ser afiliado (energia solar) →
          </Link>
          <small className="text-soft">Hub de parceiros com cashback</small>
        </div>
      </footer>

      <FloatingAssistant />
    </div>
  );
}
