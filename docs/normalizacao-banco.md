# Normalização do banco compartilhado

> Contrato entre os três projetos que dividem o mesmo Postgres:
> **`hub`** (web + API), **`opendriver`** (API do app de corridas) e **`hub-mobile`** (app do hub).
>
> Leia isto antes de mexer em identidade, carteira de cashback, exclusão de conta ou qualquer
> tabela do schema `public`. Quem muda um lado sem o outro quebra em produção, não em CI.

---

## 1. Topologia

Um banco físico (`hub`), dois schemas:

| Schema | Dono | Migrations |
|---|---|---|
| `public` | **hub** (`hub/backend/prisma`) | `public._prisma_migrations` |
| `opendriver` | **opendriver** (`opendriver/backend/prisma`) | `opendriver._prisma_migrations` |

Os dois apps mobile não têm banco: falam só com a API do seu serviço.

### Regras de propriedade

1. **Só o hub altera a estrutura de `public`.** O `opendriver/prisma/schema.prisma` espelha apenas
   as colunas de `public` que usa, com `@@schema("public")`, e nunca gera migration para elas.
2. **Só o opendriver altera a estrutura de `opendriver`.** O hub não conhece esse schema.
3. O opendriver **escreve dados** em `public` em três casos já consolidados — `users`
   (cashback e anonimização), `cashback_entries` e `audit_logs`. Fora desses, leitura apenas.
4. **`prisma migrate diff` do OpenDriver não serve como checagem de divergência direta.** Rodado
   contra o banco real, ele compara o `public` INTEIRO do hub com o espelho parcial e produz ~100
   linhas de `DROP TABLE`/`DROP TYPE`/`DROP COLUMN` de objetos do hub — todas esperadas e
   inofensivas, porque esse diff nunca é aplicado. Para avaliar divergência de verdade, filtre: o
   que importa é **não haver nada com `"opendriver".`** e **nenhum `ALTER COLUMN`** em tabela
   espelhada (`users`, `cashback_entries`, `integration_settings`, `audit_logs`, `auth_tokens`,
   `service_api_keys`). Conferido em 2026-10-02: zero nos dois critérios. No hub, o diff é limpo
   (`-- This is an empty migration.`) e pode ser usado direto.
5. Migration em produção é sempre **aditiva** e escrita à mão. Nunca `prisma migrate dev` nem
   `prisma db push` contra o banco de produção — só `migrate deploy`, depois do protocolo de
   backup descrito em `opendriver/docs/plano-producao-final.md`.

---

## 2. O que é compartilhado, e a convenção de cada um

| Recurso | Tabela | Convenção |
|---|---|---|
| Identidade / login | `public.users` | Uma conta serve os dois apps. `role` decide o que cada um mostra. |
| Sessão | — | `JWT_SECRET` **idêntico** nos dois serviços; o token de um vale no outro. |
| Carteira de cashback | `public.users.cashback_balance` + `public.cashback_entries` | Saldo único. O hub credita (`Earned`) na aprovação do pagamento; o opendriver debita (`Used`) ao abater numa corrida. A conta do dinheiro vive em `hub/backend/src/domain/commissionRules.ts` — não reimplementar. |
| Credenciais de integração | `public.integration_settings` | Chave/valor com namespace: `Asaas:*` e `Email:*` (compartilhadas), `OpenDriver:*` (só do app de corridas), `Internal:*` (entre serviços). Editável em Admin → Integrações, sem redeploy. |
| Chaves servidor-a-servidor | `public.service_api_keys` | Hash SHA-256 no banco, escopos, revogável em Admin → Chaves de API. O opendriver **lê** essa tabela (espelho) para autenticar chamadas do hub. |
| Auditoria | `public.audit_logs` | Os dois escrevem. |
| Conta excluída | `public.users.email` | Sufixo **`@invalid.opendriver`**. Os dois serviços checam esse sufixo para invalidar sessão de conta excluída pelo outro — ver §4. |
| Regra de senha | — | Idêntica nos dois: mínimo 8 caracteres, com letra e número. §3. |

---

## 3. Senha

Fonte única em cada serviço, com a **mesma** regra:

- hub: `hub/backend/src/domain/password.ts` (`passwordSchema`, `passwordProblem`)
- opendriver: `opendriver/backend/src/modules/auth/auth.service.ts` (`passwordSchema`)

Mínimo **8 caracteres, com pelo menos uma letra e um número**. Aplicada no cadastro, na
redefinição e na troca de senha.

**Contas antigas não são afetadas**: o login não revalida a regra e não há redefinição forçada.
Quem tem senha de 6 caracteres continua entrando normalmente — a regra nova só vale quando a senha
de fato muda.

Por que importa estar igual: os dois serviços gravam no mesmo `users.password_hash`. Se o hub
aceitasse uma senha mais fraca, a pessoa criaria a conta no hub e o app de corridas recusaria a
mesma senha ao trocá-la.

> Nota: o `SEED_ADMIN_PASSWORD` padrão (`Bababobo!@#`) não tem número e, portanto, não satisfaz a
> regra. Não é um problema de funcionamento — o seed grava o hash direto, sem passar pelo schema —
> mas ao trocar a senha pelo painel o admin precisará de uma que satisfaça.

---

## 4. Exclusão de conta (a parte mais delicada)

A conta é **uma** e os dados dela estão **nos dois schemas**. Antes desta normalização, cada
serviço apagava só o seu lado: excluir pelo app do hub deixava para trás foto de CNH, selfie,
CRLV, token de cartão, contatos de confiança e CPF de dependentes no schema `opendriver` — um
problema de LGPD, não cosmético.

### Desenho

Nenhum serviço apaga a tabela do outro. Cada um expõe duas rotas internas e **orquestra** os dois
lados quando recebe o pedido da pessoa:

```
GET  /api/v1/internal/accounts/:userId/deletion-blockers   escopo account:read
POST /api/v1/internal/accounts/:userId/purge               escopo account:purge
```

Autenticadas por `Authorization: Bearer <chave>` contra `public.service_api_keys` — a mesma loja de
chaves das outras integrações, com escopo e revogação. Nunca por usuário logado.

| Papel | hub | opendriver |
|---|---|---|
| Cliente | `infra/accountSync.ts` | `infra/accountSync.ts` |
| Purga local + impedimentos | `services/accountPurgeService.ts` | `modules/account/accountPurge.service.ts` |
| Rotas internas | `routes/internal.routes.ts` | `modules/account/internal.routes.ts` |
| Middleware de chave | `middleware/apiKey.ts` | `middleware/apiKey.ts` |

### Ordem, e por que é essa

1. Senha e papel conferidos no serviço que recebeu o pedido.
2. **Impedimentos somados dos dois lados**: voucher pago e não resgatado (hub) + corrida em
   andamento (opendriver). Se o outro serviço não responder, a exclusão é **recusada** (`503`).
3. O outro serviço apaga o lado dele.
4. O serviço local apaga o seu lado e anonimiza `public.users` **por último**.

O passo 4 é o último de propósito, e os dois purges são **idempotentes**: se algo falhar no meio, a
conta continua viva e a pessoa repete até concluir. O resultado inverso — conta morta com dado
pessoal sobrando no outro schema — é o que não pode acontecer.

### O que sai e o que fica

Sai: nome, e-mail, telefone, CPF, foto, senha, tokens de acesso, push, notificações, métodos de
pagamento, contatos de confiança, locais salvos, localização, gênero, dependentes (CPF/telefone de
terceiros) e os arquivos de documento no storage (CNH, selfie, CRLV).

Fica, já sem dado pessoal: pedidos, corridas, extrato de cashback, comissões e repasses. As lojas
parceiras e os motoristas precisam desses registros para a contabilidade.

### Invalidação de sessão

JWT é sem estado, então conta excluída ainda teria token válido até expirar. Os dois serviços têm
`isUserActive(userId)` com cache de 60 s que checa o sufixo `@invalid.opendriver` no banco — então
cada um reconhece a exclusão feita pelo outro em no máximo 1 minuto. Quem executa a purga também
limpa o próprio cache na hora (`markUserRevoked` no opendriver, `clearAccountStatusCache` no hub).

### Como ligar (necessário em produção)

1. Admin → **Chaves de API**: criar uma chave marcando as permissões *Consultar impedimentos de
   exclusão de conta* (`account:read`) e *Apagar dados de conta excluída* (`account:purge`).
   O valor em texto puro aparece **uma vez**.
2. Admin → **Integrações** → *Comunicação entre serviços*: colar esse valor em
   `Internal:AccountSyncKey`. Os dois serviços leem daí, então rotacionar não exige redeploy.
3. Variáveis de ambiente (topologia, não segredo):
   - hub: `OPENDRIVER_API_URL=https://api-app.opendriver.com.br`
   - opendriver: `HUB_API_URL=https://hubapi.opendriver.com.br`

**Sem os três passos a exclusão de conta não funciona** — e isso é intencional (fail closed). As
lojas exigem exclusão dentro do app (App Store 5.1.1(v)), então isto é pré-requisito de submissão.

---

## 5. Duplicação aceita

**`public.push_tokens` e `opendriver.push_tokens`.** Parecem a mesma coisa, mas o token do Expo é
por aplicativo: os valores são genuinamente diferentes e cada backend só envia para o app dele.
Unificar exigiria uma coluna de app e não resolveria nada. Fica duplicado, de propósito.

Cada serviço apaga a própria tabela na purga, e a purga cruzada da §4 garante que as duas saiam.

---

## 6. Lacunas conhecidas

1. **A orquestração da exclusão não tem teste automatizado** — exigiria subir os dois serviços
   juntos. Nos testes, `accountSync` é curto-circuitado (`NODE_ENV=test`) e cada suíte verifica só
   o seu lado. Fora de teste nunca é desligado.
2. **Nenhuma migration nova foi aplicada em produção.** A `20261002210000_push_tokens` (hub) e as
   do opendriver desta leva foram validadas num Postgres 16 descartável — todas aplicam limpas e
   `prisma migrate diff` não acusa divergência em nenhum dos dois schemas — mas produção exige o
   protocolo de backup.
3. **Links de e-mail não voltam para o app.** Verificação de e-mail e redefinição de senha montam
   URL a partir de `FRONTEND_URL` e abrem no navegador.
4. **Exclusão de conta e push não têm interface no site.** `POST /me/delete` e o registro de push
   foram feitos para os apps; o frontend web (em produção) não os expõe. As telas de **admin** já
   estão prontas: Chaves de API lista as permissões `account:*` e Integrações mostra todas as
   chaves que os dois serviços leem.

### Catálogo de Integrações

A tela de Integrações é montada a partir do `CATALOG` em `backend/src/services/settingsService.ts`,
e `updateSetting` recusa qualquer chave fora dele. **Chave nova lida por `getSetting` precisa ser
adicionada ao catálogo, senão não há como cadastrar o valor.** Hoje o catálogo cobre todas as
chaves que os dois serviços leem — incluindo as do OpenDriver (`OpenDriver:*`), Infosimples, Google
Maps e `Internal:*`. A tela é orientada a dados: acrescentar ao catálogo faz o campo aparecer sem
mexer no frontend.

---

## 7. Checklist ao mudar contrato

Não há pacote de tipos compartilhado — é a prática descrita em `hub/CLAUDE.md`. Uma mudança de
contrato toca:

| Mudou | Atualize também |
|---|---|
| DTO/rota do hub | `hub/src/shared/api/endpoints.ts`, `hub/src/shared/types/`, `hub-mobile/src/api/{types,endpoints}.ts` |
| DTO/rota do opendriver | `opendriver/mobile/src/api/{types,endpoints}.ts` |
| Estrutura de `public` | espelho em `opendriver/backend/prisma/schema.prisma` (se a coluna for usada lá) |
| Regra de senha | os dois `password`/`auth.service` da §3 |
| Sufixo de conta excluída | `hub/backend/src/infra/auth/accountStatus.ts` **e** `opendriver/backend/src/middleware/auth.ts` |
| Purga de conta | os dois `accountPurge*` da §4 — adicionar tabela nova em **um** só deixa dado para trás |

---

## 8. Auditoria 2026-10-02

Pente fino cruzado entre os três repositórios: inventário de rotas contra os dois clientes mobile,
conferência campo a campo dos DTOs compartilhados (`Order`, `OrderItemLine`, `Product`,
`CashbackEntry`, `Notification`, `User`), verificação de divergência de schema e execução completa
das suítes. Quatro defeitos encontrados — três corrigidos, um documentado como armadilha.

### 8.1 Suíte do hub rodava com um terço dos testes, sem falhar

`hub/backend/tests/testDb.ts` derivava o diretório do projeto de
`new URL('..', import.meta.url).pathname`. Em caminho com espaço, isso devolve a forma
percent-encoded (`.../OneDrive%20-%20SFIEMT/...`), que não existe no disco. O `spawnSync` recebia
um `cwd` inexistente e o Windows respondia `spawnSync C:\WINDOWS\system32\cmd.exe ENOENT` — erro
que não aponta para a causa.

Corrigido com `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')`.
**Regra:** nunca usar `.pathname` de uma `file:` URL como caminho de sistema; sempre
`fileURLToPath`. Vale para os dois backends.

### 8.2 Suítes do hub competindo por um Postgres cada

Sem `fileParallelism: false`, o Vitest subia as 5 suítes em paralelo e cada `testDb` levantava seu
próprio container. Combinado com 8.1, o resultado era **17 testes executados e exit 0** — verde
enganoso. Com `fileParallelism: false` em `hub/backend/vitest.config.ts`: **42 de 42**.

Qualquer suíte que provisione infraestrutura própria precisa desse flag. O opendriver já roda
serial.

### 8.3 `POST /me/delete` sem rate limit

A rota de exclusão de conta do hub confere a senha, mas não estava atrás de limitador. Como
responde diferente para senha certa e errada, servia de oráculo de senha sobre uma sessão já
autenticada, sem custo.

Corrigido aplicando `authRateLimiter` (de `hub/backend/src/middleware/rateLimiter.js`, note o
nome — o arquivo é `rateLimiter.ts`, não `rateLimit.ts`) em `routes/me.routes.ts`. O opendriver já
limitava a sua.
**Regra:** rota que compara senha entra no limitador, mesmo autenticada.

### 8.4 `prisma migrate diff` do OpenDriver é ruidoso por construção

Não é defeito de código, é interpretação. Está descrito como item 4 da §1: o diff compara o
`public` inteiro contra o espelho parcial e cospe ~100 linhas de `DROP`. Os critérios que de fato
importam são zero ocorrências de `"opendriver".` e zero `ALTER COLUMN` em tabela espelhada.
Registrado aqui porque já foi lido como "o banco divergiu" mais de uma vez.

### Como revalidar tudo localmente

Postgres 16 descartável, um banco para os dois schemas:

```
docker run -d --name audit-db -p 55435:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hub postgres:16
```

- **opendriver/backend** — `DATABASE_URL=postgresql://postgres:postgres@localhost:55435/hub?schema=opendriver`,
  `NODE_ENV=test`, `JWT_SECRET` com 32+ caracteres. Resultado: 51/51.
- **hub/backend** — `npm test` (o `testDb` provisiona sozinho). Resultado: 42/42.
- **opendriver/mobile e2e** — precisa de `E2E_API_URL=http://localhost:5199`,
  `E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:55435/hub` e
  `E2E_PG_CONTAINER=audit-db`. O helper fixa `-d hub` no `psql`, então **o banco tem que se chamar
  `hub`** — outro nome falha com erro de banco inexistente. Resultado: 7/7.

Builds e lint verificados no mesmo ciclo: hub backend, hub web (`tsc -b && vite build`), typecheck
do opendriver backend, typecheck + lint + testes do hub-mobile e typecheck + lint do
opendriver/mobile. Todos exit 0.
