# OpenDriverHub — aplicação full-stack

Hub onde parceiros vendem produtos físicos, digitais e vouchers para uma base de
clientes cadastrados. A plataforma ganha uma taxa por venda; o cliente ganha
cashback que é abatido nas próximas compras.

> **Sistema dinâmico e funcional**: React + TS no front, **.NET 10 + EF Core**
> no back, **SQL Server em Docker**. Dados reais, sem mocks em runtime.

## Como rodar (full-stack local)

Pré-requisitos: Docker, .NET SDK 10, Node 20+.

```bash
# 1. Banco (SQL Server em Docker, porta 1435 p/ não conflitar)
cp .env.example .env
docker compose up -d            # aguarde ~30s (healthcheck)

# 2. Backend .NET (migrations + seed automáticos no boot)
cd backend
dotnet run --project src/OpenDriverHub.Api    # http://localhost:5000

# 3. Frontend (em outro terminal)
npm install
npm run dev                     # http://localhost:5173
```

Contas demo (seed): `cliente@demo.com` · `parceiro@demo.com` ·
`admin@demo.com` — senha **`Demo@123`**.

> O botão flutuante `⚙` (canto inferior direito) faz **quick-login** real nas 3
> contas demo para navegar entre as áreas. A tela `/login` também funciona com
> qualquer conta cadastrada (cadastro real cria usuário no SQL).

## Stack

**Frontend**
- React 18 + TypeScript (Vite), react-router-dom v6
- **TanStack Query** (cache, loading, erro, invalidação após mutations)
- Camada de API tipada (`src/shared/api`) com JWT + refresh automático
- CSS puro modular · react-leaflet/OSM · qrcode.react · html5-qrcode

**Backend** (`backend/`, Clean Architecture)
- **.NET 10 + ASP.NET Core Web API**, EF Core 10 (code-first + migrations)
- **SQL Server 2022** (Docker), seed idempotente
- **JWT + roles** (Client/Partner/Admin) + policies de autorização
- Pagamento: gateway **mock** (PIX confirma via `BackgroundService` de
  reconciliação ~8s) + **Mercado Pago sandbox** plugável (`Payment:Provider`)
- Resgate de voucher **transacional** (status + cashback + estoque + auditoria)

```
backend/src/
  OpenDriverHub.Domain          entidades, enums, regras de comissão
  OpenDriverHub.Application     DTOs, interfaces de serviço e portas
  OpenDriverHub.Infrastructure  EF DbContext, auth, gateways, services, seed
  OpenDriverHub.Api             controllers, Program.cs, middleware
```

Endpoints sob `/api/v1` — auth, products, stores, partners, orders,
payments, partner (CRUD + redeem + metrics), admin (metrics/sales/partners/
users/leads), assistant. Cada um substitui exatamente um mock antigo.

### Tecnologias portadas do projeto full-stack `C:/Opendriver`

| Tecnologia | Onde vive | Observação |
|---|---|---|
| **Chatbot / Assistente IA local** | `features/assistant/` | Motor rule-based portado de `localAssistantEngine.ts`/`assistantFlow.ts`, adaptado ao domínio marketplace+cashback. Qualifica lead (perfil → categoria → objetivo), faz scoring/temperatura (frio/morno/quente) e persiste a sessão no `localStorage`. |
| **Handoff WhatsApp** | `features/assistant/lib/whatsapp.ts` | Gera deep-link `wa.me` com o resumo do lead. |
| **Mercado Pago** | `shared/services/mercadoPago.ts` | Gateway **mockado** com o mesmo contrato do back-end real: `paymentConfig()`, `processPayment()` (Pix gera QR + copia-e-cola; cartão aprova/recusa) e `getOrderPaymentStatus()` para polling (Pix confirma sozinho em ~8s, simulando o webhook). |
| **Tracking de leads do bot** | `shared/services/assistantApi.ts` | Espelha `createLeadFromAssistant` / `recordBotInteraction`. Em memória. |

> O back-end (Fastify, JWT, SQL Server, migrations) **não** foi trazido por
> decisão de escopo (projeto é só telas). Mas todos os serviços acima têm
> assinatura idêntica à da API real — basta trocar o corpo por `fetch`.

## Estrutura de pastas

```
src/
├── main.tsx                  # bootstrap React + providers
├── App.tsx
├── routes/
│   └── AppRoutes.tsx         # mapa de rotas (3 áreas)
├── shared/                   # tudo que é transversal
│   ├── components/           # Button, Card, Input, StatCard, BarChart,
│   │                         # QrCode, QrScanner, StoreMap, Layouts, RoleSwitcher
│   ├── context/AuthContext.tsx
│   ├── hooks/useAuth.ts
│   ├── mocks/                # products, stores, orders, users, partners, metrics
│   ├── types/                # interfaces TS (Product, Order, User, etc.)
│   ├── utils/formatters.ts   # currency, date, percent, codes
│   └── styles/               # reset.css + theme.css (tokens de design)
└── features/
    ├── client/               # Área do cliente final
    │   ├── pages/            # Home, Login, Register, Product, Checkout,
    │   │                     # Confirmation, MyItems, History, Profile
    │   └── components/       # ProductCard
    ├── partner/              # Painel do parceiro
    │   └── pages/            # Catalog, Redeem (QR scanner), Metrics
    ├── admin/                # Painel administrativo (você)
    │   └── pages/            # Dashboard, Sales, Partners, Users, Integrations
    └── assistant/            # Chatbot (portado do Opendriver)
        ├── lib/              # assistantFlow, localAssistantEngine, whatsapp
        └── components/       # FloatingAssistant, MessageBubble, QuickReplies
```

### Por que essa organização?

- **`shared/` vs `features/`**: tudo que é UI reutilizável e não depende de uma
  feature específica fica em `shared/`. Cada área (cliente, parceiro, admin)
  vive numa pasta isolada em `features/`, com suas próprias páginas e
  componentes. Isso facilita a migração futura para code-splitting por área.
- **Aliases TS (`@shared/...`, `@features/...`)**: configurados em
  [tsconfig.json](tsconfig.json) e [vite.config.ts](vite.config.ts) — evita
  imports `../../../`.
- **Cada componente tem seu CSS ao lado** (mesma pasta), sem CSS-in-JS, sem
  framework de utilitários. Variáveis CSS centralizadas em
  [theme.css](src/shared/styles/theme.css).
- **Mocks isolados** em `shared/mocks/`. Quando o back-end existir, basta
  trocar essas funções por chamadas HTTP — nenhuma página acessa dados
  diretamente, só através desses módulos.

## Áreas e rotas

### 1. Cliente (`/`)
| Rota | Tela |
|------|------|
| `/` | Home com hero, mapa de parceiros e catálogo |
| `/login` | Login |
| `/cadastro` | Cadastro |
| `/produto/:id` | Detalhes do produto + mapa dos pontos de resgate |
| `/checkout/:id` | Aquisição com Pix ou cartão |
| `/compra/confirmacao` | Voucher + QR code + código alfanumérico |
| `/conta/itens` | Meus itens ativos (vouchers prontos para usar) |
| `/conta/historico` | Histórico completo de compras |
| `/conta/perfil` | Configurações de perfil e notificações |

### 2. Parceiro (`/parceiro/...`)
| Rota | Tela |
|------|------|
| `/parceiro/catalogo` | Catálogo com QR code ao lado de cada produto (para venda rápida no balcão) |
| `/parceiro/venda` | Leitor de QR pela câmera + digitação manual, com breakdown de taxa + cashback + valor líquido |
| `/parceiro/metricas` | KPIs, gráficos de receita e movimento por horário, tabela de pedidos |

### 3. Admin (`/admin/...`)
| Rota | Tela |
|------|------|
| `/admin` | Dashboard geral (GMV, receita líquida, top parceiros, últimas transações) |
| `/admin/vendas` | Análise de vendas com filtros por parceiro / status / busca |
| `/admin/parceiros` | Lista de parceiros, taxas e ativação |
| `/admin/usuarios` | Gestão de contas |
| `/admin/integracoes` | WhatsApp, e-mail, PSP Pix, Analytics |

## Fluxo de uso (golden path)

1. **Descoberta** — Visitante entra em `/`, vê o catálogo e o mapa com pontos
   físicos dos parceiros próximos (Leaflet + OpenStreetMap).
2. **Cadastro/Login** — Clica em "Criar conta grátis". Após o cadastro entra
   automaticamente.
3. **Detalhe do produto** — Clica em um produto no catálogo, vê descrição,
   parceiro, cashback estimado e o mapa de onde pode resgatar (se o parceiro
   tiver lojas físicas).
4. **Checkout (Mercado Pago)** — Escolhe Pix ou cartão.
   - **Pix**: gera QR + código copia-e-cola; a tela faz *polling* e confirma
     sozinha quando o "banco" responde (~8s, simulando o webhook real).
   - **Cartão**: processa no gateway; aprova na hora (use o cartão
     `5031 4332 1540 6351` para simular **recusa**).
5. **Confirmação** — Vê a tela com o **código alfanumérico** e o **QR code** do
   voucher. Ambos são salvos automaticamente em "Meus itens".
6. **Chatbot (a qualquer momento)** — Botão flutuante "Assistente" nas telas do
   cliente. Em 3 perguntas qualifica o lead e oferece **continuar no
   WhatsApp** com o resumo já montado.
6. **Resgate (parceiro)** — O cliente vai até o parceiro. O parceiro abre
   `/parceiro/venda`, **escaneia o QR** ou digita o código. O sistema mostra:
   - valor pago pelo cliente
   - taxa retida pela plataforma
   - cashback que vai para o cliente
   - **valor líquido que o parceiro recebe** (a diferença, conforme regra do
     enunciado: ele recebe o líquido após desconto da taxa e do cashback, que é
     creditado ao cliente para usar na próxima compra)
7. **Métricas (parceiro)** — O parceiro acompanha em `/parceiro/metricas`
   receita acumulada, vendas, movimento por horário e valor a receber.
8. **Operação (admin)** — Você acompanha tudo em `/admin`: GMV, receita
   líquida, top parceiros, configura integrações (WhatsApp/e-mail), gerencia
   parceiros e usuários.

## Modelo de receita (como está modelado nos mocks)

- Cliente paga `P` pelo voucher.
- Plataforma retém `taxa%` (default 10% no mock — ver `PLATFORM_FEE_PERCENT`
  em `PartnerRedeemPage.tsx`).
- Cashback do produto é `cashback%` de `P` e fica creditado no cliente.
- Parceiro recebe `P - taxa - cashback`.
- Saldo de cashback do cliente é abatido em compras futuras (saldo aparece no
  header e no perfil — a lógica de abatimento real ficará no back-end).

## Próximos passos (back-end)

Quando for plugar o .NET, a única camada que muda é `shared/mocks/*` — cada
arquivo vira um client HTTP / serviço. Os componentes consomem via os types em
`shared/types/`, então o contrato fica claro:

- `GET /products`, `GET /products/:id`
- `POST /orders` (gera código + QR no servidor)
- `POST /orders/:code/redeem` (parceiro: aplica taxa, libera cashback)
- `GET /partners/me/metrics`
- `GET /admin/metrics`
- `POST /integrations/{whatsapp|email}`

## Observações

- O leitor de QR pede permissão de câmera; em HTTPS / localhost funciona sem
  configuração extra. Em produção, configure `Permissions-Policy: camera=*`.
- O mapa usa tiles do OpenStreetMap (sem chave de API). Em produção pesado,
  considere um provider próprio.
