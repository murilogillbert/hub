import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/seed.js';

// Entrypoint de função serverless da Vercel (Root Directory = backend/).
// Qualquer arquivo em api/ vira uma function; o vercel.json reescreve todas
// as rotas pra cá. Diferente do server.ts (usado em hospedagem com processo
// contínuo — Docker, Railway, etc.), aqui NÃO existe `app.listen`/setInterval:
// a função só processa uma requisição por invocação. A reconciliação de
// pagamentos vira um Cron Job batendo em /api/v1/internal/reconcile-payments
// (ver vercel.json + src/routes/internal.routes.ts).

// Top-level await: roda uma vez por cold start (o módulo fica em cache
// entre invocações da mesma instância "quente"), garantindo o admin antes
// de aceitar qualquer requisição — sem precisar inserir isso no meio da
// pilha de middlewares já montada por createApp().
await ensureAdmin().catch((err) => {
  console.error('Falha ao garantir o admin bootstrap', err);
});

const app = createApp();

export default app;
