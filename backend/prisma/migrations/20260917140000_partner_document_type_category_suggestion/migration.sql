-- CreateEnum
CREATE TYPE "PartnerDocumentType" AS ENUM ('CPF', 'CNPJ');

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "document_type" "PartnerDocumentType" NOT NULL DEFAULT 'CNPJ';

-- CreateTable
CREATE TABLE "category_suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "type" "CategoryType" NOT NULL DEFAULT 'Store',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'Pending',
    "partner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,

    CONSTRAINT "category_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_suggestions_status_created_at_idx" ON "category_suggestions"("status", "created_at");

-- AddForeignKey
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
