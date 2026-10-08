import { describe, expect, it } from 'vitest';
import {
  agoraNaUnidade,
  cruzaMeiaNoite,
  estaAberta,
  minutosDoDia,
  proximaAbertura,
  semHorario,
  validarHorario,
  type HorarioSemanal,
} from '../src/domain/openingHours.js';

/**
 * Horário de funcionamento. Módulo puro, então os casos são uma tabela.
 *
 * O que precisa de prova: intervalo que cruza a meia-noite (horário mais comum do ramo de
 * alimentação), fuso diferente do servidor (que roda em UTC), e a borda de minuto.
 */

const SP = 'America/Sao_Paulo';
const CG = 'America/Campo_Grande';

/** `2026-10-09` é uma sexta-feira. */
const sexta = (hhmmUtc: string) => new Date(`2026-10-09T${hhmmUtc}:00.000Z`);
const sabado = (hhmmUtc: string) => new Date(`2026-10-10T${hhmmUtc}:00.000Z`);

describe('minutosDoDia', () => {
  it('converte HH:MM', () => {
    expect(minutosDoDia('00:00')).toBe(0);
    expect(minutosDoDia('09:30')).toBe(570);
    expect(minutosDoDia('23:59')).toBe(1439);
  });

  it('recusa fora de faixa e formato errado', () => {
    for (const ruim of ['24:00', '9:30', '09:60', '', 'abc', '09:5']) {
      expect(() => minutosDoDia(ruim)).toThrow();
    }
  });
});

describe('cruzaMeiaNoite', () => {
  it('fim menor que inicio atravessa o dia', () => {
    expect(cruzaMeiaNoite({ de: '18:00', ate: '02:00' })).toBe(true);
    expect(cruzaMeiaNoite({ de: '09:00', ate: '18:00' })).toBe(false);
  });
});

describe('validarHorario', () => {
  it('aceita um dia com dois intervalos', () => {
    const h = validarHorario({
      seg: [
        { de: '09:00', ate: '12:00' },
        { de: '13:30', ate: '18:00' },
      ],
    });
    expect(h.seg).toHaveLength(2);
  });

  it('nulo e vazio viram objeto vazio', () => {
    expect(validarHorario(null)).toEqual({});
    expect(validarHorario(undefined)).toEqual({});
    expect(validarHorario({})).toEqual({});
  });

  it('dia sem intervalo nao entra no resultado', () => {
    // Dia sem intervalo é "fechada", e a ausência da chave é como isso se representa.
    expect(validarHorario({ dom: [] })).toEqual({});
  });

  it('recusa dia desconhecido dizendo quais valem', () => {
    expect(() => validarHorario({ segunda: [] })).toThrow(/dom, seg, ter/);
  });

  it('recusa sobreposicao no mesmo dia, nomeando os intervalos', () => {
    /**
     * `09:00-18:00` com `14:00-20:00` não tem leitura única na tela. Quem digitou quis uma das
     * duas coisas, e perguntar é melhor do que escolher por ele.
     */
    expect(() =>
      validarHorario({
        ter: [
          { de: '09:00', ate: '18:00' },
          { de: '14:00', ate: '20:00' },
        ],
      })
    ).toThrow(/se sobrep/);
  });

  it('aceita intervalos encostados', () => {
    // `12:00` fecha e `12:00` abre é contínuo, não sobreposto: o fim é exclusivo.
    expect(() =>
      validarHorario({
        ter: [
          { de: '09:00', ate: '12:00' },
          { de: '12:00', ate: '18:00' },
        ],
      })
    ).not.toThrow();
  });

  it('recusa inicio igual ao fim, explicando as duas saidas', () => {
    // Ambíguo entre "fechada" e "24 horas".
    expect(() => validarHorario({ qua: [{ de: '09:00', ate: '09:00' }] })).toThrow(/24 horas/);
  });

  it('aponta qual dia e qual intervalo esta errado', () => {
    expect(() =>
      validarHorario({ qui: [{ de: '09:00', ate: '18:00' }, { de: '25:00', ate: '20:00' }] })
    ).toThrow(/"qui" intervalo 2/);
  });

  it('recusa mais de quatro intervalos no mesmo dia', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => ({
      de: `0${i + 1}:00`,
      ate: `0${i + 1}:30`,
    }));
    expect(() => validarHorario({ sex: cinco })).toThrow(/m[aá]ximo [eé] 4/);
  });

  it('recusa lista que nao e lista', () => {
    expect(() => validarHorario({ sex: '09:00-18:00' })).toThrow(/lista de intervalos/);
  });

  it('recusa vetor no lugar do objeto de dias', () => {
    expect(() => validarHorario([{ de: '09:00', ate: '18:00' }])).toThrow(/dias da semana/);
  });
});

describe('agoraNaUnidade', () => {
  it('usa o fuso da unidade, nao o do servidor', () => {
    /**
     * O servidor roda em UTC. Às 23:00 UTC de sexta já é sábado em UTC, mas ainda é sexta à
     * noite no Brasil — e é esse o dia que decide se a loja está aberta.
     */
    expect(agoraNaUnidade(SP, sexta('23:00'))).toEqual({ dia: 'sex', minutos: 20 * 60 });
    // Campo Grande é uma hora atrás de São Paulo.
    expect(agoraNaUnidade(CG, sexta('23:00'))).toEqual({ dia: 'sex', minutos: 19 * 60 });
  });

  it('meia-noite local sai como 00:00, nao 24:00', () => {
    // Sem `hourCycle: h23` isto viraria 1440 minutos e a conta erraria por um dia inteiro.
    expect(agoraNaUnidade(SP, sabado('03:00'))).toEqual({ dia: 'sab', minutos: 0 });
  });

  it('fuso invalido cai para o do pais em vez de lancar', () => {
    // Fuso errado no banco não pode derrubar a listagem do catálogo.
    expect(() => agoraNaUnidade('Nao/Existe', sexta('23:00'))).not.toThrow();
    expect(agoraNaUnidade('Nao/Existe', sexta('23:00')).dia).toBe('sex');
  });
});

describe('estaAberta', () => {
  const comercio: HorarioSemanal = {
    seg: [{ de: '09:00', ate: '18:00' }],
    ter: [{ de: '09:00', ate: '18:00' }],
    qua: [{ de: '09:00', ate: '18:00' }],
    qui: [{ de: '09:00', ate: '18:00' }],
    sex: [{ de: '09:00', ate: '18:00' }],
  };

  it('unidade sem horario declarado conta como aberta', () => {
    /**
     * Decisão conservadora: hoje nenhuma unidade tem horário cadastrado, e tratar ausência
     * como "fechada" sumiria com o catálogo inteiro no instante do deploy.
     */
    expect(estaAberta({}, SP, sexta('03:00'))).toBe(true);
    expect(estaAberta(null, SP, sexta('03:00'))).toBe(true);
    expect(semHorario({})).toBe(true);
  });

  it('dentro do intervalo, aberta', () => {
    // 15:00 UTC = 12:00 em SP.
    expect(estaAberta(comercio, SP, sexta('15:00'))).toBe(true);
  });

  it('fora do intervalo, fechada', () => {
    // 11:00 UTC = 08:00 em SP, antes de abrir.
    expect(estaAberta(comercio, SP, sexta('11:00'))).toBe(false);
  });

  it('o minuto de abertura ja conta como aberta', () => {
    // 12:00 UTC = 09:00 em SP.
    expect(estaAberta(comercio, SP, sexta('12:00'))).toBe(true);
  });

  it('o minuto de fechamento ja conta como fechada', () => {
    // 21:00 UTC = 18:00 em SP. O fim é exclusivo: às 18:00 em ponto já fechou.
    expect(estaAberta(comercio, SP, sexta('21:00'))).toBe(false);
    // 20:59 em SP ainda está aberta.
    expect(estaAberta(comercio, SP, sexta('20:59'))).toBe(true);
  });

  it('dia sem intervalo e fechada', () => {
    // Sábado não está no horário comercial acima.
    expect(estaAberta(comercio, SP, sabado('15:00'))).toBe(false);
  });

  it('o mesmo instante da respostas diferentes em fusos diferentes', () => {
    /**
     * É o caso que o relógio do servidor erraria. 21:00 UTC é 18:00 em SP (fechada) e 17:00 em
     * Campo Grande (aberta).
     */
    expect(estaAberta(comercio, SP, sexta('21:00'))).toBe(false);
    expect(estaAberta(comercio, CG, sexta('21:00'))).toBe(true);
  });

  it('intervalo que cruza a meia-noite segue aberto na madrugada seguinte', () => {
    const bar: HorarioSemanal = { sex: [{ de: '18:00', ate: '02:00' }] };
    // 23:00 UTC sexta = 20:00 sexta em SP: aberto.
    expect(estaAberta(bar, SP, sexta('23:00'))).toBe(true);
    // 04:00 UTC sábado = 01:00 sábado em SP, ainda dentro do intervalo que começou na sexta.
    expect(estaAberta(bar, SP, sabado('04:00'))).toBe(true);
    // 06:00 UTC sábado = 03:00 sábado em SP: já fechou.
    expect(estaAberta(bar, SP, sabado('06:00'))).toBe(false);
  });

  it('almoco fechado no meio do dia', () => {
    const h: HorarioSemanal = {
      sex: [
        { de: '09:00', ate: '12:00' },
        { de: '13:30', ate: '18:00' },
      ],
    };
    expect(estaAberta(h, SP, sexta('14:00'))).toBe(true); // 11:00 local
    expect(estaAberta(h, SP, sexta('15:45'))).toBe(false); // 12:45 local, no almoço
    expect(estaAberta(h, SP, sexta('17:00'))).toBe(true); // 14:00 local
  });

  it('24 horas cobre a madrugada', () => {
    const h: HorarioSemanal = { sex: [{ de: '00:00', ate: '23:59' }] };
    // 04:00 UTC sexta = 01:00 sexta em SP.
    expect(estaAberta(h, SP, sexta('04:00'))).toBe(true);
  });
});

describe('proximaAbertura', () => {
  const comercio: HorarioSemanal = {
    seg: [{ de: '09:00', ate: '18:00' }],
    sex: [{ de: '09:00', ate: '18:00' }],
  };

  it('antes de abrir, aponta hoje', () => {
    // 11:00 UTC = 08:00 sexta em SP.
    expect(proximaAbertura(comercio, SP, sexta('11:00'))).toEqual({ dia: 'sex', hora: '09:00' });
  });

  it('depois de fechar, pula para o proximo dia com horario', () => {
    // 23:00 UTC = 20:00 sexta em SP. Sábado e domingo não abrem.
    expect(proximaAbertura(comercio, SP, sexta('23:00'))).toEqual({ dia: 'seg', hora: '09:00' });
  });

  it('sem horario declarado nao ha o que prever', () => {
    expect(proximaAbertura({}, SP, sexta('11:00'))).toBeNull();
  });

  it('abertura que ja passou hoje nao e devolvida', () => {
    // 15:00 UTC = 12:00 sexta: as 09:00 de hoje já passaram, a próxima é segunda.
    expect(proximaAbertura(comercio, SP, sexta('15:00'))).toEqual({ dia: 'seg', hora: '09:00' });
  });
});
