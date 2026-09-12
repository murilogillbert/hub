-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('Marketplace', 'SolarAffiliate');

-- CreateEnum
CREATE TYPE "CommissionEntryType" AS ENUM ('Credit', 'Debit');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Paid');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'Financeiro';

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "commission_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "PartnerKind" NOT NULL DEFAULT 'Marketplace',
ADD COLUMN     "link_leads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "link_sales" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "link_views" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "owned_by_company" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referral_code" TEXT;

-- CreateTable
CREATE TABLE "affiliate_commission_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "type" "CommissionEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "external_reference" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'Pending',
    "note" VARCHAR(400) NOT NULL DEFAULT '',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "file_url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,

    CONSTRAINT "affiliate_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(120) NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "key_preview" VARCHAR(16) NOT NULL,
    "scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commission_entries_external_reference_key" ON "affiliate_commission_entries"("external_reference");

-- CreateIndex
CREATE INDEX "affiliate_commission_entries_partner_id_created_at_idx" ON "affiliate_commission_entries"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "withdrawal_requests_partner_id_requested_at_idx" ON "withdrawal_requests"("partner_id", "requested_at");

-- CreateIndex
CREATE INDEX "affiliate_applications_status_created_at_idx" ON "affiliate_applications"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_api_keys_hashed_key_key" ON "service_api_keys"("hashed_key");

-- CreateIndex
CREATE UNIQUE INDEX "partners_referral_code_key" ON "partners"("referral_code");

-- AddForeignKey
ALTER TABLE "affiliate_commission_entries" ADD CONSTRAINT "affiliate_commission_entries_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

