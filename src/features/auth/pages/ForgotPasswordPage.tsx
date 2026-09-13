import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@shared/components/Button/Button';
import { Input } from '@shared/components/Input/Input';
import { Logo } from '@shared/components/Logo/Logo';
import { authApi } from '@shared/api/endpoints';
import './AuthPages.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      // Sempre mostra a mesma confirmação, exista ou não a conta — evita
      // revelar quais e-mails estão cadastrados.
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <Logo size={56} />
        </div>
        <h2>Esqueci minha senha</h2>
        {sent ? (
          <p className="text-muted">
            Se esse e-mail estiver cadastrado, você vai receber um link para
            redefinir sua senha em instantes.
          </p>
        ) : (
          <>
            <p className="text-muted">
              Informe o e-mail da sua conta. Vamos enviar um link para você
              criar uma nova senha.
            </p>
            <form onSubmit={handleSubmit} className="stack" style={{ marginTop: 'var(--space-4)' }}>
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" size="lg" fullWidth disabled={busy}>
                {busy ? 'Enviando...' : 'Enviar link'}
              </Button>
            </form>
          </>
        )}
        <p className="auth-page__alt">
          <Link to="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
