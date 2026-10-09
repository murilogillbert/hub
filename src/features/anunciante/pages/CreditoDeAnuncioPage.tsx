import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import {
  anuncianteApi,
  MOTIVO,
  openadConfigured,
  type CompraDeCredito,
} from '../api';
import './CreditoDeAnuncio.css';

/**
 * Compra de crédito de veiculação por Pix.
 *
 * ============================================================================
 * Por que o painel é web
 * ============================================================================
 *
 * Decisão de 2026-10-07: comprar dentro do app exigiria in-app purchase pela política do
 * Google, com taxa de 15 a 30%. O preço unitário da veiculação é R$ 0,045 por exibição — a taxa
 * sairia do que sobra para a plataforma e para o motorista. O app do anunciante gerencia; a
 * compra é aqui.
 *
 * ============================================================================
 * Por que a tela espera, em vez de confirmar
 * ============================================================================
 *
 * A confirmação do pagamento **não passa pelo navegador**. O Asaas avisa o hub, o hub
 * reconsulta o status no provedor e chama o OpenAd. Se a tela pudesse confirmar, bastaria
 * alguém forjar a chamada para creditar saldo sem pagar.
 *
 * Então a tela consulta o saldo de tempo em tempo enquanto há cobrança pendente, e para quando
 * o crédito entra. É menos imediato e é o único desenho em que o crédito reflete dinheiro.
 */

/** Valores sugeridos, em centavos. Cobrem de um teste pequeno a um mês de veiculação. */
const SUGESTOES = [5_000, 20_000, 50_000, 90_000, 200_000];

/**
 * Reais com **quatro** decimais, para valores menores que um centavo.
 *
 * `formatCurrency` arredonda para centavo, e aqui isso mente: o preço é R$ 0,003 por segundo
 * de tela, e com dois decimais a tela dizia **"R$ 0,00 por segundo"** — ou seja, que veicular
 * é de graça, logo acima de uma tabela que cobrava R$ 0,0300 por dez segundos. Visto no
 * tablete em 2026-10-08.
 *
 * Não é arredondamento inofensivo porque o número é uma **taxa**, não um total: um total de
 * R$ 0,004 arredondado para R$ 0,00 é "praticamente zero", mas uma taxa arredondada para zero
 * diz que o serviço não cobra.
 *
 * Existe como função, e não repetido em cada lugar, porque antes havia dois
 * `.toFixed(4).replace('.', ',')` soltos na mesma tela e o do título ficou de fora.
 */
function reaisDetalhado(valor: number): string {
  return `R$ ${valor.toFixed(4).replace('.', ',')}`;
}

/** De quanto em quanto tempo a tela reconsulta enquanto espera o Pix. */
const INTERVALO_DE_ESPERA_MS = 10_000;

export function CreditoDeAnuncioPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [valorEmReais, setValorEmReais] = useState('200,00');
  const [cobranca, setCobranca] = useState<CompraDeCredito | null>(null);

  const adesao = useQuery({
    queryKey: ['openad', 'adesao'],
    queryFn: ({ signal }) => anuncianteApi.adesao(signal),
    enabled: openadConfigured,
    retry: false,
  });
  const ehAnunciante = adesao.data?.precisaAderir === false;

  const saldo = useQuery({
    queryKey: ['openad', 'saldo'],
    queryFn: ({ signal }) => anuncianteApi.saldo(signal),
    enabled: ehAnunciante,
  });

  const tabela = useQuery({
    queryKey: ['openad', 'tabela-de-preco'],
    queryFn: ({ signal }) => anuncianteApi.tabela(signal),
    enabled: ehAnunciante,
  });

  const compras = useQuery({
    queryKey: ['openad', 'compras'],
    queryFn: ({ signal }) => anuncianteApi.compras(1, 10, signal),
    enabled: ehAnunciante,
  });

  const extrato = useQuery({
    queryKey: ['openad', 'extrato'],
    queryFn: ({ signal }) => anuncianteApi.extrato(1, 20, signal),
    enabled: ehAnunciante,
  });

  /**
   * Enquanto houver cobrança pendente, reconsulta saldo e compras.
   *
   * Depende da lista de compras do servidor, e não só da cobrança recém-criada: uma cobrança
   * gerada em outra aba, ou antes de recarregar a página, também precisa ser acompanhada — do
   * contrário o anunciante pagaria e a tela continuaria dizendo "aguardando" para sempre.
   */
  const temPendente = useMemo(
    () => (compras.data?.items ?? []).some((c) => c.status === 'pending'),
    [compras.data]
  );

  useEffect(() => {
    if (!temPendente || !ehAnunciante) return;
    const id = window.setInterval(() => {
      void saldo.refetch();
      void compras.refetch();
      void extrato.refetch();
    }, INTERVALO_DE_ESPERA_MS);
    return () => window.clearInterval(id);
    // `refetch` é estável entre renderizações no react-query v5.
  }, [temPendente, ehAnunciante, saldo.refetch, compras.refetch, extrato.refetch]);

  /** A cobrança mostrada é a recém-criada ou, ao recarregar, a pendente mais recente. */
  const cobrancaVisivel =
    cobranca ?? (compras.data?.items ?? []).find((c) => c.status === 'pending' && c.pixCopyPaste) ?? null;

  const centavos = useMemo(() => emCentavos(valorEmReais), [valorEmReais]);
  const minimo = tabela.data?.minimumCents ?? 2_000;
  const maximo = tabela.data?.maximumCents ?? 5_000_000;

  const aderir = useMutation({
    mutationFn: () => anuncianteApi.aderir(),
    onSuccess: () => {
      toast.success('Conta de anunciante criada.');
      void queryClient.invalidateQueries({ queryKey: ['openad'] });
    },
    onError: (e: unknown) => toast.error(texto(e, 'Não foi possível criar a conta de anunciante.')),
  });

  const comprar = useMutation({
    mutationFn: () => anuncianteApi.comprarComPix(centavos),
    onSuccess: (c) => {
      setCobranca(c);
      void queryClient.invalidateQueries({ queryKey: ['openad', 'compras'] });
      toast.success('Cobrança Pix gerada. Pague para liberar o crédito.');
    },
    onError: (e: unknown) => toast.error(texto(e, 'Não foi possível gerar a cobrança.')),
  });

  if (!openadConfigured) {
    return (
      <div className="credito">
        <Card>
          <h3>Painel de crédito indisponível</h3>
          <p className="text-muted">
            Defina <code>VITE_OPENAD_API_URL</code> no build do painel (ex.:
            https://adsapi.opendriver.com.br) e inclua a origem deste painel em{' '}
            <code>CORS_ORIGINS</code> da API do OpenAd.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="credito">
      <header className="credito__header">
        <div>
          <h2>Crédito de veiculação</h2>
          <p className="text-muted">
            O crédito é consumido por segundo de tela e só serve para veicular anúncio — não é
            sacável nem transferível.
          </p>
        </div>
      </header>

      <QueryState loading={adesao.isLoading} error={adesao.error}>
        {adesao.data?.precisaAderir ? (
          <Card>
            <h3>Ativar sua conta de anunciante</h3>
            <p className="text-muted">
              Sua conta <strong>{adesao.data.conta.email}</strong> ainda não é uma conta de
              anunciante no OpenAd. Ativar é instantâneo e não cobra nada.
            </p>
            <Button onClick={() => aderir.mutate()} disabled={aderir.isPending}>
              {aderir.isPending ? 'Ativando…' : 'Ativar conta de anunciante'}
            </Button>
          </Card>
        ) : (
          <>
            <section className="credito__saldo">
              <Card>
                <small className="text-muted">Disponível para reservar</small>
                <strong className="credito__valor text-accent">
                  {formatCurrency(saldo.data?.disponivel ?? 0)}
                </strong>
                <small className="text-muted">É o que libera campanha no próximo ciclo.</small>
              </Card>
              <Card>
                <small className="text-muted">Reservado neste ciclo</small>
                <strong className="credito__valor">{formatCurrency(saldo.data?.retido ?? 0)}</strong>
                <small className="text-muted">
                  Já comprometido com campanha no ar. Não desapareceu: está em uso.
                </small>
              </Card>
              <Card>
                <small className="text-muted">Saldo total</small>
                <strong className="credito__valor">{formatCurrency(saldo.data?.total ?? 0)}</strong>
                <small className="text-muted">Soma de tudo que entrou menos o que foi gasto.</small>
              </Card>
            </section>

            {(saldo.data?.total ?? 0) < 0 && (
              <Card className="credito__alerta">
                <strong>Saldo negativo.</strong>{' '}
                <span className="text-muted">
                  Um crédito já gasto foi devolvido ao pagador. Nenhuma campanha veicula enquanto
                  o saldo não voltar a ser positivo.
                </span>
              </Card>
            )}

            <div className="credito__colunas">
              <Card>
                <h3>Comprar crédito</h3>
                <Input
                  label="Valor (R$)"
                  inputMode="decimal"
                  value={valorEmReais}
                  onChange={(e) => setValorEmReais(e.target.value)}
                  leftAddon="R$"
                  hint={`Mínimo ${formatCurrency(minimo / 100)}, máximo ${formatCurrency(maximo / 100)} por cobrança.`}
                  error={
                    centavos > 0 && centavos < minimo
                      ? `Abaixo do mínimo de ${formatCurrency(minimo / 100)}.`
                      : centavos > maximo
                        ? `Acima do máximo de ${formatCurrency(maximo / 100)}. Faça duas cobranças.`
                        : undefined
                  }
                />
                <div className="credito__sugestoes">
                  {SUGESTOES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="credito__sugestao"
                      onClick={() => setValorEmReais((v / 100).toFixed(2).replace('.', ','))}
                    >
                      {formatCurrency(v / 100)}
                    </button>
                  ))}
                </div>

                {tabela.data && centavos >= minimo && (
                  <p className="credito__previsao text-muted">
                    Dá para cerca de{' '}
                    <strong>{exibicoes(centavos, tabela.data.pricePerSecondMicros, 15)}</strong>{' '}
                    exibições de 15 segundos.
                  </p>
                )}

                <Button
                  fullWidth
                  onClick={() => comprar.mutate()}
                  disabled={comprar.isPending || centavos < minimo || centavos > maximo}
                >
                  {comprar.isPending ? 'Gerando cobrança…' : 'Gerar cobrança Pix'}
                </Button>
              </Card>

              <Card>
                <h3>Tabela de preço</h3>
                <QueryState loading={tabela.isLoading} error={tabela.error}>
                  <p className="text-muted">
                    {reaisDetalhado(tabela.data?.pricePerSecond ?? 0)} por segundo de tela. Imagem
                    conta como 15 segundos.
                  </p>
                  <table className="credito__tabela">
                    <thead>
                      <tr>
                        <th>Duração</th>
                        <th>Custo por exibição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tabela.data?.byDuration ?? []).map((l) => (
                        <tr key={l.seconds}>
                          <td>{l.seconds}s</td>
                          {/*
                            Quatro decimais de propósito: uma exibição de 15 s custa R$ 0,045, e
                            arredondar para centavo mostraria R$ 0,05 — 11% a mais do que é
                            cobrado, sempre para cima.
                          */}
                          <td>{reaisDetalhado(l.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </QueryState>
              </Card>
            </div>

            {cobrancaVisivel?.pixCopyPaste && (
              <Card className="credito__pix">
                <h3>Pague {formatCurrency(cobrancaVisivel.amount)} por Pix</h3>
                <div className="credito__pix-corpo">
                  <QrCode value={cobrancaVisivel.pixCopyPaste} size={200} label="Aponte a câmera do seu banco" />
                  <div className="credito__pix-dados">
                    <label className="credito__pix-rotulo" htmlFor="pix-copia-e-cola">
                      Pix copia e cola
                    </label>
                    <textarea
                      id="pix-copia-e-cola"
                      className="credito__pix-codigo"
                      readOnly
                      rows={4}
                      value={cobrancaVisivel.pixCopyPaste}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => copiar(cobrancaVisivel.pixCopyPaste!, toast)}
                    >
                      Copiar código
                    </Button>
                    {cobrancaVisivel.pixExpiresAt && (
                      <small className="text-muted">
                        Válida até {formatDateTime(cobrancaVisivel.pixExpiresAt)}.
                      </small>
                    )}
                    <small className="text-muted">
                      O crédito entra sozinho quando o banco confirmar o pagamento. Esta tela
                      atualiza a cada {INTERVALO_DE_ESPERA_MS / 1000} segundos — não precisa
                      fazer nada.
                    </small>
                  </div>
                </div>
              </Card>
            )}

            <Card padded={false}>
              <header className="credito__secao">
                <h3>Compras</h3>
              </header>
              <QueryState
                loading={compras.isLoading}
                error={compras.error}
                empty={(compras.data?.items ?? []).length === 0}
                emptyLabel="Nenhuma compra ainda."
                variant="list"
              >
                <table className="credito__lista">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Valor</th>
                      <th>Situação</th>
                      <th>Identificador no provedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(compras.data?.items ?? []).map((c) => (
                      <tr key={c.purchaseId}>
                        <td>{formatDateTime(c.createdAt)}</td>
                        <td>{formatCurrency(c.amount)}</td>
                        <td>
                          <span className={`badge ${classeDaSituacao(c.status)}`}>
                            {rotuloDaSituacao(c.status)}
                          </span>
                        </td>
                        <td className="credito__mono">{c.chargeExternalId ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </QueryState>
            </Card>

            <Card padded={false}>
              <header className="credito__secao">
                <h3>Extrato</h3>
              </header>
              <QueryState
                loading={extrato.isLoading}
                error={extrato.error}
                empty={(extrato.data?.items ?? []).length === 0}
                emptyLabel="Nenhuma movimentação ainda."
                variant="list"
              >
                <table className="credito__lista">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Motivo</th>
                      <th>Campanha</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(extrato.data?.items ?? []).map((l) => (
                      <tr key={l.id}>
                        <td>{formatDateTime(l.createdAt)}</td>
                        <td>{MOTIVO[l.reason] ?? l.reason}</td>
                        <td className="credito__mono">{l.campaignId ?? '—'}</td>
                        <td className={l.direction === 'credit' ? 'text-accent' : ''}>
                          {l.direction === 'credit' ? '+' : '-'}
                          {/*
                            Quatro decimais: um débito de veiculação pode ser R$ 0,045, e duas
                            decimais mostrariam R$ 0,05 num extrato que precisa fechar com o
                            saldo.
                          */}
                          {reaisDetalhado(l.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </QueryState>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

/** Texto digitado → centavos inteiros. Aceita vírgula e ponto. */
function emCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/** Quantas exibições de `segundos` o valor cobre. Mesma conta do servidor. */
function exibicoes(centavos: number, precoPorSegundoMicros: number, segundos: number): number {
  const custo = Math.floor(precoPorSegundoMicros) * Math.floor(segundos);
  if (custo <= 0) return 0;
  // 1 R$ = 1.000.000 µR$, e 1 centavo = 10.000 µR$.
  return Math.floor((centavos * 10_000) / custo);
}

function rotuloDaSituacao(s: string): string {
  if (s === 'validated') return 'Crédito lançado';
  if (s === 'refunded') return 'Estornada';
  if (s === 'pending') return 'Aguardando pagamento';
  return s;
}

function classeDaSituacao(s: string): string {
  if (s === 'validated') return 'badge-accent';
  if (s === 'refunded') return 'badge-danger';
  return 'badge-warning';
}

function copiar(valor: string, toast: { success: (m: string) => void; error: (m: string) => void }) {
  /**
   * `navigator.clipboard` não existe em contexto não seguro (http sem localhost) e pode ser
   * negado pelo navegador. Avisar é melhor do que não fazer nada: o `textarea` ao lado é
   * selecionável, então há um caminho manual.
   */
  if (!navigator.clipboard) {
    toast.error('Seu navegador não permitiu copiar. Selecione o código ao lado e copie à mão.');
    return;
  }
  navigator.clipboard.writeText(valor).then(
    () => toast.success('Código Pix copiado.'),
    () => toast.error('Não foi possível copiar. Selecione o código ao lado e copie à mão.')
  );
}

const texto = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);
