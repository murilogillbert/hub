/**
 * Avatar e logo padrão: **nenhuma URL**.
 *
 * ============================================================================
 * O que havia aqui antes, e por que saiu
 * ============================================================================
 *
 * Todo usuário nascia com `avatar_url` apontando para
 * `https://api.dicebear.com/9.x/avataaars/svg?seed=<nome>`, e o mesmo para a logo da loja. O
 * efeito prático: **a foto de todo usuário que nunca trocou depende de um serviço de terceiro
 * estar no ar em tempo de execução**, e cada tela que lista usuários faz uma chamada externa por
 * linha. Fora do nosso controle, fora do nosso monitoramento, e dentro do caminho de render.
 *
 * ============================================================================
 * Por que não substituir por um SVG nosso em data URI
 * ============================================================================
 *
 * Foi a primeira ideia e ela não sobrevive aos clientes. `resolveImageUrl` do `hub-mobile`
 * aceita só `http(s)` e `/uploads` — um `data:` viraria o ícone de ausência. E o `Image` do
 * React Native não renderiza SVG sem biblioteca própria.
 *
 * Gerar PNG no servidor resolveria, ao custo de uma dependência de imagem no backend para
 * produzir um círculo com duas letras.
 *
 * ============================================================================
 * A decisão: ausência é um valor válido
 * ============================================================================
 *
 * `avatarUrl` vazio significa "sem foto", e **cada cliente desenha as iniciais** — um círculo
 * com cor derivada do nome. É `View` + `Text` no React Native e CSS no navegador: nada para
 * baixar, nada que possa estar fora do ar, e funciona igual nos três aplicativos.
 *
 * As funções abaixo existem para o cálculo ser o mesmo em todo lugar — mesma inicial e mesma
 * cor para o mesmo nome, no site e nos apps.
 */

/**
 * Iniciais de um nome: uma letra para nome único, duas para nome composto.
 *
 * Pega a **primeira e a última** palavra, não as duas primeiras: "Maria da Silva Santos" vira
 * "MS", que é como as pessoas abreviam o próprio nome, e não "MD".
 */
export function iniciaisDoNome(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
    // Preposições não são iniciais de ninguém.
    .filter((p) => !['da', 'de', 'do', 'das', 'dos', 'e'].includes(p.toLowerCase()));

  if (partes.length === 0) return '?';
  const primeira = partes[0]![0]!;
  if (partes.length === 1) return primeira.toUpperCase();
  const ultima = partes[partes.length - 1]![0]!;
  return `${primeira}${ultima}`.toUpperCase();
}

/**
 * Doze matizes escolhidos para dar contraste com texto branco.
 *
 * Lista fixa em vez de matiz calculado livremente: HSL derivado de hash produz amarelos e
 * ciânos claros em que texto branco não se lê. Melhor ter doze cores que funcionam do que 360
 * das quais um terço não serve.
 */
const CORES = [
  '#1D4ED8',
  '#7C3AED',
  '#BE185D',
  '#B91C1C',
  '#B45309',
  '#15803D',
  '#0F766E',
  '#0E7490',
  '#4338CA',
  '#9333EA',
  '#A21CAF',
  '#166534',
] as const;

/**
 * Cor estável para um nome.
 *
 * Determinística de propósito: a mesma pessoa aparece sempre com a mesma cor, em qualquer tela
 * e em qualquer aplicativo. Cor sorteada faria o avatar "mudar" a cada render e pareceria
 * defeito.
 *
 * O hash é um FNV-1a de 32 bits — pequeno, sem dependência, e distribuição boa o suficiente
 * para doze baldes. Nada aqui é segurança.
 */
export function corDoNome(nome: string): string {
  let h = 0x811c9dc5;
  const texto = nome.trim().toLowerCase();
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return CORES[h % CORES.length]!;
}

/** `true` quando a URL é um avatar gerado pelo DiceBear (acervo anterior a 2026-10-09). */
export function ehAvatarDeTerceiro(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.includes('api.dicebear.com');
}

/**
 * O que gravar como avatar no cadastro: **nada**.
 *
 * Existe como função, e não como `null` solto nos chamadores, para o motivo ficar num lugar só
 * e para a busca por "avatarPadrao" encontrar a decisão.
 */
export function avatarPadrao(): string {
  return '';
}
