import { Button } from '@shared/components/Button/Button';
import type { DiaDaSemana, OpeningHours } from '@shared/api/endpoints';
import './OpeningHoursEditor.css';

/**
 * Editor de horário de funcionamento de uma unidade.
 *
 * ============================================================================
 * Por que "copiar para os outros dias"
 * ============================================================================
 *
 * Porque o caso comum é o mesmo horário de segunda a sexta ou de segunda a sábado, e sem o
 * atalho o lojista preenche sete linhas à mão. Formulário que dá trabalho fica em branco, e
 * unidade sem horário cadastrado é exatamente o que esta tela existe para evitar.
 *
 * ============================================================================
 * Intervalo que cruza a meia-noite
 * ============================================================================
 *
 * `18:00`–`02:00` é válido e é o horário mais comum do ramo de alimentação. A regra está no
 * servidor (`domain/openingHours.ts`): fim menor ou igual ao início significa que o intervalo
 * invade o dia seguinte. Aqui a tela só avisa, para o lojista não achar que digitou errado.
 */

const DIAS: { chave: DiaDaSemana; rotulo: string }[] = [
  { chave: 'seg', rotulo: 'Segunda' },
  { chave: 'ter', rotulo: 'Terça' },
  { chave: 'qua', rotulo: 'Quarta' },
  { chave: 'qui', rotulo: 'Quinta' },
  { chave: 'sex', rotulo: 'Sexta' },
  { chave: 'sab', rotulo: 'Sábado' },
  { chave: 'dom', rotulo: 'Domingo' },
];

/** Mesmo teto do servidor. Quatro cobre o dia mais fragmentado que existe de verdade. */
const MAX_INTERVALOS = 4;

const PADRAO = { de: '09:00', ate: '18:00' };

interface Props {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}

export function OpeningHoursEditor({ value, onChange }: Props) {
  const intervalos = (dia: DiaDaSemana) => value[dia] ?? [];

  const definir = (dia: DiaDaSemana, lista: { de: string; ate: string }[]) => {
    const next = { ...value };
    // Dia sem intervalo é "fechada", e a ausência da chave é como isso se representa — o
    // servidor recusa `[]` como ambíguo.
    if (lista.length === 0) delete next[dia];
    else next[dia] = lista;
    onChange(next);
  };

  const alternar = (dia: DiaDaSemana) =>
    definir(dia, intervalos(dia).length > 0 ? [] : [{ ...PADRAO }]);

  const editar = (dia: DiaDaSemana, i: number, campo: 'de' | 'ate', v: string) => {
    const lista = intervalos(dia).map((x, idx) => (idx === i ? { ...x, [campo]: v } : x));
    definir(dia, lista);
  };

  const acrescentar = (dia: DiaDaSemana) => {
    const lista = intervalos(dia);
    if (lista.length >= MAX_INTERVALOS) return;
    definir(dia, [...lista, { ...PADRAO }]);
  };

  const remover = (dia: DiaDaSemana, i: number) =>
    definir(dia, intervalos(dia).filter((_, idx) => idx !== i));

  /** Copia o dia para os outros **dias já abertos**, sem abrir dia nenhum. */
  const copiarParaOsOutros = (dia: DiaDaSemana) => {
    const modelo = intervalos(dia);
    if (modelo.length === 0) return;
    const next = { ...value };
    for (const d of DIAS) {
      /**
       * Só sobrescreve dia que já está aberto. Copiar para todos abriria domingo numa loja que
       * fecha domingo — e o lojista descobriria isso pelo cliente batendo na porta.
       */
      if (d.chave === dia) continue;
      if ((next[d.chave] ?? []).length === 0) continue;
      next[d.chave] = modelo.map((x) => ({ ...x }));
    }
    onChange(next);
  };

  const limpar = () => onChange({});

  const algumDiaAberto = DIAS.some((d) => intervalos(d.chave).length > 0);

  return (
    <div className="horario">
      <div className="row-between">
        <span className="input-field__label">Horário de funcionamento</span>
        {algumDiaAberto && (
          <Button type="button" size="sm" variant="ghost" onClick={limpar}>
            Limpar tudo
          </Button>
        )}
      </div>

      {!algumDiaAberto && (
        <small className="text-muted">
          Sem horário cadastrado, a unidade aparece como <strong>aberta</strong> no catálogo —
          é o comportamento de antes. Marque os dias para o filtro de “aberto agora” passar a
          valer para esta unidade.
        </small>
      )}

      <div className="horario__dias">
        {DIAS.map(({ chave, rotulo }) => {
          const lista = intervalos(chave);
          const aberto = lista.length > 0;
          return (
            <div className="horario__dia" key={chave}>
              <label className="horario__toggle">
                <input type="checkbox" checked={aberto} onChange={() => alternar(chave)} />
                <span>{rotulo}</span>
              </label>

              {!aberto ? (
                <small className="text-muted">Fechada</small>
              ) : (
                <div className="horario__intervalos">
                  {lista.map((intervalo, i) => {
                    const viraODia = intervalo.ate <= intervalo.de;
                    return (
                      <div className="horario__intervalo" key={i}>
                        <input
                          type="time"
                          className="horario__hora"
                          aria-label={`${rotulo}: início do intervalo ${i + 1}`}
                          value={intervalo.de}
                          onChange={(e) => editar(chave, i, 'de', e.target.value)}
                        />
                        <span aria-hidden>às</span>
                        <input
                          type="time"
                          className="horario__hora"
                          aria-label={`${rotulo}: fim do intervalo ${i + 1}`}
                          value={intervalo.ate}
                          onChange={(e) => editar(chave, i, 'ate', e.target.value)}
                        />
                        {viraODia && (
                          <small className="horario__aviso" title="Fecha no dia seguinte">
                            vira o dia
                          </small>
                        )}
                        {lista.length > 1 && (
                          <button
                            type="button"
                            className="horario__remover"
                            aria-label={`Remover intervalo ${i + 1} de ${rotulo}`}
                            onClick={() => remover(chave, i)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div className="horario__acoes">
                    {lista.length < MAX_INTERVALOS && (
                      <button
                        type="button"
                        className="horario__link"
                        onClick={() => acrescentar(chave)}
                      >
                        + intervalo
                      </button>
                    )}
                    <button
                      type="button"
                      className="horario__link"
                      onClick={() => copiarParaOsOutros(chave)}
                      title="Aplica este horário aos outros dias que já estão abertos"
                    >
                      copiar para os outros dias abertos
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
