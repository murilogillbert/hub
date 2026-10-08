import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/components/Button/Button';
import { Modal } from '@shared/components/Modal/Modal';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { partnerApi, type ProductStoreStockItem } from '@shared/api/endpoints';
import './DisponibilidadePorUnidade.css';

/**
 * "Onde dá para retirar este produto."
 *
 * ============================================================================
 * Isto NÃO é o estoque que autoriza a compra
 * ============================================================================
 *
 * O estoque da rede continua no campo "Estoque" do próprio produto, e é ele que o checkout
 * valida e o resgate decrementa. Aqui é a disponibilidade **por unidade**, que antes não tinha
 * como ser representada: uma rede com três lojas não conseguia dizer que o produto acabou em
 * uma só.
 *
 * A tela diz isso em texto, e não só no código, porque "estoque" em dois lugares é exatamente
 * o tipo de coisa que o lojista interpreta errado — e aí ele zera a unidade achando que está
 * tirando o produto de venda, ou zera o total achando que está fechando uma loja.
 *
 * ============================================================================
 * Por que o aviso de "disponível em todas"
 * ============================================================================
 *
 * Produto que nunca teve disponibilidade preenchida está disponível em **todas** as unidades —
 * é o comportamento de antes, e o acervo inteiro está assim. Sem o aviso, o lojista abriria a
 * tela, veria zeros, e concluiria que o produto está esgotado em todo lugar.
 */

interface Props {
  productId: string;
  productTitle: string;
  /** Estoque da rede, mostrado para a distinção ficar concreta. */
  stockDaRede: number;
  onClose: () => void;
}

type Rascunho = Record<string, { quantity: number; active: boolean }>;

export function DisponibilidadePorUnidade({
  productId,
  productTitle,
  stockDaRede,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rascunho, setRascunho] = useState<Rascunho>({});

  const q = useQuery({
    queryKey: ['partner-product-stores', productId],
    queryFn: () => partnerApi.productStores(productId),
  });

  /**
   * O rascunho é semeado quando o dado chega, e **não** a cada renderização.
   *
   * Semear no corpo do componente sobrescreveria o que o lojista digitou a cada atualização do
   * cache — ele mexeria num campo e o valor voltaria sozinho.
   */
  useEffect(() => {
    if (!q.data) return;
    const inicial: Rascunho = {};
    for (const i of q.data.items) {
      inicial[i.storeId] = { quantity: i.quantity, active: i.active };
    }
    setRascunho(inicial);
  }, [q.data]);

  const salvar = useMutation({
    mutationFn: () =>
      partnerApi.setProductStores(
        productId,
        Object.entries(rascunho).map(([storeId, v]) => ({
          storeId,
          quantity: v.quantity,
          active: v.active,
        })),
      ),
    onSuccess: () => {
      toast.success('Disponibilidade salva.');
      void qc.invalidateQueries({ queryKey: ['partner-product-stores', productId] });
      // O catálogo público passa a filtrar por unidade: invalidar evita o lojista conferir no
      // app e ver o estado anterior.
      void qc.invalidateQueries({ queryKey: ['catalog'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar a disponibilidade.'),
  });

  const itens = q.data?.items ?? [];
  const declarado = q.data?.declared ?? false;

  const set = (storeId: string, campo: 'quantity' | 'active', valor: number | boolean) =>
    setRascunho((atual) => ({
      ...atual,
      [storeId]: {
        quantity: campo === 'quantity' ? (valor as number) : (atual[storeId]?.quantity ?? 0),
        active: campo === 'active' ? (valor as boolean) : (atual[storeId]?.active ?? true),
      },
    }));

  /** Distribui o estoque da rede igualmente entre as unidades ligadas. */
  const distribuir = () => {
    const ligadas = itens.filter((i) => rascunho[i.storeId]?.active ?? true);
    if (ligadas.length === 0) return;
    const porUnidade = Math.floor(stockDaRede / ligadas.length);
    /**
     * O resto vai para a primeira unidade, e não é descartado: com 10 no total e 3 lojas, o
     * lojista espera ver 10 distribuídos, não 9.
     */
    const resto = stockDaRede - porUnidade * ligadas.length;
    setRascunho((atual) => {
      const next = { ...atual };
      ligadas.forEach((i, idx) => {
        next[i.storeId] = {
          active: true,
          quantity: porUnidade + (idx === 0 ? resto : 0),
        };
      });
      return next;
    });
  };

  const total = itens.reduce((s, i) => s + (rascunho[i.storeId]?.quantity ?? 0), 0);

  return (
    <Modal open onClose={onClose} title={`Disponibilidade — ${productTitle}`}>
      <div className="disp">
        <p className="text-muted disp__nota">
          Isto é <strong>onde o cliente pode retirar</strong>. O estoque que autoriza a compra
          continua sendo o campo <strong>Estoque</strong> do produto, hoje em{' '}
          <strong>{stockDaRede}</strong>.
        </p>

        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={itens.length === 0}
          emptyLabel="Cadastre uma unidade em Unidades para poder definir a disponibilidade."
          variant="list"
        >
          {!declarado && (
            <p className="disp__aviso">
              Este produto <strong>ainda não tem disponibilidade definida</strong>, então aparece
              em todas as suas unidades. Ao salvar, passa a aparecer só nas que tiverem
              quantidade acima de zero e estiverem marcadas.
            </p>
          )}

          <table className="disp__tabela">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Local</th>
                <th>Quantidade</th>
                <th>Vende aqui</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i: ProductStoreStockItem) => (
                <tr key={i.storeId}>
                  <td>{i.storeName}</td>
                  <td className="text-muted">
                    {i.city}/{i.state}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="disp__qtd"
                      aria-label={`Quantidade em ${i.storeName}`}
                      value={rascunho[i.storeId]?.quantity ?? 0}
                      onChange={(e) =>
                        set(i.storeId, 'quantity', Math.max(0, Math.trunc(Number(e.target.value) || 0)))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Vende em ${i.storeName}`}
                      checked={rascunho[i.storeId]?.active ?? true}
                      onChange={(e) => set(i.storeId, 'active', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="disp__rodape">
            <small className="text-muted">
              Somado nas unidades: <strong>{total}</strong>
              {total !== stockDaRede && (
                <>
                  {' '}
                  · estoque da rede: <strong>{stockDaRede}</strong>. Os dois não precisam bater —
                  são contagens de perguntas diferentes.
                </>
              )}
            </small>
            <div className="row">
              {itens.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={distribuir}>
                  Distribuir o estoque da rede
                </Button>
              )}
              <Button
                type="button"
                onClick={() => salvar.mutate()}
                disabled={salvar.isPending || itens.length === 0}
              >
                {salvar.isPending ? 'Salvando…' : 'Salvar disponibilidade'}
              </Button>
            </div>
          </div>
        </QueryState>
      </div>
    </Modal>
  );
}
