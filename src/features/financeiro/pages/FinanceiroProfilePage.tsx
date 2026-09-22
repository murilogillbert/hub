import {
  LogoutCard,
  NotificationsCard,
  PasswordCard,
  ProfileBasicsCard,
} from '@shared/components/AccountSettings/AccountSettingsCards';
import '../../admin/pages/AdminPages.css';

export function FinanceiroProfilePage() {
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Meu perfil</h2>
          <p className="text-muted">Seus dados pessoais, senha e preferências de notificação.</p>
        </div>
      </header>

      <div className="profile">
        <ProfileBasicsCard />
        <PasswordCard />
        <NotificationsCard />
        <LogoutCard />
      </div>
    </div>
  );
}
