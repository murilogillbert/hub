-- AlterEnum
-- Client é mantido no enum para sempre (rede de segurança para tokens/linhas
-- antigas) — só deixa de ser usado em cadastros novos. O UPDATE que migra as
-- linhas Client existentes para Driver vai em uma migration separada
-- (migrate_client_role), porque o Postgres não permite usar um valor de enum
-- recém-adicionado na mesma transação que o criou.
ALTER TYPE "UserRole" ADD VALUE 'Passenger';
ALTER TYPE "UserRole" ADD VALUE 'Driver';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "affiliate_code" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "affiliate_code" TEXT,
ADD COLUMN     "affiliate_driver_id" UUID;

-- CreateTable
CREATE TABLE "driver_affiliates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "link_views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_commission_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "order_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_affiliate_code_key" ON "users"("affiliate_code");

-- CreateIndex
CREATE UNIQUE INDEX "driver_affiliates_partner_id_driver_id_key" ON "driver_affiliates"("partner_id", "driver_id");

-- CreateIndex
CREATE INDEX "driver_commission_entries_partner_id_created_at_idx" ON "driver_commission_entries"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "driver_commission_entries_driver_id_created_at_idx" ON "driver_commission_entries"("driver_id", "created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliate_driver_id_fkey" FOREIGN KEY ("affiliate_driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_affiliates" ADD CONSTRAINT "driver_affiliates_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_affiliates" ADD CONSTRAINT "driver_affiliates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_commission_entries" ADD CONSTRAINT "driver_commission_entries_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_commission_entries" ADD CONSTRAINT "driver_commission_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_commission_entries" ADD CONSTRAINT "driver_commission_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
