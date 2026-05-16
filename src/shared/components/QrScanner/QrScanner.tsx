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

/** Escolhe a câmera traseira quando houver (celular/totem). */
function pickCameraId(
  cameras: { id: string; label: string }[],
): string | null {
  if (cameras.length === 0) return null;
  const back = cameras.find((c) =>
    /back|rear|traseira|environment|trás/i.test(c.label),
  );
  // Em celulares a última costuma ser a traseira.
  return (back ?? cameras[cameras.length - 1]).id;
}

export function QrScanner({ onScan, onError, large = false }: QrScannerProps) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    return () => {
      void stopInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopInternal = async () => {
    const instance = instanceRef.current;
    if (!instance) return;
    try {
      if (instance.isScanning) await instance.stop();
      await instance.clear();
    } catch {
      /* ignora erros de limpeza */
    }
    instanceRef.current = null;
  };

  const fail = (message: string) => {
    setError(message);
    onError?.(message);
    setStarting(false);
    setActive(false);
  };

  const start = async () => {
    if (starting || active) return;
    setError(null);
    handledRef.current = false;

    // getUserMedia exige contexto seguro (HTTPS) — exceto localhost.
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ) {
      fail(
        'A câmera só funciona em HTTPS. Acesse o site por https:// ou use a digitação manual.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      fail('Este navegador não suporta acesso à câmera. Use a digitação manual.');
      return;
    }

    setStarting(true);
    try {
      await stopInternal();
      const instance = new Html5Qrcode(SCANNER_ID, { verbose: false });
      instanceRef.current = instance;

      const onDecoded = (decoded: string) => {
        if (handledRef.current) return;
        handledRef.current = true;
        // Para fora do callback para evitar corrida interna da lib.
        window.setTimeout(() => {
          void stop().then(() => onScan(decoded));
        }, 0);
      };

      const config = {
        fps: 10,
        qrbox: (vw: number, vh: number) => {
          const size = Math.floor(Math.min(vw, vh) * 0.75);
          return { width: size, height: size };
        },
        aspectRatio: 1,
      };

      // 1ª tentativa: câmera traseira específica (melhor no celular).
      let cameraId: string | null = null;
      try {
        const cams = await Html5Qrcode.getCameras();
        cameraId = pickCameraId(cams);
      } catch {
        cameraId = null;
      }

      try {
        if (cameraId) {
          await instance.start(cameraId, config, onDecoded, () => {});
        } else {
          throw new Error('no-camera-id');
        }
      } catch {
        // Fallback: restrição suave (funciona em desktop/webcam frontal).
        await instance.start(
          { facingMode: { ideal: 'environment' } },
          config,
          onDecoded,
          () => {},
        );
      }

      setActive(true);
      setStarting(false);
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        fail('Permissão de câmera negada. Autorize o acesso e tente de novo.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        fail('Nenhuma câmera encontrada neste dispositivo.');
      } else {
        const message =
          err instanceof Error ? err.message : 'Não foi possível acessar a câmera.';
        fail(message);
      }
    }
  };

  const stop = async () => {
    await stopInternal();
    setActive(false);
    setStarting(false);
  };

  return (
    <div className={`qr-scanner ${large ? 'qr-scanner--lg' : ''}`}>
      <div id={SCANNER_ID} className="qr-scanner__region" />
      {!active && (
        <div className="qr-scanner__placeholder">
          <span className="qr-scanner__icon" aria-hidden>
            📷
          </span>
          <span>{starting ? 'Abrindo câmera...' : 'Câmera desligada'}</span>
          <small>
            {starting
              ? 'Autorize o acesso à câmera no navegador.'
              : 'A câmera só é ativada quando você tocar em "Abrir câmera".'}
          </small>
        </div>
      )}
      <div className="qr-scanner__actions">
        {!active ? (
          <button
            type="button"
            className="qr-scanner__btn qr-scanner__btn--primary"
            onClick={start}
            disabled={starting}
          >
            {starting ? 'Aguarde...' : 'Abrir câmera'}
          </button>
        ) : (
          <button
            type="button"
            className="qr-scanner__btn"
            onClick={() => void stop()}
          >
            Fechar câmera
          </button>
        )}
      </div>
      {error && <p className="qr-scanner__error">{error}</p>}
    </div>
  );
}
