import './Logo.css';

interface LogoProps {
  /** Texto secundário (ex.: "Administração"). */
  subtitle?: string;
  /** Esconde o wordmark, mostra só o ícone. */
  iconOnly?: boolean;
  /** Tamanho do ícone em px. */
  size?: number;
}

/**
 * Marca OpenDriverHub. A imagem fica em /public/logo.png (servida na raiz).
 * Se o arquivo não existir, o alt/texto garante que a marca ainda apareça.
 */
export function Logo({ subtitle, iconOnly = false, size = 36 }: LogoProps) {
  return (
    <span className="odh-logo">
      <img
        src="/logo.png"
        alt="OpenDriverHub"
        className="odh-logo__img"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      {!iconOnly && (
        <span className="odh-logo__text">
          <strong>OpenDriverHub</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>
      )}
    </span>
  );
}
