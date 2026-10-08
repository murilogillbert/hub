import { AppError } from '../errors.js';

/**
 * Horário de funcionamento de uma unidade, e a pergunta "está aberta agora?".
 *
 * ============================================================================
 * Por que módulo puro
 * ============================================================================
 *
 * Porque a parte difícil aqui não é guardar o dado, é a aritmética de relógio: intervalo que
 * cruza a meia-noite, fuso diferente do servidor, e borda de minuto. As três são exatamente o
 * tipo de regra que se prova com uma tabela de casos e não se prova olhando a tela.
 *
 * ============================================================================
 * O fuso é explícito, e não o do servidor
 * ============================================================================
 *
 * O servidor roda em UTC. Usar o relógio dele diria "fechada" às 17h de Campo Grande, porque lá
 * já são 21h em UTC. E não dá para deduzir o fuso do estado de forma confiável: o Brasil tem
 * quatro, e `MT`/`MS` são UTC−4 enquanto `SP` é UTC−3. Então o fuso é uma coluna, com padrão
 * `America/Sao_Paulo`, e a conta usa `Intl` — que conhece horário de verão sem tabela nossa.
 */

/** `0` = domingo, como `Date.prototype.getDay()`. A ordem é a da semana brasileira. */
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
export type Dia = (typeof DIAS)[number];

export interface Intervalo {
  /** `HH:MM` em 24 h. */
  de: string;
  /**
   * `HH:MM` em 24 h.
   *
   * Quando é **menor ou igual** a `de`, o intervalo cruza a meia-noite: `18:00`–`02:00` é um
   * bar que fecha às duas da manhã do dia seguinte. Sem essa regra, o horário mais comum do
   * ramo de alimentação seria impossível de cadastrar.
   */
  ate: string;
}

export type HorarioSemanal = Partial<Record<Dia, Intervalo[]>>;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:MM` → minutos desde a meia-noite. */
export function minutosDoDia(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) throw new AppError(`Horário inválido: "${hhmm}". Use HH:MM entre 00:00 e 23:59.`, 400);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** `true` quando o intervalo atravessa a meia-noite. */
export function cruzaMeiaNoite(i: Intervalo): boolean {
  return minutosDoDia(i.ate) <= minutosDoDia(i.de);
}

/**
 * Valida e normaliza o que veio do cliente.
 *
 * Lança com mensagem que diz **qual dia e qual intervalo** está errado. Mensagem genérica num
 * formulário de sete dias com vários intervalos obriga o lojista a adivinhar, e o resultado
 * prático é unidade sem horário cadastrado.
 */
export function validarHorario(bruto: unknown): HorarioSemanal {
  if (bruto === null || bruto === undefined) return {};
  if (typeof bruto !== 'object' || Array.isArray(bruto)) {
    throw new AppError('Horário de funcionamento deve ser um objeto com os dias da semana.', 400);
  }

  const entrada = bruto as Record<string, unknown>;
  const saida: HorarioSemanal = {};

  for (const chave of Object.keys(entrada)) {
    if (!(DIAS as readonly string[]).includes(chave)) {
      throw new AppError(
        `Dia desconhecido: "${chave}". Use ${DIAS.join(', ')}.`,
        400,
      );
    }
    const dia = chave as Dia;
    const valor = entrada[chave];
    if (valor === null || valor === undefined) continue;
    if (!Array.isArray(valor)) {
      throw new AppError(`"${dia}" deve ser uma lista de intervalos.`, 400);
    }
    if (valor.length > 4) {
      // Quatro cobre o caso real mais fragmentado (café da manhã, almoço, tarde, jantar). Mais
      // do que isso é erro de preenchimento, e lista sem teto é um campo de texto livre no
      // banco com outro nome.
      throw new AppError(`"${dia}" tem ${valor.length} intervalos; o máximo é 4.`, 400);
    }

    const intervalos: Intervalo[] = [];
    for (let i = 0; i < valor.length; i++) {
      const cru = valor[i] as Record<string, unknown> | null;
      if (!cru || typeof cru !== 'object') {
        throw new AppError(`"${dia}" intervalo ${i + 1}: informe de e ate no formato HH:MM.`, 400);
      }
      const de = String(cru.de ?? '');
      const ate = String(cru.ate ?? '');
      if (!HHMM.test(de)) {
        throw new AppError(`"${dia}" intervalo ${i + 1}: início "${de}" inválido. Use HH:MM.`, 400);
      }
      if (!HHMM.test(ate)) {
        throw new AppError(`"${dia}" intervalo ${i + 1}: fim "${ate}" inválido. Use HH:MM.`, 400);
      }
      if (de === ate) {
        /**
         * `09:00`–`09:00` é ambíguo: pode ser "fechada" ou "24 horas". Recusar força o lojista
         * a dizer qual — para 24 h o cadastro é `00:00`–`23:59`, e para fechada é não ter
         * intervalo nenhum naquele dia.
         */
        throw new AppError(
          `"${dia}" intervalo ${i + 1}: início e fim iguais. Para 24 horas use 00:00 e 23:59; para fechada, remova o intervalo.`,
          400,
        );
      }
      intervalos.push({ de, ate });
    }

    /**
     * Intervalos que se sobrepõem no mesmo dia são recusados.
     *
     * Não é purismo: `09:00–18:00` junto com `14:00–20:00` não tem leitura única na tela ("de
     * quando até quando?"), e o lojista que digitou isso quis dizer uma das duas coisas. Melhor
     * perguntar do que escolher por ele.
     *
     * A checagem ignora intervalo que cruza a meia-noite, porque a parte dele que invade o dia
     * seguinte não conflita com o próprio dia — e comparar isso exigiria projetar a semana
     * inteira, que é o que `estaAberta` faz na hora de responder.
     */
    const doDia = intervalos.filter((i) => !cruzaMeiaNoite(i));
    const ordenados = [...doDia].sort((a, b) => minutosDoDia(a.de) - minutosDoDia(b.de));
    for (let i = 1; i < ordenados.length; i++) {
      const anterior = ordenados[i - 1]!;
      const atual = ordenados[i]!;
      if (minutosDoDia(atual.de) < minutosDoDia(anterior.ate)) {
        throw new AppError(
          `"${dia}": os intervalos ${anterior.de}-${anterior.ate} e ${atual.de}-${atual.ate} se sobrepõem.`,
          400,
        );
      }
    }

    if (intervalos.length > 0) saida[dia] = intervalos;
  }

  return saida;
}

/** `true` quando nenhum dia tem intervalo — a unidade não declarou horário. */
export function semHorario(h: HorarioSemanal | null | undefined): boolean {
  if (!h) return true;
  return DIAS.every((d) => (h[d] ?? []).length === 0);
}

/**
 * Dia da semana e minuto do dia **no fuso da unidade**.
 *
 * `Intl.DateTimeFormat` com `timeZone` é o caminho sem dependência e com horário de verão
 * incluído. `hourCycle: 'h23'` é necessário: sem ele, meia-noite sai como `24` em algumas
 * combinações de locale e a conta erra por um dia inteiro.
 */
export function agoraNaUnidade(
  fuso: string,
  agora: Date = new Date(),
): { dia: Dia; minutos: number } {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(agora);
  } catch {
    /**
     * Fuso inválido no banco não pode derrubar a listagem do catálogo. Cai para o fuso de
     * referência do país e segue — a unidade aparece com horário possivelmente errado, o que é
     * melhor do que o catálogo inteiro responder 500.
     */
    partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(agora);
  }

  const de = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';

  const semanaEn: Record<string, Dia> = {
    Sun: 'dom',
    Mon: 'seg',
    Tue: 'ter',
    Wed: 'qua',
    Thu: 'qui',
    Fri: 'sex',
    Sat: 'sab',
  };
  const dia = semanaEn[de('weekday')] ?? 'dom';
  const hora = Number(de('hour'));
  const minuto = Number(de('minute'));
  return { dia, minutos: (Number.isFinite(hora) ? hora : 0) * 60 + (Number.isFinite(minuto) ? minuto : 0) };
}

const anterior = (d: Dia): Dia => DIAS[(DIAS.indexOf(d) + 6) % 7]!;

/**
 * A unidade está aberta neste instante?
 *
 * **Unidade sem horário declarado conta como aberta.** É a decisão conservadora aqui: hoje
 * nenhuma unidade tem horário cadastrado, e tratar ausência como "fechada" sumiria com o
 * catálogo inteiro no instante do deploy. Quem cadastra horário passa a ser filtrado; quem não
 * cadastra continua como antes.
 */
export function estaAberta(
  h: HorarioSemanal | null | undefined,
  fuso: string,
  agora: Date = new Date(),
): boolean {
  if (semHorario(h)) return true;
  const { dia, minutos } = agoraNaUnidade(fuso, agora);

  // Intervalos que começam hoje.
  for (const i of h![dia] ?? []) {
    const de = minutosDoDia(i.de);
    const ate = minutosDoDia(i.ate);
    if (cruzaMeiaNoite(i)) {
      if (minutos >= de) return true;
    } else if (minutos >= de && minutos < ate) {
      return true;
    }
  }

  /**
   * Intervalos de **ontem** que ainda não terminaram.
   *
   * É o que faz `sex 18:00–02:00` responder "aberta" à 1h da manhã de sábado. Sem este
   * segundo laço, todo bar apareceria como fechado justamente no horário de maior movimento.
   */
  for (const i of h![anterior(dia)] ?? []) {
    if (!cruzaMeiaNoite(i)) continue;
    if (minutos < minutosDoDia(i.ate)) return true;
  }

  return false;
}

/**
 * Próximo horário de abertura, em `HH:MM`, ou `null` quando não há nenhum nos próximos 7 dias.
 *
 * Serve à tela: "fechada · abre seg às 09:00" é uma resposta útil, "fechada" sozinho faz o
 * cliente voltar amanhã para descobrir o mesmo.
 */
export function proximaAbertura(
  h: HorarioSemanal | null | undefined,
  fuso: string,
  agora: Date = new Date(),
): { dia: Dia; hora: string } | null {
  if (semHorario(h)) return null;
  const atual = agoraNaUnidade(fuso, agora);
  const inicio = DIAS.indexOf(atual.dia);

  for (let salto = 0; salto < 8; salto++) {
    const dia = DIAS[(inicio + salto) % 7]!;
    const candidatos = [...(h![dia] ?? [])]
      .map((i) => i.de)
      .sort((a, b) => minutosDoDia(a) - minutosDoDia(b));
    for (const hora of candidatos) {
      // No dia de hoje só interessa abertura que ainda não passou.
      if (salto === 0 && minutosDoDia(hora) <= atual.minutos) continue;
      return { dia, hora };
    }
  }
  return null;
}
