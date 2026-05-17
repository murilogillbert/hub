import { useState } from 'react';
import { useAuth } from '@shared/hooks/useAuth';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency } from '@shared/utils/formatters';
import { isValidPhone, maskPhone } from '@shared/utils/masks';
import { authApi, uploadsApi } from '@shared/api/endpoints';
import { resolveImageUrl } from '@shared/api/client';
import './ClientArea.css';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [notif, setNotif] = useState({ whatsapp: true, email: true, promo: false });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [password, setPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [avatarBusy, setAvatarBusy] = useState(false);
  const phoneError = phone && !isValidPhone(phone) ? 'Telefone incompleto.' : undefined;

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true);
    try {
      const url = await uploadsApi.image(file);
      const updated = await authApi.updateProfile({
        name,
        email,
        phone,
        avatarUrl: url,
      });
      setUser(updated);
      toast.success('Foto atualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar a foto.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveProfile = async () => {
    if (phoneError) return;
    try {
      const updated = await authApi.updateProfile({ name, email, phone });
      setUser(updated);
      setSavedMsg('Perfil atualizado!');
      toast.success('Perfil atualizado.');
      window.setTimeout(() => setSavedMsg(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar perfil.');
    }
  };

  const saveNotifications = async () => {
    try {
      await authApi.updateNotifications({
        whatsApp: notif.whatsapp,
        email: notif.email,
        promo: notif.promo,
      });
      setSavedMsg('Preferencias salvas!');
      toast.success('Preferencias salvas.');
      window.setTimeout(() => setSavedMsg(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar preferencias.');
    }
  };

  const changePassword = async () => {
    if (password.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      toast.error('A confirmacao da senha nao confere.');
      return;
    }
    try {
      await authApi.changePassword({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Senha alterada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alterar senha.');
    }
  };

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Minha conta</h2>
          <p className="text-muted">Atualize suas informacoes e preferencias.</p>
        </div>
      </header>

      <div className="profile">
        <Card>
          <div className="profile__top">
            <img
              src={resolveImageUrl(user?.avatarUrl) || user?.avatarUrl}
              alt={user?.name}
              className="profile__avatar"
            />
            <div>
              <strong>{user?.name}</strong>
              <small className="text-muted">{user?.email}</small>
              <span className="badge badge-accent" style={{ marginTop: 8 }}>
                Saldo: {formatCurrency(user?.cashbackBalance ?? 0)}
              </span>
              <label
                className="btn btn--secondary btn--sm"
                style={{ marginTop: 10, cursor: 'pointer', width: 'fit-content' }}
              >
                {avatarBusy ? 'Enviando...' : '📷 Trocar foto'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  disabled={avatarBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </Card>

        <Card>
          <h3>Dados pessoais</h3>
          <div className="profile__form">
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              label="Telefone"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              error={phoneError}
            />
            <div className="row" style={{ marginTop: 12 }}>
              <Button onClick={saveProfile}>Salvar alteracoes</Button>
              {savedMsg && <span className="badge badge-accent">{savedMsg}</span>}
            </div>
          </div>
        </Card>

        <Card>
          <h3>Trocar senha</h3>
          <div className="profile__form">
            <Input
              label="Senha atual"
              type="password"
              value={password.currentPassword}
              onChange={(e) =>
                setPassword((p) => ({ ...p, currentPassword: e.target.value }))
              }
            />
            <Input
              label="Nova senha"
              type="password"
              value={password.newPassword}
              onChange={(e) =>
                setPassword((p) => ({ ...p, newPassword: e.target.value }))
              }
              error={
                password.newPassword && password.newPassword.length < 6
                  ? 'Minimo de 6 caracteres.'
                  : undefined
              }
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              value={password.confirmPassword}
              onChange={(e) =>
                setPassword((p) => ({ ...p, confirmPassword: e.target.value }))
              }
              error={
                password.confirmPassword &&
                password.confirmPassword !== password.newPassword
                  ? 'As senhas nao conferem.'
                  : undefined
              }
            />
            <Button onClick={changePassword}>Alterar senha</Button>
          </div>
        </Card>

        <Card>
          <h3>Notificacoes</h3>
          <div className="profile__notif">
            <label>
              <input
                type="checkbox"
                checked={notif.whatsapp}
                onChange={(e) => setNotif((n) => ({ ...n, whatsapp: e.target.checked }))}
              />
              Receber confirmacoes por WhatsApp
            </label>
            <label>
              <input
                type="checkbox"
                checked={notif.email}
                onChange={(e) => setNotif((n) => ({ ...n, email: e.target.checked }))}
              />
              Receber confirmacoes por e-mail
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
              Salvar preferencias
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
