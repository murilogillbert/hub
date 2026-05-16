import { FormEvent, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { authApi } from '@shared/api/endpoints';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import './StepUpGuard.css';

interface StepUpGuardProps {
  children: ReactNode;
  /** Texto exibido no card de confirmação. */
  reason?: string;
}

/**
 * Exige que o usuário reconfirme a senha antes de acessar a área protegida.
 * Pede a senha a cada entrada (o estado vive enquanto o componente está
 * montado; ao sair e voltar à rota, pede de novo).
 */
export function StepUpGuard({
  children,
  reason = 'Por segurança, confirme sua senha para acessar esta área.',
}: StepUpGuardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (confirmed) return <>{children}</>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      // Verifica a senha sem mexer na sessão atual (não grava tokens).
      await authApi.login(user.email, password);
      setConfirmed(true);
    } catch {
      setError('Senha incorreta. Tente novamente.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <div className="stepup">
      <form className="stepup__card" onSubmit={handleSubmit}>
        <span className="stepup__icon" aria-hidden>
          🔒
        </span>
        <h2>Confirmação necessária</h2>
        <p className="text-muted">{reason}</p>
        <Input
          label={`Senha de ${user?.email ?? ''}`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <small className="input-field__error">{error}</small>}
        <div className="stepup__actions">
          <Button type="submit" disabled={busy || !password} fullWidth>
            {busy ? 'Verificando...' : 'Confirmar e continuar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Voltar
          </Button>
        </div>
      </form>
    </div>
  );
}
