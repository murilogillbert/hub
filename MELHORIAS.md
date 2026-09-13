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

## Ideias maiores (avaliar depois, com mais tempo)

- **Tokenização de cartão do lado do cliente**: hoje o número do cartão passa
  pelo nosso próprio backend antes de virar token no Asaas — funciona, mas o
  ideal a médio prazo é um SDK client-side (se a Asaas oferecer um no futuro)
  pra o cartão nunca tocar nosso servidor.
- **Verificação de e-mail obrigatória pra login**: hoje é só um aviso — dá pra
  evoluir pra bloqueio total depois que a entrega de e-mail estiver comprovada
  como confiável em produção por um tempo.
