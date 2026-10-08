import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Modal } from '@shared/components/Modal/Modal';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime } from '@shared/utils/formatters';
import {
  opendriverAdmin,
  type CategoryImportResult,
  type CategoryRule,
  type CategoryRuleInput,
  type DetranProvider,
  type DetranProviderInput,
  type DetranTestResult,
  type DivergenceRow,
  type ReclassifyResult,
  type VehicleCategory,
} from '../api';
import { errorText, Pagination, RequireOpenDriver } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

/**
 * Classificação de veículo em Econômico × Conforto.
 *
 * Por que esta tela existe: a categoria define a tarifa (a tela de Preços tem um preço por
 * categoria), e até agora era o próprio motorista que escolhia a dele no cadastro. Ou seja,
 * ele decidia quanto o passageiro paga, e não havia nenhum caminho para corrigir depois —
 * reclassificar exigia apagar e recadastrar o veículo.
 *
 * Agora a consulta ao Detran devolve marca, modelo e ano, e uma tabela de regras decide a
 * categoria. As três abas são as três coisas que um operador precisa fazer com isso:
 *
 *   - **Divergências**: onde o motorista declarou uma coisa e a regra calculou outra. É a
 *     medida de acerto da tabela. Enquanto esta fila for grande, a tabela não está pronta
 *     para decidir tarifa sozinha.
 *   - **Regras**: a tabela marca/modelo/ano, editável e importável por CSV.
 *   - **Consulta por UF**: qual estado tem consulta automática e se o caminho funciona.
 */

const ABAS = [
  { id: 'divergencias', label: 'Divergências' },
  { id: 'regras', label: 'Regras marca/modelo' },
  { id: 'ufs', label: 'Consulta por UF' },
] as const;
type Aba = (typeof ABAS)[number]['id'];

const CATEGORIA_LABEL: Record<VehicleCategory, string> = { Economy: 'Econômico', Comfort: 'Conforto' };
const FONTE_LABEL: Record<string, string> = {
  driver: 'Declarada pelo motorista',
  auto: 'Decidida por regra',
  admin: 'Definida por operador',
};

export function OpenDriverVehicleCategoriesPage() {
  const [aba, setAba] = useState<Aba>('divergencias');
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Categoria dos veículos</h2>
          <p className="text-muted">
            A categoria define a tarifa. Quando a consulta ao Detran responde, a tabela de regras decide se o veículo é
            Econômico ou Conforto. Sem regra que cubra o modelo, vale o que o motorista declarou — e a divergência fica
            registrada aqui.
          </p>
        </div>
      </header>
      <RequireOpenDriver>
        <div className="admin-filters">
          <div className="od-actions">
            {ABAS.map((a) => (
              <Button key={a.id} variant={aba === a.id ? 'primary' : 'ghost'} size="sm" onClick={() => setAba(a.id)}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
        {aba === 'divergencias' ? <Divergencias /> : null}
        {aba === 'regras' ? <Regras /> : null}
        {aba === 'ufs' ? <Ufs /> : null}
      </RequireOpenDriver>
    </div>
  );
}

// ---------------------------------------------------------------- aba 1: divergências

function Divergencias() {
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [ensaio, setEnsaio] = useState<ReclassifyResult | null>(null);
  const q = useQuery({
    queryKey: ['od', 'vehicleDivergences', page],
    queryFn: () => opendriverAdmin.vehicleDivergences({ page }),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['od', 'vehicleDivergences'] });

  /**
   * Reaplicar as regras é feito em dois passos: ensaio e depois aplicação. O ensaio não grava
   * nada e devolve o que mudaria. Mexer na categoria de toda a frota de uma vez é alterar
   * quanto cada motorista recebe — ver a lista antes não é cerimônia, é o mínimo.
   */
  const reclassificar = useMutation({
    mutationFn: (aplicar: boolean) => opendriverAdmin.reclassifyFleet(aplicar),
    onSuccess: (r, aplicar) => {
      if (aplicar) {
        setEnsaio(null);
        invalidar();
        toast.success(`${r.alterados} veículo(s) reclassificado(s) de ${r.avaliados} avaliado(s).`);
      } else {
        setEnsaio(r);
      }
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <div className="row-between">
            <div>
              <h3>Reaplicar as regras na frota</h3>
              <p className="text-muted">
                Usa o retorno do Detran já guardado em cada veículo — não consulta nada e não consome crédito. Serve
                para quando você acabou de mudar uma regra. Veículos definidos por operador não são mexidos.
              </p>
            </div>
          </div>
          <div className="od-actions">
            <Button variant="ghost" disabled={reclassificar.isPending} onClick={() => reclassificar.mutate(false)}>
              Simular
            </Button>
            {ensaio ? (
              <Button
                disabled={reclassificar.isPending}
                onClick={() => {
                  if (!window.confirm(`Aplicar a reclassificação em ${ensaio.alterados} veículo(s)?`)) return;
                  reclassificar.mutate(true);
                }}
              >
                Aplicar em {ensaio.alterados} veículo(s)
              </Button>
            ) : null}
          </div>
          {ensaio ? (
            <div className="stack">
              <p className="text-muted">
                {ensaio.avaliados} avaliados · {ensaio.alterados} mudariam de categoria · {ensaio.divergentes} com
                divergência.
              </p>
              {ensaio.amostra.length ? (
                <table className="history__table">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>De</th>
                      <th>Para</th>
                      <th>Regra calculou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ensaio.amostra.map((a) => (
                      <tr key={a.plate}>
                        <td>{a.plate}</td>
                        <td>{CATEGORIA_LABEL[a.de]}</td>
                        <td>{CATEGORIA_LABEL[a.para]}</td>
                        <td>{a.calculada ? CATEGORIA_LABEL[a.calculada] : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted">Nada mudaria.</p>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={q.data?.items.length === 0}
          emptyLabel="Nenhuma divergência. Toda categoria em uso bate com a regra."
          variant="list"
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Cadastrado pelo motorista</th>
                <th>Retorno do Detran</th>
                <th>Em uso</th>
                <th>Regra calculou</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((v) => (
                <LinhaDivergencia key={v.id} veiculo={v} onMudou={invalidar} />
              ))}
            </tbody>
          </table>
        </QueryState>
        <Pagination page={page} totalPages={q.data?.totalPages ?? 1} onChange={setPage} />
      </Card>
    </div>
  );
}

function LinhaDivergencia({ veiculo, onMudou }: { veiculo: DivergenceRow; onMudou: () => void }) {
  const toast = useToast();

  const fixar = useMutation({
    mutationFn: (p: { category: VehicleCategory; reason: string }) =>
      opendriverAdmin.setVehicleCategory(veiculo.id, p.category, p.reason),
    onSuccess: () => {
      onMudou();
      toast.success('Categoria definida. A revalidação não vai desfazer isso.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const revalidar = useMutation({
    mutationFn: () => opendriverAdmin.revalidateVehicle(veiculo.id),
    onSuccess: () => {
      onMudou();
      toast.success('Veículo consultado no Detran de novo.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const pedirCategoria = (category: VehicleCategory) => {
    const reason = window.prompt(
      `Definir ${CATEGORIA_LABEL[category]} para a placa ${veiculo.plate}. Qual o motivo? (fica na auditoria)`,
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast.error('Escreva o motivo com pelo menos 3 letras.');
      return;
    }
    fixar.mutate({ category, reason: reason.trim() });
  };

  const ocupado = fixar.isPending || revalidar.isPending;

  return (
    <tr>
      <td>
        <strong>{veiculo.plate}</strong>
        <br />
        <small className="text-muted">
          {veiculo.uf ?? 'UF não informada'} · {veiculo.driver?.name ?? 'motorista removido'}
        </small>
      </td>
      <td>
        {veiculo.brand} {veiculo.model}
        <br />
        <small className="text-muted">{veiculo.year}</small>
      </td>
      <td>
        {veiculo.detranBrand ? (
          <>
            {veiculo.detranBrand} {veiculo.detranModel}
            <br />
            <small className="text-muted">{veiculo.detranYear ?? 'ano não informado'}</small>
          </>
        ) : (
          <span className="text-muted">não consultado</span>
        )}
      </td>
      <td>
        <span className="badge badge-primary">{CATEGORIA_LABEL[veiculo.category]}</span>
        <br />
        <small className="text-muted">{FONTE_LABEL[veiculo.categorySource] ?? veiculo.categorySource}</small>
      </td>
      <td>{veiculo.categoryAuto ? CATEGORIA_LABEL[veiculo.categoryAuto] : '—'}</td>
      <td>
        <div className="od-actions">
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => pedirCategoria('Economy')}>
            Econômico
          </Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => pedirCategoria('Comfort')}>
            Conforto
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            onClick={() => {
              // A consulta ao Detran é cobrada por chamada — confirmar evita clique à toa.
              if (!window.confirm('Consultar o Detran de novo? Isso consome crédito da Infosimples.')) return;
              revalidar.mutate();
            }}
          >
            Revalidar
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------- aba 2: regras

const REGRA_VAZIA: CategoryRuleInput = {
  brand: '',
  modelPattern: '',
  yearFrom: null,
  yearTo: null,
  category: 'Economy',
  priority: 100,
  active: true,
};

function Regras() {
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState<{ id: string | null; valores: CategoryRuleInput } | null>(null);
  const [importando, setImportando] = useState(false);

  const q = useQuery({
    queryKey: ['od', 'categoryRules', marca, categoria, page],
    queryFn: () =>
      opendriverAdmin.categoryRules({ brand: marca || undefined, category: categoria || undefined, page }),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['od', 'categoryRules'] });

  const remover = useMutation({
    mutationFn: (id: string) => opendriverAdmin.deleteCategoryRule(id),
    onSuccess: () => {
      invalidar();
      toast.success('Regra removida.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <p className="text-muted">
            O modelo casa por <strong>começo do texto</strong>: a regra <code>COROLLA</code> cobre
            &ldquo;COROLLA XEI 2.0&rdquo;. Modelo em branco cobre a marca inteira. Quando duas regras servem, ganha a de
            menor prioridade; empatando, ganha a de modelo mais específico.
          </p>
          <div className="od-actions">
            <Button size="sm" onClick={() => setEditando({ id: null, valores: REGRA_VAZIA })}>
              Nova regra
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setImportando(true)}>
              Importar CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="admin-filters">
        <Input
          label="Marca"
          placeholder="ex.: Fiat"
          value={marca}
          onChange={(e) => {
            setMarca(e.target.value);
            setPage(1);
          }}
        />
        <div className="admin-filters__select">
          <label htmlFor="regra-categoria">Categoria</label>
          <select
            id="regra-categoria"
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            <option value="Economy">Econômico</option>
            <option value="Comfort">Conforto</option>
          </select>
        </div>
      </div>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={q.data?.items.length === 0}
          emptyLabel="Nenhuma regra com esse filtro."
          variant="list"
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Modelo começa com</th>
                <th>Anos</th>
                <th>Categoria</th>
                <th>Prioridade</th>
                <th>Origem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((r) => (
                <tr key={r.id} className={r.active ? undefined : 'text-muted'}>
                  <td>{r.brand}</td>
                  <td>{r.modelPattern || <em className="text-muted">marca inteira</em>}</td>
                  <td>{faixaDeAno(r)}</td>
                  <td>
                    <span className="badge badge-primary">{CATEGORIA_LABEL[r.category]}</span>
                  </td>
                  <td>{r.priority}</td>
                  <td>
                    <small className="text-muted">{r.source}</small>
                    {r.active ? null : <small className="text-muted"> · inativa</small>}
                  </td>
                  <td>
                    <div className="od-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditando({ id: r.id, valores: paraEntrada(r) })}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={remover.isPending}
                        onClick={() => {
                          if (!window.confirm(`Remover a regra ${r.brand} ${r.modelPattern || '(marca inteira)'}?`)) return;
                          remover.mutate(r.id);
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
        <Pagination page={page} totalPages={q.data?.totalPages ?? 1} onChange={setPage} />
      </Card>

      {editando ? (
        <ModalDeRegra
          id={editando.id}
          valores={editando.valores}
          onFechar={() => setEditando(null)}
          onSalvou={() => {
            setEditando(null);
            invalidar();
          }}
        />
      ) : null}
      {importando ? (
        <ModalDeImportacao
          onFechar={() => setImportando(false)}
          onImportou={() => {
            setImportando(false);
            invalidar();
          }}
        />
      ) : null}
    </div>
  );
}

const faixaDeAno = (r: { yearFrom: number | null; yearTo: number | null }) => {
  if (r.yearFrom === null && r.yearTo === null) return 'todos';
  if (r.yearFrom !== null && r.yearTo !== null) return `${r.yearFrom}–${r.yearTo}`;
  return r.yearFrom !== null ? `de ${r.yearFrom}` : `até ${r.yearTo}`;
};

const paraEntrada = (r: CategoryRule): CategoryRuleInput => ({
  brand: r.brand,
  modelPattern: r.modelPattern,
  yearFrom: r.yearFrom,
  yearTo: r.yearTo,
  category: r.category,
  priority: r.priority,
  active: r.active,
});

function ModalDeRegra({
  id,
  valores,
  onFechar,
  onSalvou,
}: {
  id: string | null;
  valores: CategoryRuleInput;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState(valores);
  // Os anos ficam como texto enquanto o operador digita: um `number` vazio viraria NaN e o
  // campo não aceitaria ser limpo.
  const [de, setDe] = useState(valores.yearFrom === null ? '' : String(valores.yearFrom));
  const [ate, setAte] = useState(valores.yearTo === null ? '' : String(valores.yearTo));

  const anoOuNulo = (s: string) => (s.trim() === '' ? null : Number(s));
  const anoInvalido = (s: string) => {
    const n = anoOuNulo(s);
    return n !== null && (!Number.isInteger(n) || n < 1900 || n > 2100);
  };
  const faixaInvertida = (() => {
    const a = anoOuNulo(de);
    const b = anoOuNulo(ate);
    return a !== null && b !== null && a > b;
  })();
  const invalido =
    v.brand.trim().length < 2 ||
    anoInvalido(de) ||
    anoInvalido(ate) ||
    faixaInvertida ||
    !Number.isInteger(v.priority) ||
    v.priority < 0;

  const salvar = useMutation({
    mutationFn: () => {
      const corpo: CategoryRuleInput = { ...v, yearFrom: anoOuNulo(de), yearTo: anoOuNulo(ate) };
      return id ? opendriverAdmin.updateCategoryRule(id, corpo) : opendriverAdmin.createCategoryRule(corpo);
    },
    onSuccess: () => {
      toast.success(id ? 'Regra atualizada.' : 'Regra criada.');
      onSalvou();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Modal open title={id ? 'Editar regra' : 'Nova regra'} onClose={onFechar} closeDisabled={salvar.isPending}>
      <div className="stack">
        <Input
          label="Marca"
          value={v.brand}
          onChange={(e) => setV({ ...v, brand: e.target.value })}
          hint="Aceita o código do Detran: VW e GM viram Volkswagen e Chevrolet."
          maxLength={60}
          error={v.brand.trim().length > 0 && v.brand.trim().length < 2 ? 'Informe a marca.' : undefined}
        />
        <Input
          label="Modelo começa com"
          value={v.modelPattern}
          onChange={(e) => setV({ ...v, modelPattern: e.target.value })}
          hint="Em branco cobre a marca inteira."
          maxLength={80}
        />
        <div className="row">
          <Input
            label="Do ano"
            inputMode="numeric"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            error={anoInvalido(de) ? 'Entre 1900 e 2100.' : undefined}
          />
          <Input
            label="Até o ano"
            inputMode="numeric"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            error={anoInvalido(ate) ? 'Entre 1900 e 2100.' : faixaInvertida ? 'O ano final é menor que o inicial.' : undefined}
          />
        </div>
        <div className="admin-filters__select">
          <label htmlFor="regra-cat">Categoria</label>
          <select
            id="regra-cat"
            value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value as VehicleCategory })}
          >
            <option value="Economy">Econômico</option>
            <option value="Comfort">Conforto</option>
          </select>
        </div>
        <Input
          label="Prioridade"
          inputMode="numeric"
          value={String(v.priority)}
          onChange={(e) => setV({ ...v, priority: Number(e.target.value.replace(/\D/g, '') || '0') })}
          hint="Menor ganha. 100 é o normal; use menos para exceções."
        />
        <label>
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Ativa
        </label>
        <div className="od-actions">
          <Button disabled={invalido || salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Button>
          <Button variant="ghost" disabled={salvar.isPending} onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const EXEMPLO_CSV = 'marca;modelo;ano_de;ano_ate;categoria;prioridade\nFiat;Argo;;;Economico;100\nToyota;Corolla;;;Conforto;100';

function ModalDeImportacao({ onFechar, onImportou }: { onFechar: () => void; onImportou: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [substituir, setSubstituir] = useState(false);
  const [ensaio, setEnsaio] = useState<CategoryImportResult | null>(null);

  const importar = useMutation({
    mutationFn: (aplicar: boolean) =>
      opendriverAdmin.importCategoryRules(csv, { aplicar, substituirImportadas: substituir }),
    onSuccess: (r) => {
      if (r.aplicado) {
        toast.success(`${r.gravadas ?? 0} regra(s) gravada(s).`);
        onImportou();
      } else {
        setEnsaio(r);
      }
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Modal open title="Importar regras de CSV" onClose={onFechar} closeDisabled={importar.isPending}>
      <div className="stack">
        <p className="text-muted">
          Colunas nesta ordem: marca, modelo, ano inicial, ano final, categoria, prioridade. Separador <code>;</code> ou{' '}
          <code>,</code>. Cabeçalho é opcional. Linhas com erro são recusadas uma a uma — o resto entra.
        </p>
        <label className="stack">
          <span>Conteúdo do CSV</span>
          <textarea
            rows={10}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setEnsaio(null);
            }}
            placeholder={EXEMPLO_CSV}
            spellCheck={false}
          />
        </label>
        <label>
          <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} /> Apagar as
          regras importadas antes (não mexe nas criadas à mão nem na carga inicial)
        </label>

        {ensaio ? (
          <div className="stack">
            <p className="text-muted">
              {ensaio.lidas} linha(s) lida(s) · {ensaio.gravariam ?? 0} seriam gravadas · {ensaio.erros.length}{' '}
              recusada(s).
            </p>
            {ensaio.repetidasNoArquivo.length ? (
              <p className="text-muted">
                Linhas repetidas no arquivo (a última vence): {ensaio.repetidasNoArquivo.join(', ')}
              </p>
            ) : null}
            {ensaio.erros.length ? (
              <table className="history__table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Motivo</th>
                    <th>Conteúdo</th>
                  </tr>
                </thead>
                <tbody>
                  {ensaio.erros.slice(0, 30).map((e) => (
                    <tr key={e.linha}>
                      <td>{e.linha}</td>
                      <td>{e.motivo}</td>
                      <td>
                        <code>{e.conteudo}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}

        <div className="od-actions">
          <Button variant="ghost" disabled={!csv.trim() || importar.isPending} onClick={() => importar.mutate(false)}>
            Conferir
          </Button>
          <Button
            disabled={!ensaio || !(ensaio.gravariam ?? 0) || importar.isPending}
            onClick={() => importar.mutate(true)}
          >
            Gravar {ensaio?.gravariam ?? 0} regra(s)
          </Button>
          <Button variant="ghost" disabled={importar.isPending} onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- aba 3: UFs

function Ufs() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<{ uf: string; valores: DetranProviderInput } | null>(null);
  const [testando, setTestando] = useState<DetranProvider | null>(null);
  const q = useQuery({ queryKey: ['od', 'detranProviders'], queryFn: () => opendriverAdmin.detranProviders() });

  return (
    <div className="stack">
      <Card>
        <p className="text-muted">
          Cada estado tem um serviço de consulta próprio, e eles pedem coisas diferentes. A lista fica aqui, e não no
          código, porque o endereço de um serviço não dá para confirmar sem consultar de verdade: sem token a resposta é
          sempre erro de autenticação, antes de o endereço ser conferido. Corrigir um endereço errado é editar aqui e
          clicar em testar.
        </p>
      </Card>

      <QueryState loading={q.isLoading} error={q.error} variant="cards">
        <div className="od-pricing">
          {q.data?.map((p) => (
            <Card key={p.uf}>
              <div className="stack">
                <div className="row-between">
                  <h3>{p.uf}</h3>
                  <span className={p.active ? 'badge badge-primary' : 'badge'}>{p.active ? 'Ativa' : 'Desativada'}</span>
                </div>
                <p>{p.label}</p>
                <dl className="od-kv">
                  <dt>Endereço</dt>
                  <dd>
                    <code>{p.endpoint}</code>
                  </dd>
                  <dt>Exige</dt>
                  <dd>
                    {[
                      p.requiresChassi && 'chassi',
                      p.requiresLogin && 'login do gov.br',
                      p.requiresCpfCnpj && 'CPF/CNPJ do dono',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'placa e RENAVAM'}
                  </dd>
                  <dt>Última consulta</dt>
                  <dd>
                    {p.lastProbeAt ? (
                      <>
                        {formatDateTime(p.lastProbeAt)}
                        <br />
                        <small className="text-muted">{p.lastProbeResult}</small>
                      </>
                    ) : (
                      <span className="text-muted">nunca consultada</span>
                    )}
                  </dd>
                </dl>
                {p.notes ? <small className="text-muted">{p.notes}</small> : null}
                <div className="od-actions">
                  <Button size="sm" variant="ghost" onClick={() => setEditando({ uf: p.uf, valores: paraEntradaUf(p) })}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTestando(p)}>
                    Testar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      {editando ? (
        <ModalDeUf
          uf={editando.uf}
          valores={editando.valores}
          onFechar={() => setEditando(null)}
          onSalvou={() => {
            setEditando(null);
            qc.invalidateQueries({ queryKey: ['od', 'detranProviders'] });
          }}
        />
      ) : null}
      {testando ? <ModalDeTeste provedor={testando} onFechar={() => setTestando(null)} /> : null}
    </div>
  );
}

const paraEntradaUf = (p: DetranProvider): DetranProviderInput => ({
  label: p.label,
  endpoint: p.endpoint,
  requiresChassi: p.requiresChassi,
  requiresLogin: p.requiresLogin,
  requiresCpfCnpj: p.requiresCpfCnpj,
  loginSettingKey: p.loginSettingKey,
  senhaSettingKey: p.senhaSettingKey,
  active: p.active,
  notes: p.notes,
});

function ModalDeUf({
  uf,
  valores,
  onFechar,
  onSalvou,
}: {
  uf: string;
  valores: DetranProviderInput;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState(valores);
  const urlOk = /^https?:\/\/.+/.test(v.endpoint.trim());
  /**
   * Quando a UF exige login, as duas chaves de credencial são obrigatórias. Sem isso dá para
   * salvar um provedor ativo que não tem de onde ler a senha — e aí todo veículo daquele
   * estado cai em revisão manual sem o operador saber por quê.
   */
  const credencialIncompleta = v.requiresLogin && !(v.loginSettingKey?.trim() && v.senhaSettingKey?.trim());
  const invalido = v.label.trim().length < 2 || !urlOk || credencialIncompleta;

  const salvar = useMutation({
    mutationFn: () => opendriverAdmin.saveDetranProvider(uf, v),
    onSuccess: () => {
      toast.success(`Consulta de ${uf} atualizada.`);
      onSalvou();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Modal open title={`Consulta do Detran — ${uf}`} onClose={onFechar} closeDisabled={salvar.isPending}>
      <div className="stack">
        <Input label="Nome" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} maxLength={80} />
        <Input
          label="Endereço do serviço"
          value={v.endpoint}
          onChange={(e) => setV({ ...v, endpoint: e.target.value })}
          maxLength={300}
          error={v.endpoint.trim() && !urlOk ? 'Informe a URL completa, com https://' : undefined}
        />
        <label>
          <input
            type="checkbox"
            checked={v.requiresChassi}
            onChange={(e) => setV({ ...v, requiresChassi: e.target.checked })}
          />{' '}
          Exige chassi
        </label>
        <label>
          <input
            type="checkbox"
            checked={v.requiresCpfCnpj}
            onChange={(e) => setV({ ...v, requiresCpfCnpj: e.target.checked })}
          />{' '}
          Exige o CPF/CNPJ do proprietário
        </label>
        <label>
          <input
            type="checkbox"
            checked={v.requiresLogin}
            onChange={(e) => setV({ ...v, requiresLogin: e.target.checked })}
          />{' '}
          Exige login do gov.br
        </label>
        {v.requiresLogin ? (
          <>
            <Input
              label="Chave do login em Integrações"
              value={v.loginSettingKey ?? ''}
              onChange={(e) => setV({ ...v, loginSettingKey: e.target.value })}
              hint="O valor da credencial fica em Integrações, não aqui. Ex.: Infosimples:GoLoginCpf"
              maxLength={80}
            />
            <Input
              label="Chave da senha em Integrações"
              value={v.senhaSettingKey ?? ''}
              onChange={(e) => setV({ ...v, senhaSettingKey: e.target.value })}
              maxLength={80}
              error={credencialIncompleta ? 'As duas chaves são obrigatórias quando a UF exige login.' : undefined}
            />
          </>
        ) : null}
        <label>
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Consulta
          ativa
        </label>
        <Input
          label="Observação"
          value={v.notes ?? ''}
          onChange={(e) => setV({ ...v, notes: e.target.value })}
          maxLength={400}
        />
        <div className="od-actions">
          <Button disabled={invalido || salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Button>
          <Button variant="ghost" disabled={salvar.isPending} onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModalDeTeste({ provedor, onFechar }: { provedor: DetranProvider; onFechar: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [plate, setPlate] = useState('');
  const [renavam, setRenavam] = useState('');
  const [chassi, setChassi] = useState('');
  const [ownerDocument, setOwnerDocument] = useState('');
  const [resultado, setResultado] = useState<DetranTestResult | null>(null);

  const placaOk = plate.replace(/[^A-Za-z0-9]/g, '').length === 7;
  const renavamOk = /^\d{9,11}$/.test(renavam.replace(/\D/g, ''));
  const invalido =
    !placaOk ||
    !renavamOk ||
    (provedor.requiresChassi && chassi.trim().length < 5) ||
    (provedor.requiresCpfCnpj && ownerDocument.replace(/\D/g, '').length < 11);

  const testar = useMutation({
    mutationFn: () =>
      opendriverAdmin.testDetranProvider(provedor.uf, {
        plate: plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
        renavam: renavam.replace(/\D/g, ''),
        chassi: chassi.trim() || undefined,
        ownerDocument: ownerDocument.replace(/\D/g, '') || undefined,
      }),
    onSuccess: (r) => {
      setResultado(r);
      // A consulta grava o resultado no provedor, então a lista de UFs fica desatualizada.
      qc.invalidateQueries({ queryKey: ['od', 'detranProviders'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Modal open title={`Testar a consulta de ${provedor.uf}`} onClose={onFechar} closeDisabled={testar.isPending}>
      <div className="stack">
        <p className="text-muted">
          Use uma placa e um RENAVAM de verdade. A consulta é executada e <strong>consome crédito</strong> da
          Infosimples — é o único jeito de saber se o endereço do serviço está certo.
        </p>
        <Input
          label="Placa"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          maxLength={8}
          error={plate && !placaOk ? 'A placa tem 7 caracteres.' : undefined}
        />
        <Input
          label="RENAVAM"
          inputMode="numeric"
          value={renavam}
          onChange={(e) => setRenavam(e.target.value)}
          maxLength={11}
          error={renavam && !renavamOk ? 'O RENAVAM tem de 9 a 11 dígitos.' : undefined}
        />
        {provedor.requiresChassi ? (
          <Input label="Chassi" value={chassi} onChange={(e) => setChassi(e.target.value.toUpperCase())} maxLength={30} />
        ) : null}
        {provedor.requiresCpfCnpj ? (
          <Input
            label="CPF/CNPJ do proprietário"
            inputMode="numeric"
            value={ownerDocument}
            onChange={(e) => setOwnerDocument(e.target.value)}
            maxLength={18}
          />
        ) : null}

        {resultado ? (
          <div className="stack">
            <dl className="od-kv">
              <dt>HTTP</dt>
              <dd>{resultado.httpStatus ?? '—'}</dd>
              <dt>Código</dt>
              <dd>{resultado.code ?? '—'}</dd>
              <dt>Mensagem</dt>
              <dd>{resultado.message || '—'}</dd>
            </dl>
            <details>
              <summary>Resposta completa</summary>
              <pre className="admin-audit__payload">{JSON.stringify(resultado.body, null, 2)}</pre>
            </details>
          </div>
        ) : null}

        <div className="od-actions">
          <Button disabled={invalido || testar.isPending} onClick={() => testar.mutate()}>
            {testar.isPending ? 'Consultando…' : 'Consultar'}
          </Button>
          <Button variant="ghost" disabled={testar.isPending} onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
