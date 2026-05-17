import { ReactNode, useEffect, useId, useRef } from 'react';
import './Modal.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeDisabled?: boolean;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  title,
  onClose,
  children,
  closeDisabled,
  className = '',
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Mantém sempre o onClose/closeDisabled mais recentes sem recriar o efeito.
  // (As telas passam onClose inline — função nova a cada render. Se o efeito
  // dependesse dele, ele rodaria a cada tecla e roubaria o foco do campo,
  // fechando o teclado no celular.)
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    window.setTimeout(() => {
      focusables()[0]?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      previous?.focus();
    };
    // Só reage à abertura/fechamento — NUNCA a cada render do pai.
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal__overlay"
      onMouseDown={() => {
        if (!closeDisabled) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal__dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__head">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Fechar"
            disabled={closeDisabled}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
