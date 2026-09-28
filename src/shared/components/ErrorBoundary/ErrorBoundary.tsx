import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@shared/components/Button/Button';

const RELOAD_FLAG = 'odh.chunkReload';

/** Depois de um deploy, a aba aberta pode pedir um chunk que não existe mais. */
function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    msg,
  );
}

interface State {
  error: unknown;
}

/**
 * Última rede de proteção: um erro de renderização mostra uma mensagem com ação
 * em vez da tela branca. Se for chunk de uma versão antiga, recarrega uma vez
 * sozinho (a flag evita loop se o servidor estiver fora).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        alreadyReloaded = true;
      }
      if (!alreadyReloaded) {
        window.location.reload();
        return;
      }
    }
    console.error('Erro de renderização', error, info.componentStack);
  }

  componentDidMount() {
    // Carregou sem erro: libera um novo reload automático no futuro.
    window.setTimeout(() => {
      try {
        if (!this.state.error) sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* sessionStorage indisponível */
      }
    }, 5000);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const outdated = isChunkLoadError(this.state.error);
    return (
      <div role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 'var(--space-5)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-2xl)', marginBottom: 'var(--space-2)' }}>
          {outdated ? 'Há uma versão nova do site' : 'Algo deu errado nesta tela'}
        </h1>
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          {outdated
            ? 'Recarregue a página para continuar de onde parou.'
            : 'Seus dados estão seguros. Recarregue a página; se o problema continuar, volte para o início.'}
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-2)' }}>
          <Button onClick={() => window.location.reload()}>Recarregar</Button>
          {!outdated && (
            <Button variant="secondary" onClick={() => window.location.assign('/')}>
              Ir para o início
            </Button>
          )}
        </div>
      </div>
    );
  }
}
