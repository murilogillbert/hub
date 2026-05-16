# Plano de Implantação — OpenDriverHub (sistema dinâmico e funcional)

> Objetivo: transformar o front mockado atual (`C:/hub`) em uma aplicação
> **full-stack funcional**, rodando localmente com **SQL Server em Docker**,
> backend **.NET 10 + EF Core**, autenticação **JWT com roles**, pagamento
> (**gateway mock + Mercado Pago sandbox plugável**), bot integrado e CRUD
> completo — pronta para testes e publicação futura.

---

## 1. Arquitetura alvo

```
┌──────────────┐     HTTPS/JSON      ┌─────────────────────┐     EF Core      ┌──────────────┐
│  Frontend     │  ───────────────▶  │  Backend .NET 10     │  ─────────────▶ │  SQL Server   │
│  React + TS   │  ◀───────────────  │  ASP.NET Core Web API│  ◀───────────── │  (Docker)     │
│  (Vite :5173) │   JWT Bearer        │  (:5080 / :7080)     │   migrations     │  (:1433)      │
└──────────────┘                     └─────────────────────┘                 └──────────────┘
        │                                      │
        │ widget local (bot)                   ├── BackgroundService (reconciliação pagamento)
        └── handoff WhatsApp (wa.me)            └── Webhook Mercado Pago (sandbox)
```

- **Monorepo** com 3 raízes: `backend/` (.NET solution), `frontend/` (o atual
  `src/` do hub), `infra/` (docker-compose, scripts SQL, seed).
- Comunicação **REST/JSON**, contrato versionado em `/api/v1`.
- **Camada de API no front** substitui 100% dos mocks (`shared/mocks/*` e
  `shared/services/*`).

---

## 2. Pré-requisitos (máquina local)

| Ferramenta | Versão | Uso |
|---|---|---|
| Docker Desktop | atual | SQL Server + (opcional) API/Web em container |
| .NET SDK | **10.0** | backend |
| Node.js | 20+ | frontend |
| EF Core CLI | `dotnet tool install --global dotnet-ef` | migrations |
| (opcional) Azure Data Studio | — | inspecionar o banco |

---

## 3. Estrutura de pastas proposta

```
opendriverhub/
├── docker-compose.yml                # SQL Server (+ api/web opcionais)
├── .env                              # segredos locais (não versionar)
├── infra/
│   ├── sql/seed/                     # scripts de carga inicial idempotentes
│   └── scripts/ (reset-db, wait-for-sqlserver)
├── backend/
│   ├── OpenDriverHub.sln
│   ├── src/
│   │   ├── OpenDriverHub.Api/         # Controllers, middlewares, Program.cs, DI
│   │   ├── OpenDriverHub.Application/ # Services, DTOs, validators, interfaces
│   │   ├── OpenDriverHub.Domain/      # Entities, enums, regras de domínio
│   │   └── OpenDriverHub.Infrastructure/ # EF DbContext, repos, gateways, auth
│   └── tests/
│       ├── OpenDriverHub.UnitTests/
│       └── OpenDriverHub.IntegrationTests/  # WebApplicationFactory + Testcontainers
└── frontend/                         # = conteúdo atual de C:/hub/src reorganizado
    └── src/
        ├── shared/api/               # client HTTP, hooks react-query (NOVO)
        ├── shared/auth/              # AuthContext real (token + refresh) (NOVO)
        └── features/... (telas existentes, agora consumindo a API)
```

**Justificativa (Clean Architecture):** dependências apontam para dentro
(`Api → Application → Domain`; `Infrastructure` implementa interfaces da
`Application`). Facilita testes, troca de gateway de pagamento e evolução.

---

## 4. Modelagem de dados (entidades)

Derivada dos mocks atuais (`shared/types/index.ts`, `shared/mocks/*`) e do
schema de referência em `C:/Opendriver/sql/migrations`.

| Entidade | Campos-chave | Origem no mock |
|---|---|---|
| **User** | Id, Name, Email, PasswordHash, Role(`Client/Partner/Admin`), CashbackBalance, PartnerId? | `users.ts` |
| **Partner** | Id, Name, Segment, LogoUrl, FeePercent, Active, JoinedAt | `partners.ts` |
| **PartnerStore** | Id, PartnerId, Name, Address, Lat, Lng, Category | `stores.ts` |
| **Product** | Id, PartnerId, Title, Description, Price, CashbackPercent, Kind, ImageUrl, Category, Rating, Stock | `products.ts` |
| **Order** | Id, Code, ProductId, PartnerId, CustomerId, PaidPrice, CashbackEarned, CashbackUsed, Status, CreatedAt, RedeemedAt? | `orders.ts` |
| **PaymentTransaction** | Id, OrderId, Provider, ExternalRef, ExternalPaymentId, Method, Amount, Status, StatusDetail, Payloads, SyncedAt | `mercadoPago.ts` |
| **PaymentEvent** | Id, Provider, EventType, PaymentId, OrderId?, Status, RawPayload, ProcessedAt | webhook |
| **AssistantLead** | Id, UserId?, Profile, Category, Goal, MainIntent, Score, Temperature, CreatedAt | `assistantApi.ts` |
| **BotInteraction** | Id, LeadId?, UserMessage, BotResponse, Step, CreatedAt | `assistantApi.ts` |
| **AuditLog** | Id, ActorId, Action, EntityType, EntityId, PayloadJson, CreatedAt | novo (governança) |
| **Notification** | Id, UserId, Title, Message, Channel, ReadAt?, CreatedAt | novo (confirmações) |

Relações: `Partner 1-N Product`, `Partner 1-N PartnerStore`, `Order N-1 Product/User/Partner`,
`Order 1-N PaymentTransaction/PaymentEvent`, `AssistantLead 1-N BotInteraction`.

Índices: `User.Email` (unique), `Order.Code` (unique), `PaymentTransaction.ExternalPaymentId`,
`Product.PartnerId`, `Order.CustomerId/PartnerId/Status`.

---

## 5. Backend .NET — camadas e responsabilidades

### 5.1 Domain (`OpenDriverHub.Domain`)
- Entidades POCO + enums (`OrderStatus`, `ProductKind`, `UserRole`,
  `PaymentStatus`, `LeadTemperature`).
- Regras puras: cálculo de cashback, repasse do parceiro
  `partnerNet = paidPrice − platformFee − cashback`, transição de status do
  pedido, geração de `voucherCode`/`paymentReference`.

### 5.2 Application (`OpenDriverHub.Application`)
- **Services** (1 por agregado): `AuthService`, `ProductService`,
  `PartnerService`, `OrderService`, `PaymentService`, `RedeemService`,
  `AssistantService`, `MetricsService`, `AdminService`.
- **DTOs** request/response (nunca expor entidade direto).
- **Validação**: FluentValidation por DTO (email, preço ≥ 0, CPF, etc.).
- **Interfaces de porta**: `IPaymentGateway`, `IUserRepository`,
  `IUnitOfWork`, `IClock`, `INotificationSender`.

### 5.3 Infrastructure (`OpenDriverHub.Infrastructure`)
- `AppDbContext : DbContext` (EF Core 10, code-first, migrations).
- Repositórios + `UnitOfWork` (transação por request).
- **Gateways de pagamento** (Strategy):
  - `MockPaymentGateway` — PIX gera QR/copia-e-cola; cartão aprova/recusa;
    confirmação assíncrona via `BackgroundService` (simula webhook).
  - `MercadoPagoGateway` — chama API sandbox quando
    `Payment:Provider=mercadopago` e credenciais presentes.
  - Seleção por configuração (`Payment:Provider` = `mock` | `mercadopago`).
- Auth: `JwtTokenService`, `PasswordHasher` (PBKDF2/BCrypt), `CurrentUser`.

### 5.4 Api (`OpenDriverHub.Api`)
- Controllers finos (só orquestram services).
- Middlewares: tratamento global de exceção → ProblemDetails; logging
  (Serilog); CORS para `http://localhost:5173`.
- `Program.cs`: DI, `AddDbContext`, `AddAuthentication(JwtBearer)`,
  `AddAuthorization` (policies `RequireClient`, `RequirePartner`,
  `RequireAdmin`, `PartnerOwnsResource`), Swagger.
- **Migrations + seed automáticos** no boot em ambiente `Development`.

---

## 6. Contrato de API (mapeado por tela do frontend)

Base: `/api/v1`. Todas as respostas em envelope `{ data, error?, meta? }`.

### Auth (LoginPage / RegisterPage)
| Método | Rota | Auth |
|---|---|---|
| POST | `/auth/register` | público |
| POST | `/auth/login` | público → `{ token, refreshToken, user }` |
| POST | `/auth/refresh` | refresh token |
| GET  | `/auth/me` | Bearer |

### Catálogo / Produto (HomePage, ProductPage)
- `GET /products?category=&q=&partnerId=` · `GET /products/{id}`
- `GET /stores?partnerId=` (mapa Leaflet) · `GET /partners/{id}`

### Compra / Pagamento (CheckoutPage, PurchaseConfirmationPage)
- `POST /orders` → cria pedido `pendente_pagamento`
- `POST /payments/process` `{ orderId, method, card? }` → PIX devolve
  `{ qrCode, copiaECola }`; cartão devolve status
- `GET /orders/{id}/payment-status` → polling (front já espera este shape)
- `POST /payments/webhook/mercadopago` → reconciliação (sandbox)

### Área do cliente (MyItemsPage, HistoryPage, ProfilePage)
- `GET /me/orders?status=` · `GET /me/orders/{id}`
- `GET /me/cashback` · `PUT /me/profile` · `PUT /me/notifications`

### Parceiro (Catalog, Redeem totem, Metrics)
- `GET /partner/products` · `POST/PUT/DELETE /partner/products/{id}` (CRUD)
- `POST /partner/redeem` `{ code }` → valida, calcula taxa/cashback, baixa
  estoque, marca `redeemed`, credita cashback ao cliente, cria Notification —
  **tudo em uma transação**
- `GET /partner/metrics` (receita, vendas/hora, repasse)

### Bot (FloatingAssistant)
- `POST /assistant/leads` ← `createLeadFromAssistant`
- `POST /assistant/interactions` ← `recordBotInteraction`
- `GET /admin/leads` (painel)

### Admin (Dashboard, Sales, Partners, Users, Integrations)
- `GET /admin/metrics` · `GET /admin/sales?filtros`
- `GET/POST/PUT/DELETE /admin/partners` · `GET/POST/PUT/DELETE /admin/users`
- `GET/PUT /admin/integrations` (WhatsApp/email/MP/bot)

> Cada item acima substitui exatamente um arquivo de `shared/mocks` ou
> `shared/services`.

---

## 7. Banco em Docker + migrations + seed

`docker-compose.yml` (essencial — SQL Server 2022):

```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: ${SQLSERVER_PASSWORD}
      MSSQL_PID: Express
    ports: ["1433:1433"]
    volumes: [opendriverhub-mssql:/var/opt/mssql]
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P \"$$MSSQL_SA_PASSWORD\" -No -Q 'SELECT 1' || exit 1"]
volumes: { opendriverhub-mssql: {} }
```

- **Migrations**: `dotnet ef migrations add Initial` + aplicação automática no
  boot (`db.Database.Migrate()`).
- **Seed idempotente** (`DataSeeder`): popula a partir dos mocks atuais —
  parceiros, lojas, produtos, usuários demo (1 Cliente, 1 Parceiro, 1 Admin
  com senhas conhecidas), pedidos exemplo. Garante paridade visual com o
  estado mockado de hoje.

---

## 8. Refator do Frontend (remover mocks)

1. **Camada de API** `shared/api/`:
   - `httpClient.ts` (fetch + baseURL via `VITE_API_BASE_URL` + injeta JWT +
     trata 401 → refresh/logout).
   - `endpoints/*.ts` tipados (mesmos types de `shared/types`).
2. **TanStack Query** (`@tanstack/react-query`): cache, loading, erro,
   invalidação após mutations (CRUD).
3. **AuthContext real**: troca o switch mockado por login/registro reais,
   token em memória + refresh em `httpOnly`/storage; `RoleSwitcher` vira
   ferramenta só de DEV (atrás de `import.meta.env.DEV`).
4. **Substituir import a import**:
   - `mocks/products` → `useProducts()` / `useProduct(id)`
   - `mocks/orders` → `useMyOrders()`, `usePartnerOrders()`
   - `services/mercadoPago` → `paymentsApi` (mesma assinatura, agora HTTP)
   - `services/assistantApi` → `assistantApi` (HTTP)
   - `mocks/metrics` → `useAdminMetrics()` / `usePartnerMetrics()`
5. **Estados de UI**: cada página ganha `loading` e `empty/error`
   (skeletons), já que dados deixam de ser síncronos.
6. **Build guard**: lint que proíbe novos imports de `shared/mocks/*` fora de
   testes.

---

## 9. Bot integrado ao fluxo

- Motor de conversa **permanece local** (rápido, sem custo) — só a
  **persistência** vira API: ao chegar em `ready`, `POST /assistant/leads`;
  cada turno, `POST /assistant/interactions`.
- Lead vinculado ao `userId` se autenticado.
- Admin vê leads/temperatura em `/admin` (nova aba "Leads do bot").
- Handoff WhatsApp continua via `wa.me` (config do número em
  `/admin/integrations`).

---

## 10. Pagamento (mock + Mercado Pago sandbox)

- **Local default = `mock`**: funciona sem credenciais. PIX confirma sozinho
  via `PaymentReconciliationService` (BackgroundService a cada 5s) — replica o
  comportamento atual do front.
- **`mercadopago` (sandbox)**: ativado por `Payment__Provider=mercadopago` +
  `MERCADO_PAGO_ACCESS_TOKEN` (teste). Webhook real reconcilia status.
- Aprovação de pagamento dispara: geração de voucher (produto digital),
  Notification ao cliente, atualização de status do pedido — transacional e
  idempotente (dedupe por `ExternalPaymentId`).

---

## 11. Resgate de voucher (transacional)

`POST /partner/redeem { code }` executa em **uma transação**:
1. valida código pertence a um produto **do parceiro logado** e está `paid`;
2. recalcula `platformFee` e `cashback`;
3. `Order.Status = redeemed`, `RedeemedAt = now`;
4. credita cashback no `User.CashbackBalance`;
5. decrementa `Product.Stock`;
6. grava `AuditLog` + `Notification`;
7. retorna o breakdown que o totem já exibe.
Concorrência: `rowversion`/`UPDLOCK` para impedir resgate duplo.

---

## 12. Configuração de ambiente

`.env` (Docker/compose) e `appsettings.Development.json` (API):

```
SQLSERVER_PASSWORD=Strong_Local_Pwd_123!
ConnectionStrings__Default=Server=localhost,1433;Database=OpenDriverHub;User Id=sa;Password=Strong_Local_Pwd_123!;TrustServerCertificate=True
Jwt__Secret=<base64 >=32 bytes>
Jwt__AccessTtl=02:00:00
Jwt__RefreshTtl=7.00:00:00
Payment__Provider=mock
MERCADO_PAGO_ACCESS_TOKEN=
Cors__Origins=http://localhost:5173
```

Front `.env`: `VITE_API_BASE_URL=http://localhost:5080/api/v1`

---

## 13. Runbook local (ordem de execução)

```bash
# 1. Banco
docker compose up -d sqlserver        # aguarda healthcheck

# 2. Backend (migrations + seed automáticos no boot em Development)
cd backend && dotnet restore
dotnet ef database update -p src/OpenDriverHub.Infrastructure -s src/OpenDriverHub.Api
dotnet run --project src/OpenDriverHub.Api          # http://localhost:5080

# 3. Frontend
cd ../frontend && npm install
npm run dev                                          # http://localhost:5173
```

Logins de demo (seed): `cliente@demo.com` / `parceiro@demo.com` /
`admin@demo.com` (senha `Demo@123`).

---

## 14. Testes e validação

| Camada | Ferramenta | Cobertura mínima |
|---|---|---|
| Domínio | xUnit | cashback, repasse, transições de status |
| Aplicação | xUnit + Moq | services (auth, redeem, payment) |
| Integração | WebApplicationFactory + Testcontainers (SQL) | fluxos CRUD + auth + redeem ponta a ponta |
| API contrato | arquivo `.http`/Bruno | todos os endpoints da seção 6 |
| Front | Vitest + Testing Library | hooks de API, telas com loading/erro |
| E2E (opcional) | Playwright | golden path: cadastro→compra→pagamento→resgate |

**Critérios de aceite (checklist):**
- [ ] Cadastro + login + JWT + área protegida por role
- [ ] CRUD de produtos (parceiro) e de parceiros/usuários (admin) persistindo no SQL
- [ ] Home/Produto/Histórico consumindo API (zero mock em runtime)
- [ ] Checkout PIX gera QR e confirma via reconciliação; cartão aprova/recusa
- [ ] Resgate no totem credita cashback e marca pedido (transacional)
- [ ] Bot grava lead/interação; admin visualiza
- [ ] Métricas (parceiro/admin) calculadas do banco
- [ ] `docker compose up` + 2 comandos sobem tudo do zero com seed

---

## 15. Fases de entrega (sugestão de cronograma)

| Fase | Entregável | Estimativa |
|---|---|---|
| **F0** Infra | docker-compose SQL + solução .NET + CI básico | 0.5 dia |
| **F1** Domínio+EF | entidades, DbContext, migration inicial, seed | 1.5 dia |
| **F2** Auth | register/login/refresh/me + roles + policies | 1 dia |
| **F3** Catálogo | products/partners/stores + front Home/Produto | 1.5 dia |
| **F4** Compra+Pagamento | orders + gateway mock + reconciliação + checkout/confirmação | 2 dias |
| **F5** Resgate | totem `/partner/redeem` transacional | 1 dia |
| **F6** Áreas internas | CRUD parceiro/admin + métricas | 2 dias |
| **F7** Bot | leads/interações + aba admin | 0.5 dia |
| **F8** Hardening | testes, validações, logs, erros, MP sandbox | 1.5 dia |
| **Total** | aplicação funcional local | **~11.5 dias** |

---

## 16. Preparação para publicação futura (não bloqueante)

- Containerizar API (`Dockerfile` multi-stage) e Web (build estático + Nginx);
  `docker-compose.prod.yml` com os 3 serviços + migrations no entrypoint.
- Segredos via variáveis de ambiente / cofre (não `.env` versionado).
- Migrar `Payment__Provider=mercadopago` com credenciais de produção.
- HTTPS (reverse proxy), `Permissions-Policy: camera=*` (totem/scanner),
  rate limiting no `/auth`, backup do volume SQL.
- Observabilidade: Serilog → arquivo/Seq; healthchecks `/health`.

---

## 17. Riscos & decisões

| Risco | Mitigação |
|---|---|
| .NET 10 indisponível no ambiente | fallback para .NET 8 LTS (mesmo código/EF) |
| Diferença de comportamento ao trocar mock→API (assíncrono) | manter assinaturas dos serviços; adicionar loading/erro em todas as telas |
| Resgate duplo de voucher | transação + `rowversion`/lock |
| Credenciais MP ausentes localmente | provider `mock` é o default — não bloqueia |
| Drift entre seed e telas atuais | seed gerado a partir dos próprios mocks |
```
