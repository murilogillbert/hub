# Lista de melhorias de usabilidade — pré/pós-lançamento

Não bloqueiam o lançamento (diferente do que já foi corrigido nesta rodada:
verificação de e-mail, esqueci senha, chave Pix do afiliado, CPF real no Asaas,
tokenização de cartão). São oportunidades que apareceram durante a auditoria e a
implementação.

## Vale considerar antes do lançamento

- **Dedupe de cliente no Asaas**: hoje `ensureCustomer()` cria um cliente novo no
  Asaas a cada pedido, mesmo pro mesmo comprador — com o tempo acumula clientes
  duplicados lá. Fácil de resolver depois (buscar por `externalReference` antes
  de criar), não trava nada agora.
- **IP real do cliente no `trust proxy`**: o Cloudflare hoje fica na frente do
  Traefik, que fica na frente do backend — dois saltos de proxy, mas o Express
  só confia em 1 (`app.set('trust proxy', 1)`). Isso pode fazer o IP que mandamos
  pro Asaas na tokenização de cartão (usado pra análise de risco deles) não ser o
  IP real do cliente. Não impede pagamentos, só reduz a qualidade desse sinal
  anti-fraude.
- **Cadastro de afiliado (aprovação) não passa pelo fluxo de verificação de
  e-mail**: quando o admin aprova um afiliado, a conta é criada direto com a
  senha padrão `123456` — não recebe e-mail de verificação (só o de boas-vindas
  com a senha). Como quem aprovou já confirmou o e-mail manualmente (o admin viu
  a inscrição), o risco é baixo, mas vale considerar unificar com o fluxo de
  verificação se um dia isso for automatizado sem revisão humana.

## Resolvidas

- ~~CRUD de parceiro no admin~~ — investigando mais a fundo, `deletePartner`
  hoje só faz `active: false`, exatamente o que "Pausar" já faz — não é uma
  exclusão de verdade. Decidido não expor um botão duplicado; pausar/reativar
  já cobre o caso de uso. Se um dia fizer sentido uma exclusão que se comporte
  diferente de pausar, é um trabalho novo, não só "expor um botão".
- ~~Erro da calculadora "Lucro Real" é 100% silencioso~~ — agora mostra um
  toast discreto ("Seu resultado está pronto, mas não conseguimos salvar seus
  dados agora") quando o envio ao backend falha, sem travar o diagnóstico local
  que já aparece na tela.
- ~~Texto/comentário desatualizado sobre troca de gateway de pagamento~~ —
  comentário corrigido em `backend/src/infra/paymentGateways/index.ts`.

## Pode ficar para a primeira semana pós-lançamento

## Auditoria completa — 2026-09-24 (fase de ajustes finos/performance)

Auditoria de 5 frentes (dinheiro/pagamento, papéis/permissão, código morto,
frontend, performance) pedida depois da fase de passageiro/motorista +
afiliação loja↔motorista. Dois fatos verificados direto em produção antes de
listar (pra não soar alarme à toa): `JWT_SECRET` e `Survey:WebhookSecret`
**estão** configurados de verdade em produção (não caem no fallback do
repo) — os itens abaixo que mencionam esses fallbacks são sobre o que
aconteceria se algum dia ficarem sem valor, não o estado atual.

### Já corrigido nesta auditoria (commit e deploy pendentes de confirmação)

- ~~Dashboard do Admin (clientes, cashback a pagar, novos clientes em 30d)
  zerado~~ — `adminService.metrics()` ainda filtrava `role: 'Client'`. Passou
  a filtrar `role IN (Passenger, Driver)`.
- ~~`GET /orders/:id/payment-status` sem checar dono do pedido~~ — passou a
  filtrar por `customerId`.
- ~~Motorista podia indicar a própria compra~~ — confirmado: **não pode**.
  `resolveCheckoutCode` agora rejeita (mesmo erro "código não faz parte dos
  nossos afiliados") se o código digitado for do próprio comprador.
- ~~Empilhamento taxa+cashback+comissão podia passar de 100%~~ — nova
  `clampCommission()` em `commissionRules.ts`: a comissão creditada nunca
  excede o que sobra depois de taxa+cashback no subtotal do parceiro (nunca
  negativo). Aplicado nos 3 lugares que tocam nisso: crédito real
  (`paymentService.approve`), split real da Asaas (`buildSplits`) e o
  display no resgate (`partnerService.redeem`) — os 3 usam a mesma trava,
  então nunca divergem entre si.
- ~~Busca de motorista devolvia nome+e-mail pra qualquer loja~~ — confirmado:
  busca agora é só pelo **código único** do motorista (o mesmo que ele usa
  no checkout) — a loja só consegue adicionar quem já compartilhou o próprio
  código com ela. `email` nem sai mais da API de busca.
- ~~Loja desativada continuava funcionando 100%~~ — `partner.active` agora é
  checado em 3 pontos: `orderService.createOrder` (não dá pra comprar
  produto de loja pausada), `driverAffiliateService.add` (loja pausada não
  adiciona novo afiliado), e o catálogo público (`catalogService.getProducts`/
  `searchCatalog`) parou de listar produtos de lojas pausadas (antes só
  filtrava `product.active`, não `partner.active` — pausar uma loja não
  escondia o catálogo dela).
- ~~Motorista rebaixado continuava ganhando comissão~~ —
  `commissionMapForOrder` agora recheca `role: 'Driver'` no momento do
  crédito, não só na hora que o vínculo foi criado.
- ~~Cashback podia ser gasto duas vezes~~ — reservado de forma atômica
  (decremento condicional ao saldo) na CRIAÇÃO do pedido, não mais só lido;
  `approve()` não desconta de novo, só registra o lançamento no extrato. Se o
  pedido for cancelado ou o Pix expirar, o valor reservado volta pro saldo
  (ver `paymentService.cancelOrder`, novo).
- ~~Pix pendente nunca expirava~~ — `reconcilePending()` agora cancela (e
  libera o cashback reservado) todo Pix `PendingPayment` com mais de 35min,
  antes de gastar uma chamada de gateway por pedido — e passou a rodar com
  `take: 200` em vez de escanear a tabela toda sem limite.
- ~~Sino de notificação nunca esvaziava~~ — novo `POST
  /me/notifications/read`, chamado quando o sino é aberto.
- ~~`sitemap.xml` desatualizado~~ — trocado `/cadastro/cliente` por
  `/cadastro/passageiro` + `/cadastro/motorista`.
- ~~Partner ↔ loja sem link cruzado~~ — `ClientLayout` ganhou "Painel da
  loja" (só pra `role === 'partner'`), `PartnerLayout` ganhou "Comprar no
  hub".
- ~~Admins com erro de mutação silencioso~~ — `onError` adicionado nas
  mutations que não tinham em `AdminApiKeysPage`, `AdminIntegrationsPage`,
  `AdminPartnersPage`, `AdminCategoriesPage`, `AdminCampaignMaterialsPage`.
- ~~Número de WhatsApp da calculadora "Lucro Real"~~ — trocado pro número
  real (`556182187476`, o mesmo já usado no assistente).
- ~~Comissão com vírgula virava 0%~~ / ~~campo bruto sem borda~~ / ~~maxWidth
  no lugar errado~~ / ~~estado de edição preso depois de salvar~~ — os 3
  inputs de comissão de `PartnerDriverAffiliatesPage` agora usam `<Input
  type="number">` (mesmo padrão já usado pra `cashbackPercent` em
  `PartnerCatalogPage`, sem parsing de string) dentro de um wrapper com o
  `maxWidth` certo, e o estado local de edição é limpo no `onSuccess`.
- ~~Índices faltando~~ — migração nova (`orders.status+payment_method+
  created_at`, `orders.external_payment_id`, `orders.payment_reference`,
  `cashback_entries.order_id`, `notifications.user_id+created_at`) +
  `@@unique([orderId, partnerId])` em `driver_commission_entries` (reforça
  no banco a idempotência que já existia em código).
- ~~`driverAffiliateService.storeMetrics()` fazia 2 buscas + soma em JS sem
  limite~~ — reescrito pra 3 `aggregate` em paralelo, sem carregar linha
  nenhuma pra JS.
- ~~`orderService.createOrder` tinha N+1 (1 SELECT por item do carrinho)~~ —
  agora busca todos os produtos do carrinho numa `findMany` só.
- ~~Bundle principal com tudo dentro (667KB)~~ — `jsPDF` virou `import()`
  dinâmico (só carrega quem clica "baixar PDF"); `QrScanner`
  (html5-qrcode, ~330KB) virou `React.lazy`, só carrega quem abre
  `PartnerRedeemPage`. Bundle principal caiu pra 275KB, confirmado no build.
- ~~`.env.example` desatualizado~~ — `FRONTEND_URL`, `EVOLUTION_API_URL`,
  `EVOLUTION_API_KEY`, `STORAGE_MAX_IMAGE_BYTES` documentados; comentário do
  `?consultor=` corrigido pra `?affiliateCode=`.
- ~~Comentários citando Supabase/Vercel/".NET API"~~ — atualizados pra
  refletir a infra atual (Coolify, Node/Express).

### Ainda precisam da sua decisão

- **`PAYMENT_PROVIDER=mock` em produção** — confirmado que foi esquecimento,
  não intencional. Aguardando os dados da conta Asaas real pra trocar (você
  pediu instrução à parte pra isso — ver mensagem seguinte).
- **Parceiro pode comprar e resgatar o próprio produto** — confirmado:
  aceitável, mantido como está (vocês acompanham todas as transações e têm
  os dados pra auditoria se precisar).
- **Parceiros/estatísticas fake na home** (`HomePage.tsx`, `PARTNERS_DEMO`) —
  confirmado que são fake; mantidos por ora até decisão com o stakeholder.

### Ainda sem correção — maiores, ficam pra depois

- **Comissão lida "ao vivo" em vez de travada no pedido**
  (`commissionMapForOrder`) — o % usado no crédito é o valor ATUAL de
  `driver_affiliates`, não o que valia no checkout. Risco financeiro real já
  eliminado pelo `clampCommission` (nunca gera mais crédito do que o
  parceiro tem de margem); o que sobra é só uma divergência de UX (loja muda
  a comissão entre o checkout e a aprovação do Pix) — baixa prioridade.
- **Reembolso/chargeback não desfaz nada** — nenhum caminho de estorno
  reverte `CashbackEntry`/`DriverCommissionEntry` nem muda o status do
  pedido. Pré-existente pro cashback; a comissão herdou a mesma lacuna. Só
  vira urgente quando o gateway real (Asaas) estiver ativo — mock não gera
  esse tipo de evento.
- **Métricas do admin/parceiro fazem a conta em memória** —
  `adminService.metrics()`/`payoutSummary()` e `partnerService.metrics()`
  carregam pedidos/itens inteiros pra somar em JS (O(pedidos × itens) em
  alguns pontos). Não é um bug — só fica lento em volume alto. Reescrever
  pra `aggregate`/`groupBy` é um projeto à parte (mexe em ~8 métricas
  derivadas de uma vez), não entrou nesta rodada pra não arriscar quebrar
  dashboard que já funciona sob pressão de tempo.
- **Resto do frontend sem `React.lazy`** — só `QrScanner` foi isolado nesta
  rodada (maior ganho isolado). Dividir o restante das 45+ rotas (admin,
  financeiro etc.) em chunks é mais trabalho mecânico, menor ganho marginal.
- **Configurações de WhatsApp Business não fazem nada** — a tela Admin →
  Integrações descreve confirmação de compra/voucher por WhatsApp, mas
  `WhatsApp:Token`/`WhatsApp:PhoneNumber` nunca são lidos; preferências de
  notificação do usuário são salvas mas nunca checadas antes de mandar algo.
- **Webhook da pesquisa aceita tudo se a config sumir** — hoje protegido de
  verdade (confirmado), mas se `Survey:WebhookSecret` e
  `Survey:ExpectedWebhookId` ficarem vazios ao mesmo tempo, o código abre em
  vez de fechar — trocar pra "falha fechada".
- **`resolveApplicationSchema`** (comissão na aprovação de afiliado solar)
  nunca é lido pela rota — todo afiliado aprovado recebe o fee padrão.
- **Export não usado**: `generateOrderCode`/`formatDate` em
  `formatters.ts`, `CardHeader`/`CardTitle` em `Card.tsx`,
  `timingSafeEqualHex` — limpeza de baixo risco, baixo valor, não priorizada.

## Ideias maiores (avaliar depois, com mais tempo)

- **Tokenização de cartão do lado do cliente**: hoje o número do cartão passa
  pelo nosso próprio backend antes de virar token no Asaas — funciona, mas o
  ideal a médio prazo é um SDK client-side (se a Asaas oferecer um no futuro)
  pra o cartão nunca tocar nosso servidor.
- **Verificação de e-mail obrigatória pra login**: hoje é só um aviso — dá pra
  evoluir pra bloqueio total depois que a entrega de e-mail estiver comprovada
  como confiável em produção por um tempo.
