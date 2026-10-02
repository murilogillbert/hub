-- Notificação push para o app mobile (../../hub-mobile). Aditivo: tabela nova, nenhuma coluna
-- existente alterada ou removida.
--
-- `token` é único porque o mesmo aparelho pode trocar de conta: o registro faz upsert na chave e
-- o token passa a pertencer ao usuário que entrou por último.
-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" VARCHAR(200) NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- Sem FOREIGN KEY para users, de propósito: é o mesmo desenho da tabela "notifications" (ver
-- 20260912003127_init), e manter a paridade com o schema.prisma evita divergência. A limpeza dos
-- tokens na exclusão de conta é feita explicitamente em authService.deleteAccount.
