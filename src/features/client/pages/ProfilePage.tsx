import { useState } from 'react';
import { useAuth } from '@shared/hooks/useAuth';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { formatCurrency } from '@shared/utils/formatters';
import { authApi } from '@shared/api/endpoints';
import './ClientArea.css';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [notif, setNotif] = useState({ whatsapp: true, email: true, promo: false });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const saveProfile = async () => {
    const updated = await authApi.updateProfile({ name, email, phone });
    setUser(updated);
    setSavedMsg('Perfil atualizado!');
    window.setTimeout(() => setSavedMsg(null), 2000);
  };

  const saveNotifications = async () => {
    await authApi.updateNotifications({
      whatsApp: notif.whatsapp,
      email: notif.email,
      promo: notif.promo,
    });
    setSavedMsg('Preferências salvas!');
    window.setTimeout(() => setSavedMsg(null), 2000);
  };

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Minha conta</h2>
          <p className="text-muted">Atualize suas informações e preferências.</p>
        </div>
      </header>

      <div className="profile">
        <Card>
          <div className="profile__top">
            <img src={user?.avatarUrl} alt={user?.name} className="profile__avatar" />
            <div>
              <strong>{user?.name}</strong>
              <small className="text-muted">{user?.email}</small>
              <span className="badge badge-accent" style={{ marginTop: 8 }}>
                Saldo: {formatCurrency(user?.cashbackBalance ?? 0)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h3>Dados pessoais</h3>
          <div className="profile__form">
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="row" style={{ marginTop: 12 }}>
              <Button onClick={saveProfile}>Salvar alterações</Button>
              {savedMsg && (
                <span className="badge badge-accent">{savedMsg}</span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h3>Notificações</h3>
          <div className="profile__notif">
            <label>
              <input
                type="checkbox"
                checked={notif.whatsapp}
                onChange={(e) => setNotif((n) => ({ ...n, whatsapp: e.target.checked }))}
              />
              Receber confirmações por WhatsApp
            </label>
            <label>
              <input
                type="checkbox"
                checked={notif.email}
                onChange={(e) => setNotif((n) => ({ ...n, email: e.target.checked }))}
              />
              Receber confirmações por e-mail
            </label>
            <label>
              <input
                type="checkbox"
                checked={notif.promo}
                onChange={(e) => setNotif((n) => ({ ...n, promo: e.target.checked }))}
              />
              Receber ofertas e novidades
            </label>
            <Button onClick={saveNotifications} style={{ marginTop: 12 }}>
              Salvar preferências
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
