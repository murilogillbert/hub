# OpenDriverHub — aplicação full-stack

Hub onde parceiros vendem produtos físicos, digitais e vouchers para uma base de
clientes cadastrados. A plataforma ganha uma taxa por venda; o cliente ganha
cashback que é abatido nas próximas compras.

> **Sistema dinâmico e funcional**: React + TS no front, **Node + Express +
> Prisma** no back, **Postgres no Supabase**. Dados reais, sem mocks em runtime.

## Como rodar (full-stack local)

Pré-requisitos: Node 20+ e um projeto no [supabase.com](https://supabase.com) (gratuito).

```bash
# 1. Configure o .env (raiz do repo)
cp .env.example .env
# Cole no .env: DATABASE_URL/DIRECT_URL (Project Settings -> Database) e
# SUPABASE_URL/SUPABASE_SECRET_KEY (Project Settings -> API). Crie
# também um bucket público no Storage (ex.: "uploads") — veja o .env.example
# para o passo a passo completo.

# 2. Backend (aplica as migrations + seed automáticos no boot)
cd backend
npm install
npm run prisma:migrate          # cria as tabelas no Supabase
npm run dev                     # http://localhost:5000

# 3. Frontend (em outro terminal, na raiz do repo)
npm install
npm run dev                     # http://localhost:5173
```

Contas demo (seed): `cliente@demo.com` · `parceiro@demo.com` ·
`admin@demo.com` — senha **`Demo@123`**.

## Deploy (Vercel + Supabase)

O front e o backend viram **dois projetos separados na Vercel**, apontando pro
mesmo repositório GitHub — não dá pra ter dois "Root Directory" num projeto só.

**1. Banco/Storage (Supabase)** — já feito se você seguiu o passo a passo do
`.env.example`. Duas pegadinhas:
- A senha do Postgres precisa estar **url-encoded** na connection string se
  tiver caracteres como `@`, `#`, `!`, `/`, `?` (ex.: `@` vira `%40`, `#` vira
  `%23`) — senão a URL fica ambígua.
- `DATABASE_URL` deve ser a connection string do **Transaction pooler**
  (porta 6543, `?pgbouncer=true`) — a direta (porta 5432) só serve pra
  `DIRECT_URL`, usada nas migrations. Copie as duas em Project Settings →
  Database → Connection string.

**2. Projeto da Vercel para o front** — Root Directory = `/` (raiz do repo),
Framework Preset = **Vite** (não "VitePress" — é outra ferramenta, de sites de
documentação). Env var: `VITE_API_BASE_URL` apontando pro domínio do projeto
do backend (passo 3), ex. `https://hub-api.vercel.app/api/v1`.

**3. Projeto da Vercel para o backend** — novo projeto apontando pro mesmo
repo, Root Directory = `backend/`, Framework Preset = **Other** (a Vercel
detecta `backend/api/index.ts` como function automaticamente — ver
`backend/vercel.json`, que já configura o rewrite de todas as rotas pra essa
function e o Cron Job de reconciliação de PIX). Env vars: todas as do
`.env.example` (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_*`, `JWT_SECRET`,
`CORS_ORIGINS` apontando pro domínio do front, `CRON_SECRET` com qualquer
valor aleatório, etc.). Depois do primeiro deploy, rode as migrations contra
o Supabase de produção a partir da sua máquina:
```bash
cd backend
npm run prisma:deploy   # aplica as migrations (não cria uma nova)
```

> ⚠️ Hospedagem serverless (Vercel) não mantém processo contínuo — o job de
> reconciliação de PIX (que localmente roda num `setInterval`) vira um
> **Cron Job** batendo em `/api/v1/internal/reconcile-payments` a cada 5
> minutos. Se o seu plano da Vercel só permitir execuções diárias de cron,
> ajuste `backend/vercel.json` — o checkout de PIX também sincroniza sozinho
> quando o cliente consulta o status do pagamento, então um cron mais
> espaçado só atrasa a confirmação de pedidos abandonados, não quebra o
> fluxo normal.

> O botão flutuante `⚙` (canto inferior direito) faz **quick-login** real nas 3
> contas demo para navegar entre as áreas. A tela `/login` também funciona com
> qualquer conta cadastrada (cadastro real cria usuário no banco).

## Stack

**Frontend**
- React 18 + TypeScript (Vite), react-router-dom v6
- **TanStack Query** (cache, loading, erro, invalidação após mutations)
- Camada de API tipada (`src/shared/api`) com JWT + refresh automático
- CSS puro modular · react-leaflet/OSM · qrcode.react · html5-qrcode

**Backend** (`backend/`)
- **Node + Express 5 + TypeScript**, **Prisma** como ORM (code-first + migrations)
- **Postgres no Supabase**, seed idempotente
- **JWT + roles** (Client/Partner/Admin) + middlewares de autorização
- Upload de imagens direto no **Supabase Storage**
- Pagamento: gateway **mock** (PIX confirma via job de reconciliação ~5s) +
  **Mercado Pago** e **Asaas** (sandbox/produção) plugáveis (`PAYMENT_PROVIDER`)
- Resgate de voucher **transacional** (status + cashback + estoque + auditoria)

```
backend/
  prisma/schema.prisma   modelos, enums, relações e índices
  src/domain/            regras puras (comissão/cashback, distância geográfica)
  src/dtos/              validação de request (zod) + tipos de resposta
  src/infra/             prisma client, auth (JWT/bcrypt), gateways de
                         pagamento, Supabase Storage, settings provider
  src/services/          regras de negócio por área (auth/catalog/orders/
                         partner/payments/reviews/admin/assistant/...)
  src/routes/            um Router do Express por área do contrato HTTP
  src/jobs/               reconciliação periódica de pagamentos PIX
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

## Modelo de receita

- Cliente paga `P` pelo voucher.
- Plataforma retém `taxa%` (definida por parceiro, `Partner.feePercent`).
- Cashback do produto é `cashback%` de `P` e fica creditado no cliente.
- Parceiro recebe `P - taxa - cashback`.
- Saldo de cashback do cliente é abatido em compras futuras (regras puras em
  [backend/src/domain/commissionRules.ts](backend/src/domain/commissionRules.ts),
  aplicadas de verdade no resgate e no pagamento — nada disso é mock).

## Observações

- O leitor de QR pede permissão de câmera; em HTTPS / localhost funciona sem
  configuração extra. Em produção, configure `Permissions-Policy: camera=*`.
- O mapa usa tiles do OpenStreetMap (sem chave de API). Em produção pesado,
  considere um provider próprio.
