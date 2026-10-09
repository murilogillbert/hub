import { useState } from 'react';
import { resolveImageUrl } from '@shared/api/client';
import { Icon } from '@shared/components/Icon/Icon';
import './RemoteImage.css';

/**
 * Imagem remota com reserva visual, para o painel web.
 *
 * ============================================================================
 * Por que isto faltava, e qual era o sintoma
 * ============================================================================
 *
 * O aplicativo tem `RemoteImage` desde o começo (`hub-mobile/src/components/Media.tsx`): a
 * função de resolução devolve `null` para URL vazia e o componente desenha um quadro com
 * ícone. O painel web tinha só `resolveImageUrl`, que devolve **string vazia** — e a string
 * vazia ia direto para `<img src="">`.
 *
 * `src=""` não é "sem imagem" para o navegador: ele resolve contra a URL da página, pede a
 * própria página de volta, recebe HTML, falha ao decodificar e desenha o ícone de **imagem
 * quebrada**. O resultado é que a mesma loja aparecia com um quadro cinza no aplicativo e com
 * um ícone de erro no site.
 *
 * Isso ficou visível quando a Frente C passou a gravar `partners.logo_url` como string vazia
 * (antes era uma URL do DiceBear, que sempre respondia). Mas o defeito não era da Frente C: o
 * `<img src="">` já estava lá, esperando um campo vazio. Produto sem foto cadastrada tinha
 * exatamente o mesmo comportamento, e todo o acervo de produção está sem foto.
 *
 * ============================================================================
 * Por que um componente, e não um `||` em cada tela
 * ============================================================================
 *
 * Havia **oito** `<img src={resolveImageUrl(...)}>` espalhados em catálogo, vitrine, página de
 * produto, carrinho, conferência de pedido e grade do parceiro. Consertar cada um com um
 * operador de guarda deixaria o nono errado — e deixaria cada tela escolhendo seu próprio
 * desenho de "sem imagem".
 *
 * `onError` também é tratado, e não só o valor vazio: foto apagada do armazenamento, ou URL
 * de DiceBear que tenha sobrado em algum acervo, falha em tempo de execução e não na leitura.
 * Sem isso o quadro continuaria quebrando nesses dois casos.
 */
export function RemoteImage({
  url,
  alt,
  className,
  /** `lazy` por padrão: estas imagens aparecem em grade longa. */
  loading = 'lazy',
}: {
  url?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [falhou, setFalhou] = useState(false);
  const resolvida = url && !falhou ? resolveImageUrl(url) : '';

  if (!resolvida) {
    return (
      <span
        className={['imagem-remota', 'imagem-remota--vazia', className].filter(Boolean).join(' ')}
        role="img"
        aria-label={alt ? `${alt} (sem imagem)` : 'Sem imagem'}
      >
        <Icon name="image" size={24} />
      </span>
    );
  }

  return (
    <img
      src={resolvida}
      alt={alt}
      loading={loading}
      className={className}
      /**
       * `onError` troca para a reserva em vez de deixar o ícone de quebrado do navegador.
       * `useState` e não uma classe no elemento porque o React precisa re-renderizar: mexer
       * no DOM por fora seria desfeito na próxima renderização da lista.
       */
      onError={() => setFalhou(true)}
    />
  );
}
