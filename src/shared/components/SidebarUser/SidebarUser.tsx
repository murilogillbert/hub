import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@shared/hooks/useAuth';
import { authApi } from '@shared/api/endpoints';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import './SidebarUser.css';

/**
 * Bloco do usuário na sidebar (parceiro/admin). Ao clicar, abre um modal
 * para editar as informações do usuário autenticado no momento.
 */
export function SidebarUser() {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone ?? '');
      setError(null);
      setSaved(false);
    }
  }, [open, user]);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await authApi.updateProfile({ name, email, phone });
      setUser(updated);
      setSaved(true);
      window.setTimeout(() => setOpen(false), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="layout-internal__user sidebar-user"
        onClick={() => setOpen(true)}
        title="Editar minhas informações"
      >
        <img src={user.avatarUrl} alt={user.name} />
        <div>
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </div>
        <span className="sidebar-user__edit" aria-hidden>
          ✎
        </span>
      </button>

      {open && (
        <div
          className="sidebar-user__overlay"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="sidebar-user__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sidebar-user__modal-head">
              <h3>Minhas informações</h3>
              <button
                type="button"
                className="sidebar-user__close"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleSubmit} className="stack">
              <div className="sidebar-user__id">
                <img src={user.avatarUrl} alt={user.name} />
                <span className="badge badge-primary">{user.role}</span>
              </div>
              <Input
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
              />
              {error && (
                <small className="input-field__error">{error}</small>
              )}
              {saved && (
                <span className="badge badge-accent">✓ Salvo</span>
              )}
              <div className="row">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
