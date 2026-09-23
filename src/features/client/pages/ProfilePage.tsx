import { useAuth } from '@shared/hooks/useAuth';
import { formatCurrency } from '@shared/utils/formatters';
import {
  NotificationsCard,
  PasswordCard,
  ProfileBasicsCard,
} from '@shared/components/AccountSettings/AccountSettingsCards';
import { SurveyLinkCard } from '../components/SurveyLinkCard';
import { DriverAffiliateCard } from '../components/DriverAffiliateCard';
import './ClientArea.css';

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Minha conta</h2>
          <p className="text-muted">Atualize suas informacoes e preferencias.</p>
        </div>
      </header>

      <div className="profile">
        <ProfileBasicsCard
          extraBadge={
            <span className="badge badge-accent" style={{ marginTop: 8 }}>
              Saldo: {formatCurrency(user?.cashbackBalance ?? 0)}
            </span>
          }
        />
        <PasswordCard />
        <NotificationsCard />
        <SurveyLinkCard />
        {user?.role === 'driver' && <DriverAffiliateCard />}
      </div>
    </div>
  );
}
