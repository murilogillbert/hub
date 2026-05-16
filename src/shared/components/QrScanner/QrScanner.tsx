import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './QrScanner.css';

interface QrScannerProps {
  onScan: (code: string) => void;
  onError?: (message: string) => void;
  /** Modo totem: área de leitura e botões maiores, touch-first. */
  large?: boolean;
}

const SCANNER_ID = 'qr-scanner-region';

export function QrScanner({ onScan, onError, large = false }: QrScannerProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, []);

  const stopInternal = async () => {
    const instance = instanceRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      await instance.clear();
    } catch {
      // ignore cleanup errors
    }
    instanceRef.current = null;
  };

  const start = async () => {
    setError(null);
    try {
      const instance = new Html5Qrcode(SCANNER_ID);
      instanceRef.current = instance;
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          onScan(decoded);
          stop();
        },
        () => {
          // ignored per-frame parse errors
        },
      );
      setActive(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível acessar a câmera.';
      setError(message);
      onError?.(message);
    }
  };

  const stop = async () => {
    await stopInternal();
    setActive(false);
  };

  return (
    <div className={`qr-scanner ${large ? 'qr-scanner--lg' : ''}`}>
      <div id={SCANNER_ID} className="qr-scanner__region" />
      {!active && (
        <div className="qr-scanner__placeholder">
          <span className="qr-scanner__icon" aria-hidden>
            📷
          </span>
          <span>Câmera desligada</span>
          <small>
            A câmera só é ativada quando você tocar em "Abrir câmera".
          </small>
        </div>
      )}
      <div className="qr-scanner__actions">
        {!active ? (
          <button className="qr-scanner__btn qr-scanner__btn--primary" onClick={start}>
            Abrir câmera
          </button>
        ) : (
          <button className="qr-scanner__btn" onClick={stop}>
            Fechar câmera
          </button>
        )}
      </div>
      {error && <p className="qr-scanner__error">{error}</p>}
    </div>
  );
}
