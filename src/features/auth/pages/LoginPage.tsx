import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { useAuth } from '@shared/hooks/useAuth';
import { routeForRole } from '@shared/context/AuthContext';
import './AuthPages.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, role } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rota de origem (ex.: /checkout/:id) preservada pelo guard.
  const from = (location.state as { from?: string } | null)?.from ?? null;

  // Já autenticado? Volta para a origem ou para a área do papel.
  useEffect(() => {
    if (isAuthenticated)
      navigate(from ?? routeForRole(role), { replace: true });
  }, [isAuthenticated, role, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(from ?? routeForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <h2>Entrar</h2>
        <p className="text-muted">
          Use seu e-mail e senha. Você é direcionado automaticamente para a sua
          área (cliente, parceiro ou administrador).
        </p>
        <form
          onSubmit={handleSubmit}
          className="stack"
          style={{ marginTop: 'var(--space-4)' }}
        >
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <small className="input-field__error">{error}</small>}
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="auth-page__alt">
          Contas demo: <code>cliente@demo.com</code> ·{' '}
          <code>parceiro@demo.com</code> · <code>admin@demo.com</code> (senha{' '}
          <code>Demo@123</code>)
        </p>
        <p className="auth-page__alt">
          Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
