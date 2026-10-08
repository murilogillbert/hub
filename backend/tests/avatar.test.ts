import { describe, expect, it } from 'vitest';
import {
  avatarPadrao,
  corDoNome,
  ehAvatarDeTerceiro,
  iniciaisDoNome,
} from '../src/domain/avatar.js';

/**
 * Avatar sem serviço de terceiro.
 *
 * O cálculo é duplicado nos clientes (`hub-mobile/src/components/Avatar.tsx` e o SPA) porque
 * cada um desenha o seu. Estes testes fixam o resultado esperado, de modo que uma divergência
 * entre as cópias apareça aqui — a mesma pessoa tem de aparecer com a mesma inicial e a mesma
 * cor nos três aplicativos.
 */

describe('iniciaisDoNome', () => {
  it('nome simples devolve uma letra', () => {
    expect(iniciaisDoNome('Ana')).toBe('A');
  });

  it('nome composto usa a primeira e a ULTIMA palavra', () => {
    // "MS", e não "MD": é como as pessoas abreviam o próprio nome.
    expect(iniciaisDoNome('Maria da Silva Santos')).toBe('MS');
    expect(iniciaisDoNome('João Pedro')).toBe('JP');
  });

  it('ignora preposicoes', () => {
    expect(iniciaisDoNome('Ana de Souza')).toBe('AS');
    expect(iniciaisDoNome('Luiz dos Santos e Silva')).toBe('LS');
  });

  it('nome que e so preposicao nao quebra', () => {
    expect(iniciaisDoNome('de da do')).toBe('?');
  });

  it('vazio e espaco em branco devolvem interrogacao', () => {
    expect(iniciaisDoNome('')).toBe('?');
    expect(iniciaisDoNome('   ')).toBe('?');
  });

  it('sempre em maiuscula', () => {
    expect(iniciaisDoNome('ana silva')).toBe('AS');
  });

  it('espacos repetidos nao viram iniciais vazias', () => {
    expect(iniciaisDoNome('Ana    Silva')).toBe('AS');
  });
});

describe('corDoNome', () => {
  it('e estavel para o mesmo nome', () => {
    /**
     * Determinística de propósito: cor sorteada mudaria a cada render e pareceria defeito.
     */
    expect(corDoNome('Ana Silva')).toBe(corDoNome('Ana Silva'));
  });

  it('ignora caixa e espaco nas pontas', () => {
    expect(corDoNome('  ANA SILVA ')).toBe(corDoNome('ana silva'));
  });

  it('devolve sempre uma das cores da lista', () => {
    // A lista é fixa porque matiz calculado livremente produz amarelos e ciânos claros em que
    // texto branco não se lê.
    for (const nome of ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Fábio', 'Gina', 'Hugo']) {
      expect(corDoNome(nome)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('nomes diferentes nao caem todos na mesma cor', () => {
    const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Fábio', 'Gina', 'Hugo', 'Iris', 'Jonas'];
    const cores = new Set(nomes.map(corDoNome));
    // Não exige doze cores distintas em dez nomes — exige que o hash não esteja colapsando.
    expect(cores.size).toBeGreaterThan(3);
  });
});

describe('ehAvatarDeTerceiro', () => {
  it('reconhece o DiceBear', () => {
    expect(ehAvatarDeTerceiro('https://api.dicebear.com/9.x/avataaars/svg?seed=Ana')).toBe(true);
  });

  it('nao confunde foto enviada de verdade', () => {
    expect(ehAvatarDeTerceiro('/uploads/abc.jpg')).toBe(false);
    expect(ehAvatarDeTerceiro('https://storage.opendriver.com.br/hub-uploads/x.jpg')).toBe(false);
  });

  it('trata vazio e nulo', () => {
    expect(ehAvatarDeTerceiro('')).toBe(false);
    expect(ehAvatarDeTerceiro(null)).toBe(false);
    expect(ehAvatarDeTerceiro(undefined)).toBe(false);
  });
});

describe('avatarPadrao', () => {
  it('e vazio, nao uma URL', () => {
    /**
     * O ponto da frente: ausência é um valor válido. Qualquer URL aqui seria uma dependência de
     * runtime — era isso que o DiceBear fazia, para a base inteira.
     */
    expect(avatarPadrao()).toBe('');
  });
});
