import { useEffect } from 'react';

const DEFAULT_TITLE = document.title;

/**
 * Define o <title> (e opcionalmente a meta description) da página atual,
 * restaurando o valor anterior ao desmontar. Sem isso toda rota herda o
 * título/descrição estático do index.html (a home), o que prejudica SEO e
 * o preview ao compartilhar um link de produto/catálogo específico.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} — OpenDriverHub`;

    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') ?? null;
    if (description && meta) meta.setAttribute('content', description);

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      if (description && meta && previousDescription !== null) {
        meta.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}
