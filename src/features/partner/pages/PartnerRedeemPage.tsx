import { FormEvent, useState } from 'react';
import { useAuth } from '@shared/hooks/useAuth';
import { QrScanner } from '@shared/components/QrScanner/QrScanner';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency } from '@shared/utils/formatters';
import { partnerApi, RedeemResult } from '@shared/api/endpoints';
import './PartnerRedeemPage.css';

type Screen = 'home' | 'scan' | 'manual' | 'result';

export function PartnerRedeemPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [screen, setScreen] = useState<Screen>('home');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RedeemResult | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setScreen('home');
    setCodeInput('');
    setError(null);
    setSummary(null);
    setRedeemed(false);
    setBusy(false);
  };

  const handleLookup = async (rawCode: string) => {
    setError(null);
    setRedeemed(false);
    setSummary(null);
    setScreen('result');
    setBusy(true);
    try {
      const result = await partnerApi.redeem(rawCode, false);
      setSummary(result);
      toast.success('Voucher validado.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o código.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmRedeem = async () => {
    if (!summary) return;
    setBusy(true);
    try {
      await partnerApi.redeem(codeInput || '', true);
      setRedeemed(true);
      toast.success('Resgate confirmado.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao confirmar o resgate.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    handleLookup(codeInput);
  };

  return (
    <div className="totem">
      <div className="totem__shell">
        <header className="totem__brand">
          <span className="totem__logo">◇</span>
          <div>
            <strong>OpenDriverHub</strong>
            <small>Totem de resgate · {user?.name}</small>
          </div>
        </header>

        {/* ---------- HOME ---------- */}
        {screen === 'home' && (
          <div className="totem__stage">
            <h1 className="totem__title">Resgatar voucher</h1>
            <p className="totem__subtitle">
              Escolha como o cliente vai apresentar o voucher.
            </p>

            <div className="totem__choices">
              <button
                className="totem__choice"
                onClick={() => setScreen('scan')}
              >
                <span className="totem__choice-icon">📷</span>
                <strong>Escanear QR Code</strong>
                <small>A câmera abre só quando você tocar no botão.</small>
              </button>

              <button
                className="totem__choice"
                onClick={() => setScreen('manual')}
              >
                <span className="totem__choice-icon">⌨️</span>
                <strong>Digitar código</strong>
                <small>Informe o código impresso/recebido pelo cliente.</small>
              </button>
            </div>
          </div>
        )}

        {/* ---------- SCAN ---------- */}
        {screen === 'scan' && (
          <div className="totem__stage">
            <h1 className="totem__title">Aponte para o QR Code</h1>
            <p className="totem__subtitle">
              Posicione o voucher do cliente dentro da área.
            </p>
            <QrScanner
              large
              onScan={(code) => {
                setCodeInput(code);
                handleLookup(code);
              }}
              onError={setError}
            />
            <button className="totem__back" onClick={reset}>
              ← Voltar
            </button>
          </div>
        )}

        {/* ---------- MANUAL ---------- */}
        {screen === 'manual' && (
          <div className="totem__stage">
            <h1 className="totem__title">Digite o código</h1>
            <p className="totem__subtitle">Ex.: BC4D-89WP-LK22-RR81</p>
            <form onSubmit={handleManualSubmit} className="totem__form">
              <input
                className="totem__input"
                placeholder="CÓDIGO DO VOUCHER"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                autoFocus
                inputMode="text"
                autoCapitalize="characters"
              />
              <button
                type="submit"
                className="totem__primary"
                disabled={!codeInput.trim()}
              >
                Validar código
              </button>
            </form>
            <button className="totem__back" onClick={reset}>
              ← Voltar
            </button>
          </div>
        )}

        {/* ---------- RESULT ---------- */}
        {screen === 'result' && (
          <div className="totem__stage">
            {busy && !summary && !error && (
              <p className="totem__subtitle">Validando código...</p>
            )}

            {error && (
              <div className="totem__feedback totem__feedback--error">
                <span className="totem__feedback-icon">⚠</span>
                <p>{error}</p>
                <button className="totem__primary" onClick={reset}>
                  Tentar novamente
                </button>
              </div>
            )}

            {summary && !redeemed && (
              <>
                <h1 className="totem__title">Voucher válido ✓</h1>
                <div className="totem__product">
                  <strong>{summary.productTitle}</strong>
                  <small>{summary.customerName}</small>
                </div>

                <dl className="totem__breakdown">
                  <div>
                    <dt>Valor pago pelo cliente</dt>
                    <dd>{formatCurrency(summary.paidPrice)}</dd>
                  </div>
                  <div>
                    <dt>Taxa OpenDriverHub ({summary.feePercent}%)</dt>
                    <dd className="totem__deduct">
                      − {formatCurrency(summary.platformFee)}
                    </dd>
                  </div>
                  <div>
                    <dt>Cashback do cliente (creditado na compra)</dt>
                    <dd className="totem__deduct">
                      − {formatCurrency(summary.customerCashback)}
                    </dd>
                  </div>
                  <div className="totem__net">
                    <dt>Você tem a receber</dt>
                    <dd>{formatCurrency(summary.partnerNet)}</dd>
                  </div>
                </dl>
                <p className="totem__subtitle">
                  Apenas o cálculo do seu repasse — o cashback já foi creditado
                  ao cliente no momento da compra. Nenhum valor é movimentado na
                  conta do cliente neste resgate. Repasse centralizado pelo
                  OpenDriverHub.
                </p>

                <button
                  className="totem__primary totem__primary--big"
                  onClick={confirmRedeem}
                  disabled={busy}
                >
                  {busy ? 'Processando...' : 'Confirmar resgate'}
                </button>
                <button className="totem__back" onClick={reset}>
                  ← Cancelar
                </button>
              </>
            )}

            {summary && redeemed && (
              <div className="totem__feedback totem__feedback--ok">
                <span className="totem__feedback-icon">✓</span>
                <h1 className="totem__title">Resgate concluído</h1>
                <p>
                  Entregue o produto ao cliente.{' '}
                  <strong>{formatCurrency(summary.partnerNet)}</strong> entram
                  no seu valor a receber.
                </p>
                <button
                  className="totem__primary totem__primary--big"
                  onClick={reset}
                >
                  Nova leitura
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
