import { Router, type Response } from 'express';

/**
 * Política de privacidade e termos de uso do OpenDriverHub, servidos **pelo backend**.
 *
 * Por que isto existe: o app `hub-mobile` aponta `links.privacyPolicy` e `links.terms` para
 * `hub.opendriver.com.br/privacidade` e `/termos` — caminhos que **não existiam**. O nginx do
 * contêiner web devolve `index.html` com status 200 para qualquer caminho
 * (`try_files $uri /index.html`), e o roteador do SPA tem um catch-all que redireciona para a
 * home. Resultado: o revisor da Apple abriria o link da política de privacidade e veria a
 * página inicial da loja. Por `curl` isso é indistinguível de uma página real, e foi o que
 * escondeu o problema.
 *
 * Servido pelo backend, e não como rota nova no SPA, por três razões: é o padrão que o
 * opendriver já usa e tem teste de integração; página de texto legal não deve depender de
 * JavaScript para renderizar; e assim o conteúdo fica junto do código que de fato trata os
 * dados descritos.
 *
 * O texto descreve o que o sistema faz **de verdade** — cada item foi conferido contra o
 * `schema.prisma` e os serviços. Ainda assim, precisa de revisão jurídica antes da publicação.
 */
export const legalRouter = Router();

const UPDATED_AT = '03/10/2026';

/**
 * Identificação do controlador.
 *
 * Valores reais como **padrão no código**, não só variável de ambiente. O opendriver tinha
 * `process.env.LEGAL_COMPANY || 'OpenDriver'` e nenhum `.env` de produção definia a variável,
 * então servia o fallback — que não identifica pessoa jurídica nenhuma. Variável que precisa
 * estar definida para a página ficar correta é variável que um dia não vai estar definida.
 */
const CONTROLADOR = {
  razaoSocial: process.env.LEGAL_COMPANY || 'Heavenbound Systems LTDA',
  nomeFantasia: process.env.LEGAL_TRADE_NAME || 'Open Driver',
  cnpj: process.env.LEGAL_CNPJ || '51.574.461/0001-09',
  endereco:
    process.env.LEGAL_ADDRESS ||
    'Rua 9, Lote 05, Rua das Pitangueiras, Lote 6, Loja 11 e 12 — Norte (Águas Claras), Brasília/DF, CEP 71.908-540',
  contato: process.env.LEGAL_CONTACT_EMAIL || 'murilogillbert@gmail.com',
} as const;

/** Escape local, para este módulo não depender da camada de e-mail. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const contato = () => esc(CONTROLADOR.contato);
const empresa = () => esc(CONTROLADOR.razaoSocial);

function page(res: Response, title: string, body: string) {
  // CSP fechada: a página é texto estático e não carrega script nem imagem de terceiro.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"
  );
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — OpenDriverHub</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px 64px;color:#1F2937;line-height:1.6}
h1{color:#0A1726;font-size:28px}h2{color:#0A1726;font-size:19px;margin-top:28px}li{margin:4px 0}small{color:#6B7280}
a{color:#1F7BFF}</style></head>
<body><h1>${title}</h1><small>Última atualização: ${UPDATED_AT}</small>${body}</body></html>`);
}

function identificacao(): string {
  return `
<h2>Quem trata os seus dados</h2>
<p>
  <b>${esc(CONTROLADOR.razaoSocial)}</b> (nome fantasia ${esc(CONTROLADOR.nomeFantasia)})<br>
  CNPJ ${esc(CONTROLADOR.cnpj)}<br>
  ${esc(CONTROLADOR.endereco)}<br>
  Encarregado pelo tratamento de dados pessoais (DPO):
  <a href="mailto:${contato()}">${contato()}</a>
</p>`;
}

legalRouter.get('/privacidade', (_req, res) => {
  page(
    res,
    'Política de Privacidade',
    `
<p>Esta política explica como ${empresa()} ("nós") trata os dados pessoais de quem usa o OpenDriverHub — o marketplace com cashback para motoristas de aplicativo —, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018). A conta do OpenDriverHub é a mesma do OpenDriver e do OpenDriver Ads.</p>
${identificacao()}

<h2>1. Dados que coletamos</h2>
<ul>
<li><b>Cadastro:</b> nome, e-mail, celular, CPF e senha (guardada apenas como hash). Foto de perfil, se você enviar.</li>
<li><b>Compras:</b> pedidos, itens, valores, formas de pagamento, status e vouchers gerados.</li>
<li><b>Cashback:</b> lançamentos de crédito e débito e o saldo resultante.</li>
<li><b>Pagamentos:</b> o cartão é enviado ao processador de pagamentos (Asaas); guardamos apenas um identificador (token), a bandeira e os 4 últimos dígitos. Não armazenamos número completo nem código de segurança.</li>
<li><b>Programa de afiliados e indicação:</b> quem indicou quem, comissões apuradas, pedidos de saque e chave Pix de quem recebe.</li>
<li><b>Parceiros (lojas):</b> dados da empresa, unidades, documentos enviados para análise e chave Pix de repasse. Os documentos ficam em armazenamento privado, acessível apenas pela equipe de análise.</li>
<li><b>Avaliações</b> que você escreve sobre produtos e lojas.</li>
<li><b>Atendimento:</b> mensagens trocadas com o assistente e registros de contato.</li>
<li><b>Aparelho:</b> token de notificações push e dados técnicos necessários ao funcionamento e à segurança.</li>
<li><b>Localização aproximada ou precisa:</b> somente quando você autoriza, para mostrar as lojas parceiras mais perto de você. Não há coleta em segundo plano.</li>
<li><b>Câmera:</b> usada apenas para ler o QR do voucher no momento do resgate. Nenhuma imagem é armazenada.</li>
</ul>

<h2>2. Para que usamos, e com que base legal</h2>
<ul>
<li>Operar o marketplace: exibir catálogo, processar pedido, emitir voucher, apurar e creditar cashback (<b>execução de contrato</b>).</li>
<li>Verificar lojas parceiras e prevenir fraude (<b>legítimo interesse</b> e <b>cumprimento de obrigação legal</b>).</li>
<li>Apurar comissões de afiliados e repasses a parceiros (<b>execução de contrato</b>).</li>
<li>Enviar avisos sobre os seus pedidos e vouchers (<b>execução de contrato</b>).</li>
<li>Localização e notificação promocional: <b>somente com o seu consentimento</b>, revogável nas configurações do aparelho a qualquer momento.</li>
<li>Cumprir obrigações fiscais, contábeis e regulatórias (<b>obrigação legal</b>).</li>
</ul>

<h2>3. Com quem compartilhamos</h2>
<ul>
<li><b>A loja parceira do seu pedido:</b> recebe o necessário para separar e entregar o benefício — nome, o item comprado e o código do voucher.</li>
<li><b>Processador de pagamentos</b> (Asaas), para cobrar e repassar.</li>
<li><b>Serviço de notificações</b> (Expo, Apple e Google), para avisos no celular.</li>
<li><b>Serviço de mensageria</b>, quando você opta por receber contato por WhatsApp.</li>
<li><b>Autoridades</b>, quando exigido por lei ou ordem judicial.</li>
</ul>
<p><b>Não vendemos dados pessoais, e não fazemos rastreamento para publicidade.</b> O OpenDriverHub não usa identificador de anúncio e não compartilha dados com rede de publicidade.</p>

<h2>4. Por quanto tempo guardamos</h2>
<ul>
<li>Pedidos, pagamentos e lançamentos de cashback: pelo prazo exigido pela legislação fiscal e pelo Código de Defesa do Consumidor.</li>
<li>Documentos de parceiro: enquanto a parceria estiver ativa, e depois pelo prazo legal de guarda.</li>
<li>Demais dados: enquanto a conta estiver ativa.</li>
</ul>

<h2>5. Seus direitos</h2>
<p>Você pode pedir confirmação do tratamento, acesso, correção, anonimização, portabilidade, informação sobre compartilhamento, e revogar consentimentos.</p>
<p>Você pode <b>excluir sua conta pelo próprio app</b> (Conta → Excluir minha conta). Ao excluir: seus dados pessoais são anonimizados, as sessões são encerradas, e o pedido é propagado para os outros serviços do ecossistema (OpenDriver e OpenDriver Ads), que apagam ou anonimizam o lado deles. Registros de pedido e pagamento são mantidos sem identificar você, pelo prazo legal. A exclusão é recusada enquanto houver pedido em aberto ou saldo a receber — nesse caso o app informa o motivo.</p>

<h2>6. Segurança</h2>
<p>Conexão criptografada (HTTPS), senhas com hash, tokens de sessão no armazenamento seguro do aparelho, documentos e chaves de pagamento criptografados, e registro de acesso a documento de parceiro.</p>

<h2>7. Publicidade nos veículos</h2>
<p>O ecossistema opera telas de anúncio em veículos, pela plataforma OpenDriver Ads. <b>Essa operação não usa os seus dados do OpenDriverHub</b>: o anúncio é escolhido pela região e pelo horário do veículo, não por quem está dentro dele, e não há atribuição de anúncio a pessoa.</p>

<h2>8. Contato</h2>
<p>Dúvidas, pedidos de titular e suporte: <a href="mailto:${contato()}">${contato()}</a>.</p>
<p>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>`
  );
});

legalRouter.get('/termos', (_req, res) => {
  page(
    res,
    'Termos de Uso',
    `
<p>Estes termos regem o uso do OpenDriverHub, oferecido por ${empresa()}. Ao criar uma conta ou usar a plataforma, você concorda com eles e com a <a href="/legal/privacidade">Política de Privacidade</a>. A conta é a mesma do OpenDriver e do OpenDriver Ads.</p>
${identificacao()}

<h2>1. O serviço</h2>
<p>O OpenDriverHub é um marketplace que reúne ofertas de lojas parceiras com cashback, voltado a motoristas de aplicativo. <b>Nós não vendemos os produtos e serviços anunciados:</b> quem vende, entrega e responde pelo produto é a loja parceira. Atuamos como plataforma de intermediação e de apuração do cashback.</p>

<h2>2. Conta</h2>
<ul>
<li>Você precisa ter 18 anos ou mais e informar dados verdadeiros.</li>
<li>Você é responsável pela sua senha e pelo uso da sua conta.</li>
<li>Uma conta por pessoa. Contas duplicadas criadas para acumular cashback ou comissão de indicação podem ser bloqueadas.</li>
</ul>

<h2>3. Compras, vouchers e cashback</h2>
<ul>
<li>O preço, o desconto e o percentual de cashback são os informados na hora da compra.</li>
<li>Após o pagamento confirmado, o benefício é entregue como <b>voucher ou código, resgatado junto à loja parceira</b> — no balcão, no site dela ou no canal que ela indicar.</li>
<li>O cashback é creditado como saldo na sua conta depois da confirmação do pagamento e do prazo de eventual arrependimento ou devolução.</li>
<li>O saldo de cashback pode ser usado em compras na plataforma e, quando disponível, sacado conforme as regras informadas no app.</li>
<li>Direito de arrependimento em 7 dias para compras à distância, nos termos do art. 49 do Código de Defesa do Consumidor. Cashback já creditado sobre a compra cancelada é estornado.</li>
</ul>

<h2>4. Programa de indicação e afiliados</h2>
<ul>
<li>A comissão é apurada sobre compras efetivamente pagas por quem você indicou, conforme as regras vigentes no app.</li>
<li>Comissão apurada sobre compra cancelada, estornada ou fraudulenta é revertida.</li>
<li>Saque por Pix para chave em nome do próprio titular. Chave de terceiro é recusada.</li>
<li>Captação por spam, perfil falso ou indução a erro resulta em perda da comissão e bloqueio.</li>
</ul>

<h2>5. Lojas parceiras</h2>
<ul>
<li>O parceiro é responsável pela veracidade da oferta, pelo cumprimento do benefício e pela emissão de documento fiscal.</li>
<li>O cadastro passa por análise documental; podemos recusar ou suspender parceiros que não atendam aos requisitos ou que violem estes termos.</li>
<li>O repasse é feito por Pix para chave em nome do parceiro, descontada a taxa da plataforma informada no contrato de parceria.</li>
</ul>

<h2>6. Conduta</h2>
<ul>
<li>Não use a plataforma para fraude, revenda não autorizada de voucher, ou qualquer finalidade ilícita.</li>
<li>Avaliações devem ser honestas e referir-se a experiência real de compra.</li>
</ul>

<h2>7. Responsabilidades</h2>
<p>Trabalhamos para manter a plataforma disponível e correta, mas não garantimos disponibilidade ininterrupta nem a existência de determinada oferta a todo momento. Problemas com o produto ou serviço adquirido devem ser tratados com a loja parceira; podemos intermediar, e respondemos solidariamente nos limites previstos na legislação consumerista.</p>

<h2>8. Encerramento</h2>
<p>Você pode excluir sua conta a qualquer momento pelo app. Podemos suspender contas que violem estes termos, informando o motivo.</p>

<h2>9. Alterações</h2>
<p>Podemos alterar estes termos; mudanças relevantes são avisadas no app com antecedência razoável. O uso continuado após o aviso significa concordância.</p>

<h2>10. Contato e foro</h2>
<p>Dúvidas e suporte: <a href="mailto:${contato()}">${contato()}</a>. Aplica-se a legislação brasileira, e fica eleito o foro da comarca de Brasília/DF, sem prejuízo do direito do consumidor de demandar no foro do seu domicílio.</p>`
  );
});
