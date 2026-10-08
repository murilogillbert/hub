import { useState } from 'react';
import { resolveImageUrl } from '@shared/api/client';
import './Avatar.css';

/**
 * Foto de perfil, com iniciais quando não há foto.
 *
 * ============================================================================
 * Por que iniciais, e não um avatar gerado por serviço externo
 * ============================================================================
 *
 * Até 2026-10-09 todo usuário nascia com `avatarUrl` apontando para o DiceBear
 * (`api.dicebear.com/9.x/avataaars/svg`). A foto de **todo** usuário que nunca trocou dependia
 * de um terceiro estar no ar em tempo de execução, e cada tela que lista usuários fazia uma
 * chamada externa por linha — dentro do caminho de render.
 *
 * Agora o campo nasce vazio e a ausência é desenhada aqui, em CSS.
 *
 * O cálculo de inicial e cor é o mesmo do backend (`backend/src/domain/avatar.ts`, com teste) e
 * do app, para a mesma pessoa aparecer igual nos três.
 */

/** Iniciais: primeira e **última** palavra — "Maria da Silva Santos" vira "MS", não "MD". */
export function iniciaisDoNome(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
    .filter((p) => !['da', 'de', 'do', 'das', 'dos', 'e'].includes(p.toLowerCase()));

  if (partes.length === 0) return '?';
  const primeira = partes[0]![0]!;
  if (partes.length === 1) return primeira.toUpperCase();
  return `${primeira}${partes[partes.length - 1]![0]!}`.toUpperCase();
}

/** Doze matizes com contraste garantido contra texto branco. */
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
];

/** Cor estável para um nome (FNV-1a de 32 bits). Cor sorteada pareceria defeito. */
export function corDoNome(nome: string): string {
  let h = 0x811c9dc5;
  const texto = nome.trim().toLowerCase();
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return CORES[h % CORES.length]!;
}

interface Props {
  nome: string;
  url?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ nome, url, size = 40, className = '' }: Props) {
  /**
   * Imagem que falhou cai para as iniciais.
   *
   * Importa no acervo: quem ainda tiver URL de DiceBear no banco — ou foto apagada do storage —
   * veria o ícone de imagem quebrada. Com isto, vê as iniciais.
   */
  const [falhou, setFalhou] = useState(false);
  const resolvida = url && !falhou ? resolveImageUrl(url) : '';

  if (resolvida) {
    return (
      <img
        className={`avatar ${className}`}
        src={resolvida}
        alt={nome}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setFalhou(true)}
      />
    );
  }

  return (
    <span
      className={`avatar avatar--iniciais ${className}`}
      style={{ width: size, height: size, backgroundColor: corDoNome(nome), fontSize: size * 0.4 }}
      aria-label={`Foto de ${nome}`}
      role="img"
    >
      {iniciaisDoNome(nome)}
    </span>
  );
}
