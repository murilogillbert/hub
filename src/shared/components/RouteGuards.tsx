import { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { routeForRole } from '@shared/context/AuthContext';
import { UserRole } from '@shared/types';

function Splash() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 'var(--space-7)',
        color: 'var(--color-text-muted)',
      }}
    >
      Carregando...
    </div>
  );
}

/** Protege rotas por papel. Sem login → /login guardando a rota de origem. */
export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children?: ReactNode;
}) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!isAuthenticated)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (!roles.includes(role))
    return <Navigate to={routeForRole(role)} replace />;
  return <>{children ?? <Outlet />}</>;
}

/** Em /login e /cadastro/*, se já autenticado, manda para a rota de
 *  origem (se houver) ou para a área do papel. */
export function RedirectIfAuthenticated({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? routeForRole(role)} replace />;
  }
  return <>{children}</>;
}
