import type { ReactNode } from 'react';

/**
 * Ícones de linha (24x24, stroke 2, currentColor) — sem dependência externa.
 * Extraído do conjunto ad-hoc que já existia em HomePage.tsx; qualquer tela
 * nova deve importar daqui em vez de redefinir SVGs ou usar emoji.
 */
const PATHS: Record<string, ReactNode> = {
  tag: (
    <>
      <path d="M20.5 11l-8 8a2 2 0 0 1-2.8 0L3 12.3V3.5h8.8L20.5 11z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  wrench: (
    <>
      <path d="M14.7 6.3a4 4 0 1 1 3 6.7L21 17l-3 3-4-3.3a4 4 0 0 1-6.7-3" />
      <path d="M9 5l-4 4 3 3 4-4z" />
    </>
  ),
  handshake: <path d="M3 12l4-4 4 4-2 2 4 4 6-6-4-4 2-2-4-4-4 4" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
  layoutGrid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </>
  ),
  store: (
    <>
      <path d="M3 7l2-4h14l2 4" />
      <path d="M3 7v13h18V7" />
      <path d="M3 7c0 2 1 3 3 3s3-1 3-3 1 3 3 3 3-1 3-3 1 3 3 3 3-1 3-3" />
    </>
  ),
  money: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14 9a3 3 0 0 0-6 0c0 4 6 2 6 6a3 3 0 0 1-6 0" />
      <line x1="12" y1="6" x2="12" y2="18" />
    </>
  ),
  shield: <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />,
  car: (
    <>
      <path d="M5 16h14l-2-6H7l-2 6z" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="17" r="1.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-5a2 2 0 0 0 0 4h5" />
    </>
  ),
  package: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.4" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.4-1.4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="14" r="3.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14.3c2.3.6 3.9 2.6 3.9 5.7" />
    </>
  ),
  creditCard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="9" x2="6" y2="9" />
      <line x1="18" y1="15" x2="18" y2="15" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5" />
      <path d="M15 3v5" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8z" />
      <path d="M12 17v4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="2.5" y1="12.5" x2="21.5" y2="12.5" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.8 12.2L20 3" />
      <path d="M16 7l3 3" />
      <path d="M13 4l3 3" />
    </>
  ),
  menu: (
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  x: (
    <>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 3.5l10 17H2l10-17z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M4 12.5l5.5 5.5L20 6.5" />,
  eye: (
    <>
      <path d="M2 12c2.5-5 6.5-8 10-8s7.5 3 10 8c-2.5 5-6.5 8-10 8S4.5 17 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-6-5-4 4-3-2-5 5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="10" x2="6" y2="10" />
      <line x1="10" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="14" y2="10" />
      <line x1="18" y1="10" x2="18" y2="10" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4.5" width="20" height="15" rx="2" />
      <path d="M2 6l10 7 10-7" />
    </>
  ),
  shoppingBag: (
    <>
      <path d="M6 7h12l1 14H5L6 7z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6" />
    </>
  ),
  logOut: (
    <>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M15 16l4-4-4-4" />
      <line x1="19" y1="12" x2="9" y2="12" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
