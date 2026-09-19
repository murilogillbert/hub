# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OpenDriverHub: a marketplace + cashback platform for app drivers. Partners
sell physical/digital products and vouchers to a customer base; the platform
takes a fee per sale, the customer earns cashback redeemable on future
purchases. Real backend, real Postgres — no mocks in runtime code.

Two independent npm projects in one repo, each with its own `package.json`
and `node_modules`:
- **Root** = frontend (Vite + React + TS).
- **`backend/`** = API (Node + Express + TS + Prisma/Postgres).

There is no shared types package between them — request/response shapes are
hand-duplicated on each side (backend DTOs in `backend/src/dtos/*.dto.ts`,
frontend equivalents in `src/shared/api/endpoints.ts` + `src/shared/types/`).
When you change an API contract, update both sides.

## Commands

### Frontend (repo root)
```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build (typecheck + bundle)
npm run preview
```

### Backend (`backend/`)
```bash
npm install                    # postinstall runs `prisma generate`
npm run dev                    # tsx watch, http://localhost:5000
npm run build && npm start     # tsc -p tsconfig.json, then node dist/server.js
npm run prisma:generate        # regenerate Prisma Client after editing schema.prisma
npm run prisma:migrate         # create + apply a migration from schema.prisma against your local DB
npm run prisma:deploy          # apply existing migrations only (production)
npm run prisma:studio
npm run seed                   # tsx src/seed.ts — demo data
npm test                       # vitest run
```
Single test file: `npx vitest run tests/commissionRules.test.ts`
Single test by name: `npx vitest run -t "partnerNet subtracts platform fee and cashback"`

`tests/commissionRules.test.ts` and `tests/geoUtils.test.ts` are pure-function
tests, no DB needed. The rest (`authVerification`, `paymentService`,
`redeemService`, `affiliateWallet`) spin an ephemeral Postgres via
`tests/testDb.ts` (Testcontainers) and **require Docker running** — they fail
with an unrelated-looking error if Docker isn't available, not a code bug.

### Environment
Single `.env` at the repo root, read by both apps (`.env.example` documents
every variable). The frontend only reads `VITE_*` vars, embedded at build
time — set `VITE_API_BASE_URL` *before* `npm run build` for prod, changing it
after the build has no effect. The backend reads the rest via `dotenv`,
resolved relative to the repo root regardless of cwd (`backend/src/config.ts`).

## Architecture

### Backend request flow (`backend/src/`)
`routes/*.routes.ts` (one Express Router per area; wires
`requireAuth`/`requireRole(...ROLES.x)` + `validateBody(zodSchema)`) →
`services/*.ts` (business logic, talks to `infra/prisma.ts`) → `mappings.ts`
(one `toXDto(row)` per entity, Prisma row → response DTO) → back out through
`dtos/common.dto.ts`'s `envelope()`, the `{ data }` wrapper the frontend
client unwraps.

- `dtos/*.dto.ts` — zod request schemas + response TS interfaces, one file
  per area (auth, catalog, admin, affiliate, orders, partner, ...).
- `domain/` — pure functions only, no Prisma/IO (`commissionRules.ts`:
  cashback/fee/net math; `geoUtils.ts`: distance). This is what's unit-tested
  without Docker.
- `infra/` — `prisma.ts` (client singleton); `auth/` (JWT sign/verify,
  bcrypt, one-time email-verification/password-reset tokens); `email/`
  (facade over the sender); `paymentGateways/` (Strategy pattern —
  `mock.ts`/`mercadoPago.ts`/`asaas.ts` behind `IPaymentGateway`, selected
  once at boot in `index.ts` by `PAYMENT_PROVIDER`, swappable only via env +
  redeploy); `storage/` (MinIO/S3 uploads); `settingsProvider.ts` (DB-backed
  overrides for integration credentials, editable from Admin → Integrações
  *without* redeploy — distinct from `PAYMENT_PROVIDER` itself, which stays
  env-only).
- `middleware/auth.ts` — `ROLES` map (`client:[Client,Admin]`,
  `partner:[Partner,Admin]`, `admin:[Admin]`, `financeiro:[Financeiro,Admin]`;
  Admin always passes every check) + `requireAuth`/`requireRole(...)`/
  `requireVerifiedEmail`, plus `userId(req)`/`partnerId(req)` helpers used
  everywhere instead of touching `req.auth` directly.
- Errors: throw `AppError(message, statusCode)` (`errors.ts`) from services —
  `middleware/errorHandler.ts` (mounted last in `app.ts`) turns it (and any
  `ZodError`) into `{ error }` JSON. Don't try/catch for HTTP responses
  inside services.
- `jobs/paymentReconciliation.ts` — a `setInterval` started from
  `server.ts`, not an external cron (the backend is a persistent Node
  process, not serverless).
- Comments throughout the backend reference an "original .NET"
  implementation (`AuthorizationPolicy`, `ExceptionMiddleware`,
  `BackgroundService`, etc.) — this codebase is a deliberate port from an
  earlier .NET/EF Core backend (see `IMPLANTACAO.md`, now historical/stale)
  to Node/Express/Prisma. That explains the ASP.NET-flavored naming and
  transaction patterns you'll see.

### Prisma / database
`backend/prisma/schema.prisma` is the single source of truth. DB columns are
`snake_case` (`@map(...)`); Prisma Client stays `camelCase`. This is a **live
production database** — prefer additive migrations (new nullable/defaulted
columns, new enums, new tables) over renaming or dropping existing columns.
E.g. `Partner.documentType` was added alongside the existing `cnpj` column
instead of renaming it, mirroring the earlier `pixKey`/`pixKeyType` pattern.
After editing `schema.prisma`, hand-write the matching SQL in a new
`backend/prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` — check
existing folders under `backend/prisma/migrations/` for the exact style to
mirror, rather than running `prisma migrate dev` against a database you don't
want to touch directly.

### Frontend (`src/`)
- `routes/AppRoutes.tsx` — the single route map: one
  `<Route element={<RequireRole roles={[...]}/>}>` wrapper per area
  (client/partner/admin/financeiro) around a `*Layout` component.
  `RequireRole`/`RedirectIfAuthenticated` (`shared/components/RouteGuards.tsx`)
  gate on `useAuth()`.
- `shared/` = cross-cutting (components, `context/AuthContext.tsx`,
  `hooks/useAuth.ts`, `api/`, `types/`, `utils/`, `styles/theme.css` design
  tokens). `features/<area>/pages` + `features/<area>/components` = area-
  specific UI. Path aliases `@shared/*`, `@features/*` are declared in both
  `tsconfig.json` and `vite.config.ts` — keep them in sync if you add one.
- `shared/api/client.ts` — the one `fetch` wrapper (`api.get/post/put/del/
  postPublic`). Injects `Authorization: Bearer`, unwraps the backend's
  `{ data }` envelope, retries once through `/auth/refresh` on 401, then
  calls `setUnauthorizedHandler` (wired in `AuthContext`) to force logout.
  `shared/api/endpoints.ts` is the one file with every typed endpoint call +
  request/response shape — add new backend routes here, not ad-hoc `fetch`
  calls inside components.
- Every list/mutation goes through TanStack Query (`useQuery`/`useMutation` +
  `queryClient.invalidateQueries(...)` after writes) — no hand-rolled
  re-fetch plumbing.
- No CSS framework: each component/page has a co-located `.css` file,
  variables centralized in `shared/styles/theme.css`.
- README.md's "Estrutura de pastas" section (and its mention of
  `shared/mocks`) is **stale** — that mock layer was fully replaced by the
  real backend and no longer exists; don't recreate it. The rest of
  README.md (run/deploy instructions, stack overview, revenue model) is
  accurate and worth reading before touching infra/deploy.

### Money math
The revenue model lives in exactly one place,
`backend/src/domain/commissionRules.ts`: customer pays `P` → platform keeps
`feePercent` (per-`Partner`) → cashback (`cashbackPercent`, per-`Product`) is
credited to the customer's balance → partner nets `P - fee - cashback`.
Applied for real at redemption (`partnerService.redeem`, fully transactional:
order status + cashback credit + stock decrement + audit log in one
`prisma.$transaction`) and at payment confirmation. Don't reimplement this
math inline elsewhere.

## Other docs in this repo
- `IMPLANTACAO.md` — the original .NET/SQL Server implementation plan,
  explicitly superseded (see its own header note). Useful only as historical
  context for the ASP.NET-flavored naming mentioned above.
- `MELHORIAS.md` — running backlog of known non-blocking issues/tech debt
  found during audits. Check it before assuming something is an unintentional
  bug; add to it (not to code comments) when you spot something similar
  you're not fixing right now.
