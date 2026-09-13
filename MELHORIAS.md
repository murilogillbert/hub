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

## Pode ficar para a primeira semana pós-lançamento

- **CRUD de parceiro no admin**: o backend já tem `deletePartner` (soft-delete)
  pronto e funcionando, mas nenhuma tela usa — hoje só dá pra pausar/reativar
  parceiro pelo admin. Se fizer sentido remover parceiros de vez, é só expor o
  botão que já existe.
- **Erro da calculadora "Lucro Real" é 100% silencioso**: se o envio pro backend
  falhar, o cliente nem percebe (o diagnóstico local aparece igual, por decisão
  de design). Bom pra não travar a experiência, mas significa que uma falha no
  backend nesse canal de captação de lead só aparece se alguém for olhar os logs
  do servidor.
- **Texto/comentário desatualizado sobre troca de gateway de pagamento**: o
  código comenta que o admin troca o provedor de pagamento (mock/Mercado
  Pago/Asaas) sem precisar reiniciar, mas na prática isso vem de uma variável de
  ambiente fixa no boot — trocar de fato exige redeploy. Não afeta ninguém hoje
  (só um comentário incorreto no código), mas vale corrigir antes que confunda
  alguém no futuro.

## Ideias maiores (avaliar depois, com mais tempo)

- **Tokenização de cartão do lado do cliente**: hoje o número do cartão passa
  pelo nosso próprio backend antes de virar token no Asaas — funciona, mas o
  ideal a médio prazo é um SDK client-side (se a Asaas oferecer um no futuro)
  pra o cartão nunca tocar nosso servidor.
- **Verificação de e-mail obrigatória pra login**: hoje é só um aviso — dá pra
  evoluir pra bloqueio total depois que a entrega de e-mail estiver comprovada
  como confiável em produção por um tempo.
