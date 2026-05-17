import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { useAuth } from '@shared/hooks/useAuth';
import { routeForRole } from '@shared/context/AuthContext';
import { isValidCpf, maskCpf } from '@shared/utils/masks';
import './AuthPages.css';

export function RegisterClientPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    cpf: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.cpf && !isValidCpf(form.cpf)) {
      setError('CPF incompleto.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const user = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        cpf: form.cpf,
      });
      navigate(routeForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <Link to="/cadastro" className="auth-page__back">
          ← Voltar
        </Link>
        <h2>Cadastro de cliente</h2>
        <p className="text-muted">É grátis. Comece a acumular cashback hoje.</p>
        <form
          onSubmit={handleSubmit}
          className="stack"
          style={{ marginTop: 'var(--space-4)' }}
        >
          <Input
            label="Nome completo"
            value={form.name}
            onChange={update('name')}
            required
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={update('email')}
            required
          />
          <Input
            label="CPF"
            value={form.cpf}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, cpf: maskCpf(e.target.value) }))
            }
            placeholder="000.000.000-00"
            error={form.cpf && !isValidCpf(form.cpf) ? 'CPF incompleto.' : undefined}
          />
          <Input
            label="Senha"
            type="password"
            value={form.password}
            onChange={update('password')}
            required
          />
          {error && <small className="input-field__error">{error}</small>}
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'Criando...' : 'Criar conta de cliente'}
          </Button>
        </form>
        <p className="auth-page__alt">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
