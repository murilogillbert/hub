import { Link } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { resolveImageUrl } from '@shared/api/client';
import './SidebarUser.css';

const PROFILE_ROUTE_BY_ROLE: Record<string, string> = {
  partner: '/parceiro/perfil',
  admin: '/admin/perfil',
  financeiro: '/financeiro/perfil',
};

/** Cartão do usuário logado no rodapé do menu lateral — leva pra tela de
 * perfil completa da área atual (Admin/Parceiro/Financeiro têm cada uma a
 * sua, todas construídas com os mesmos blocos de src/shared/components/AccountSettings). */
export function SidebarUser() {
  const { user } = useAuth();
  if (!user) return null;

  const profileRoute = PROFILE_ROUTE_BY_ROLE[user.role] ?? '/';

  return (
    <Link to={profileRoute} className="layout-internal__user sidebar-user" title="Meu perfil">
      <img src={resolveImageUrl(user.avatarUrl) || user.avatarUrl} alt={user.name} />
      <div>
        <strong>{user.name}</strong>
        <small>{user.email}</small>
      </div>
      <span className="sidebar-user__edit" aria-hidden>
        →
      </span>
    </Link>
  );
}
