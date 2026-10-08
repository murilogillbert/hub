-- Estoque por unidade e horário de funcionamento.
--
-- Aditivo: uma tabela nova e quatro colunas novas. Nenhuma coluna existente é alterada ou
-- removida, e `products.stock` continua significando exatamente o que significava — ver a nota
-- longa abaixo, que é a parte importante desta migration.
--
-- ============================================================================
-- Por que `products.stock` NÃO é substituído
-- ============================================================================
--
-- A tentação era mover o estoque para a tabela nova e tornar `products.stock` derivado. Isso
-- criaria duas fontes de verdade para a mesma pergunta num caminho que mexe com dinheiro:
-- `orderService.createOrder` valida estoque antes de criar o pedido, e `partnerService.redeem`
-- decrementa no resgate. Qualquer divergência entre as duas fontes vira venda de item que não
-- existe, ou item que existe e não pode ser vendido.
--
-- E há o lado do contrato: três aplicativos aprovados nas lojas leem `stock` do produto. Mudar
-- o significado do campo quebraria os três sem aviso.
--
-- Então a divisão é por **pergunta**, não por camada:
--
--   products.stock       →  "quanto a rede inteira tem" — é o que autoriza a compra.
--                           Único lugar que o checkout e o resgate consultam. Inalterado.
--   product_store_stock  →  "onde dá para retirar" — disponibilidade declarada por unidade.
--                           Pergunta NOVA, que antes não tinha resposta nenhuma.
--
-- Com isso, "acabou na loja do centro" passa a ser representável sem que o total da rede fique
-- ambíguo, e nenhum caminho de pagamento muda de comportamento.

-- CreateTable
CREATE TABLE "product_store_stock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    -- Contagem da própria unidade. Pode ser menor que `products.stock` (a unidade tem uma
    -- parte do total) e também maior (o lojista cadastrou errado) — nada aqui força a soma a
    -- fechar, de propósito: forçar exigiria tomar o total como derivado, que é o que a nota
    -- acima rejeita.
    "quantity" INTEGER NOT NULL DEFAULT 0,
    -- Desligar sem zerar. Serve a "não vendo este item nesta loja" sem perder a contagem, que
    -- é informação diferente de "acabou" e o lojista reconhece a diferença.
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_store_stock_pkey" PRIMARY KEY ("id")
);

-- Uma linha por par produto/unidade. É também a trava contra duas linhas divergentes para o
-- mesmo par, que seria a forma silenciosa de o número ficar errado.
-- CreateIndex
CREATE UNIQUE INDEX "product_store_stock_product_store_key"
    ON "product_store_stock"("product_id", "store_id");

-- Leitura do painel do lojista: "o que tem nesta unidade".
-- CreateIndex
CREATE INDEX "product_store_stock_store_id_idx" ON "product_store_stock"("store_id");

-- `ON DELETE CASCADE` nos dois lados: a linha não tem significado sem o produto nem sem a
-- unidade. Diferente de `notifications` e `push_tokens`, aqui a FK existe porque a linha é
-- pura ligação — não há dado próprio a preservar depois que uma das pontas sai.
-- AddForeignKey
ALTER TABLE "product_store_stock"
    ADD CONSTRAINT "product_store_stock_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_store_stock"
    ADD CONSTRAINT "product_store_stock_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "partner_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Horário de funcionamento da unidade
-- ============================================================================
--
-- JSONB e não tabela de intervalos. O dado é lido sempre inteiro ("qual o horário desta
-- unidade?"), nunca consultado por pedaço ("quais unidades abrem às 14h?"), e uma tabela
-- `store_opening_hours` com sete a vinte e oito linhas por unidade trocaria uma leitura por um
-- join num caminho que já é o mais quente do hub. A validação de forma fica em
-- `domain/openingHours.ts`, com teste.
--
-- Forma: { "seg": [{ "de": "09:00", "ate": "18:00" }], ... }, chaves dom..sab.
-- `ate` menor ou igual a `de` significa que o intervalo cruza a meia-noite (18:00–02:00).
--
-- NULL = horário não declarado = conta como ABERTA. É a decisão conservadora: hoje nenhuma
-- unidade tem horário, e tratar ausência como fechada sumiria com o catálogo no deploy.
ALTER TABLE "partner_stores"
    ADD COLUMN IF NOT EXISTS "opening_hours" JSONB,

    -- Fuso explícito, não deduzido do estado.
    --
    -- O servidor roda em UTC: usar o relógio dele diria "fechada" às 17h de Campo Grande,
    -- porque lá já são 21h em UTC. E deduzir do estado não é confiável — o Brasil tem quatro
    -- fusos, MT e MS são UTC−4 enquanto SP é UTC−3. O padrão cobre a maioria e quem está em
    -- outro fuso corrige na tela.
    ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(60) NOT NULL DEFAULT 'America/Sao_Paulo',

    -- Fechar uma unidade temporariamente (reforma, férias) sem apagá-la — apagar levaria o
    -- histórico de estoque por unidade junto, pelo CASCADE acima.
    ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- Qual unidade resgatou
-- ============================================================================
--
-- `order_items` não sabia em qual unidade o voucher foi apresentado, então uma rede não tinha
-- como saber qual loja atendeu. Anulável porque os aplicativos publicados **não** enviam a
-- unidade no resgate, e vão continuar não enviando até a próxima submissão: exigir o campo
-- quebraria o balcão de resgate hoje em produção.
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "redeemed_store_id" UUID;

-- Sem FK, pelo mesmo motivo de `notifications`: é registro histórico. Uma FK aqui daria à
-- unidade o poder de bloquear a exclusão de si mesma por causa de um resgate antigo, ou
-- apagaria a informação de qual loja atendeu — as duas piores que guardar o identificador solto.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_items_redeemed_store_id_idx"
    ON "order_items"("redeemed_store_id");
