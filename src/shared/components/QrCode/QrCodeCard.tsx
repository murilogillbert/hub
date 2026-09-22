import { useRef, useState } from 'react';
import { QrCode } from './QrCode';
import { Button } from '@shared/components/Button/Button';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { downloadQrPdf, qrFilename } from '@shared/utils/downloadQr';

interface QrCodeCardProps {
  value: string;
  /** Legenda mostrada sob o QR (ex.: "Catálogo da sua loja"). */
  label?: string;
  /** Nome da pessoa/estabelecimento — vira o nome do arquivo
   * (qrcode-Nome-opendriverhub.pdf) e o título dentro do PDF. */
  ownerName: string;
  size?: number;
}

/** QR code + botão de baixar como PDF (pra imprimir e colar no balcão) —
 * usado no link de pesquisa do motorista/parceiro e no QR do catálogo. */
export function QrCodeCard({ value, label, ownerName, size = 180 }: QrCodeCardProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  const download = async () => {
    const svg = frameRef.current?.querySelector('svg');
    if (!svg) return;
    setDownloading(true);
    try {
      await downloadQrPdf(svg, qrFilename(ownerName), label);
    } catch {
      toast.error('Falha ao gerar o PDF do QR code.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div ref={frameRef} className="stack" style={{ alignItems: 'center' }}>
      <QrCode value={value} size={size} label={label} />
      <Button variant="secondary" size="sm" onClick={download} disabled={downloading}>
        {downloading ? 'Gerando PDF...' : 'Baixar QR code (PDF)'}
      </Button>
    </div>
  );
}
