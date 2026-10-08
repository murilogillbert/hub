-- Remove a dependência de runtime do DiceBear.
--
-- Até aqui, todo usuário nascia com `avatar_url` apontando para
-- `https://api.dicebear.com/9.x/avataaars/svg?seed=<nome>`, e toda loja com `logo_url` no mesmo
-- formato. O efeito prático: a foto de **todo** usuário que nunca trocou dependia de um serviço
-- de terceiro estar no ar em tempo de execução, e cada tela que lista usuários fazia uma chamada
-- externa por linha — fora do nosso controle, fora do nosso monitoramento, e dentro do caminho
-- de render.
--
-- A partir de 2026-10-09 o cadastro grava vazio, e **cada cliente desenha as iniciais** (círculo
-- com cor derivada do nome). Ver `src/domain/avatar.ts` para por que não é um SVG nosso em data
-- URI: o `Image` do React Native não renderiza SVG, e o `resolveImageUrl` do app recusa `data:`.
--
-- Esta migration limpa o acervo. Sem ela, quem já tem conta continuaria puxando do DiceBear para
-- sempre — a correção valeria só para cadastros novos, e a dependência externa continuaria viva
-- para a base inteira.
--
-- Converte para string vazia, e não para NULL, porque as duas colunas têm semântica diferente:
-- `users.avatar_url` é anulável e `partners.logo_url` tem `DEFAULT ''` e é NOT NULL. Vazio
-- funciona nas duas, e os clientes já tratam vazio como "sem foto".

UPDATE "users"
   SET "avatar_url" = ''
 WHERE "avatar_url" LIKE '%api.dicebear.com%';

UPDATE "partners"
   SET "logo_url" = ''
 WHERE "logo_url" LIKE '%api.dicebear.com%';

-- Foto enviada de verdade (que vive no MinIO, sob `/uploads` ou no domínio do storage) não é
-- tocada: o `LIKE` acima só casa com o host do DiceBear.
