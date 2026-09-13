import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { Logo } from '@shared/components/Logo/Logo';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { authApi } from '@shared/api/endpoints';
import './AuthPages.css';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const passwordError = password && password.length < 6 ? 'Mínimo de 6 caracteres.' : undefined;
  const confirmError = confirm && confirm !== password ? 'As senhas não conferem.' : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Link inválido — solicite um novo.');
      return;
    }
    if (password.length < 6 || password !== confirm) return;
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      toast.success('Senha redefinida. Faça login com a nova senha.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link inválido ou expirado.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <Logo size={56} />
        </div>
        <h2>Criar nova senha</h2>
        {!token ? (
          <p className="text-muted">
            Link inválido.{' '}
            <Link to="/esqueci-senha">Solicite um novo link</Link>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="stack" style={{ marginTop: 'var(--space-4)' }}>
            <Input
              label="Nova senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              required
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={confirmError}
              required
            />
            <Button type="submit" size="lg" fullWidth disabled={busy}>
              {busy ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </form>
        )}
        <p className="auth-page__alt">
          <Link to="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
