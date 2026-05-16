import { QRCodeSVG } from 'qrcode.react';
import './QrCode.css';

interface QrCodeProps {
  value: string;
  size?: number;
  label?: string;
  /** id aplicado ao frame — permite localizar o <svg> para download. */
  id?: string;
}

export function QrCode({ value, size = 160, label, id }: QrCodeProps) {
  return (
    <div className="qr-code">
      <div
        id={id}
        className="qr-code__frame"
        style={{ width: size, height: size }}
      >
        <QRCodeSVG value={value} size={size - 16} level="M" />
      </div>
      {label && <small className="qr-code__label">{label}</small>}
    </div>
  );
}
