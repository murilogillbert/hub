import { ReactNode, useState } from 'react';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { useAuth } from '@shared/hooks/useAuth';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { isValidCpf, isValidPhone, maskCpf, maskPhone } from '@shared/utils/masks';
import { authApi, uploadsApi } from '@shared/api/endpoints';
import { resolveImageUrl } from '@shared/api/client';

/** Avatar + dados pessoais (nome/e-mail/telefone/CPF) — usado por todos os
 * papéis (Cliente, Parceiro, Afiliado, Admin, Financeiro), já que
 * /me/profile e o upload de imagem são agnósticos de papel. `extraBadge` é
 * pra informação específica do papel (ex.: saldo de cashback do Cliente). */
export function ProfileBasicsCard({ extraBadge }: { extraBadge?: ReactNode }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [cpf, setCpf] = useState(user?.cpf ?? '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const phoneError = phone && !isValidPhone(phone) ? 'Telefone incompleto.' : undefined;
  const cpfError = cpf && !isValidCpf(cpf) ? 'CPF incompleto.' : undefined;

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true);
    try {
      const url = await uploadsApi.image(file);
      const updated = await authApi.updateProfile({ name, email, phone, cpf, avatarUrl: url });
      setUser(updated);
      toast.success('Foto atualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar a foto.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveProfile = async () => {
    if (phoneError || cpfError) return;
    try {
      const updated = await authApi.updateProfile({ name, email, phone, cpf });
      setUser(updated);
      setSavedMsg('Perfil atualizado!');
      toast.success('Perfil atualizado.');
      window.setTimeout(() => setSavedMsg(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar perfil.');
    }
  };

  return (
    <>
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
            {extraBadge}
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
          <Input
            label="CPF"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            error={cpfError}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <Button onClick={saveProfile}>Salvar alterações</Button>
            {savedMsg && <span className="badge badge-accent">{savedMsg}</span>}
          </div>
        </div>
      </Card>
    </>
  );
}

export function PasswordCard() {
  const toast = useToast();
  const [password, setPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const changePassword = async () => {
    if (password.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      toast.error('A confirmação da senha não confere.');
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
    <Card>
      <h3>Trocar senha</h3>
      <div className="profile__form">
        <Input
          label="Senha atual"
          type="password"
          value={password.currentPassword}
          onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))}
        />
        <Input
          label="Nova senha"
          type="password"
          value={password.newPassword}
          onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
          error={
            password.newPassword && password.newPassword.length < 6
              ? 'Mínimo de 6 caracteres.'
              : undefined
          }
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          value={password.confirmPassword}
          onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))}
          error={
            password.confirmPassword && password.confirmPassword !== password.newPassword
              ? 'As senhas não conferem.'
              : undefined
          }
        />
        <Button onClick={changePassword}>Alterar senha</Button>
      </div>
    </Card>
  );
}

export function NotificationsCard() {
  const { user } = useAuth();
  const toast = useToast();
  const [notif, setNotif] = useState({
    whatsapp: user?.notifyWhatsApp ?? true,
    email: user?.notifyEmail ?? true,
    promo: user?.notifyPromo ?? false,
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const saveNotifications = async () => {
    try {
      await authApi.updateNotifications({
        whatsApp: notif.whatsapp,
        email: notif.email,
        promo: notif.promo,
      });
      setSavedMsg('Preferências salvas!');
      toast.success('Preferências salvas.');
      window.setTimeout(() => setSavedMsg(null), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar preferências.');
    }
  };

  return (
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
        <div className="row" style={{ marginTop: 12 }}>
          <Button onClick={saveNotifications}>Salvar preferências</Button>
          {savedMsg && <span className="badge badge-accent">{savedMsg}</span>}
        </div>
      </div>
    </Card>
  );
}
