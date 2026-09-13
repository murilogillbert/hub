-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'Email', 'Phone', 'Random');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EmailVerification', 'PasswordReset');

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "pix_key" TEXT,
ADD COLUMN     "pix_key_type" "PixKeyType";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" VARCHAR(20),
ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "withdrawal_requests" ADD COLUMN     "pix_key" TEXT,
ADD COLUMN     "pix_key_type" "PixKeyType";

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: contas já cadastradas antes da verificação de e-mail existir não
-- devem ficar retroativamente marcadas como "não verificadas".
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
