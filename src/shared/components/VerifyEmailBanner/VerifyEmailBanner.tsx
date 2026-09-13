import { useState } from 'react';
import { useAuth } from '@shared/hooks/useAuth';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { authApi } from '@shared/api/endpoints';
import './VerifyEmailBanner.css';

/** Aviso persistente pra quem ainda não confirmou o e-mail — o login continua
 * liberado, mas pagamento e saque de afiliado exigem a confirmação. */
export function VerifyEmailBanner() {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isAuthenticated || !user || user.emailVerifiedAt) return null;

  const resend = async () => {
    setBusy(true);
    try {
      await authApi.resendVerification(user.email);
      setSent(true);
      toast.success('E-mail de confirmação reenviado.');
    } catch {
      toast.error('Não foi possível reenviar agora. Tente de novo em instantes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="verify-email-banner">
      <span>
        ✉️ Confirme seu e-mail ({user.email}) para poder pagar e sacar na plataforma.
      </span>
      <button type="button" onClick={resend} disabled={busy || sent}>
        {sent ? 'Enviado!' : busy ? 'Enviando...' : 'Reenviar e-mail'}
      </button>
    </div>
  );
}
