import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Logo } from '@shared/components/Logo/Logo';
import { authApi } from '@shared/api/endpoints';
import './AuthPages.css';

type State = 'checking' | 'ok' | 'error';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('checking');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode/dev roda efeitos 2x — token é de uso único
    ran.current = true;
    if (!token) {
      setState('error');
      return;
    }
    authApi
      .confirmEmailVerification(token)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <Logo size={56} />
        </div>
        {state === 'checking' && <h2>Confirmando seu e-mail...</h2>}
        {state === 'ok' && (
          <>
            <h2>E-mail confirmado!</h2>
            <p className="text-muted">
              Tudo certo — sua conta já pode fazer pagamentos e saques normalmente.
            </p>
          </>
        )}
        {state === 'error' && (
          <>
            <h2>Link inválido ou expirado</h2>
            <p className="text-muted">
              Faça login e use a opção de reenviar o e-mail de confirmação.
            </p>
          </>
        )}
        <p className="auth-page__alt">
          <Link to="/login">Ir para o login</Link>
        </p>
      </div>
    </div>
  );
}
