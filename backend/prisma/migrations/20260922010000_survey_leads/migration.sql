-- CreateEnum
CREATE TYPE "SurveyWhatsappStatus" AS ENUM ('Pending', 'Sent', 'Failed');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "survey_code" TEXT,
ADD COLUMN     "survey_link_views" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "survey_link_responses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "survey_link_leads" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "survey_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID,
    "external_reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "reward_amount" DECIMAL(12,2),
    "whatsapp_status" "SurveyWhatsappStatus" NOT NULL DEFAULT 'Pending',
    "whatsapp_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_survey_code_key" ON "users"("survey_code");

-- CreateIndex
CREATE UNIQUE INDEX "survey_leads_external_reference_key" ON "survey_leads"("external_reference");

-- CreateIndex
CREATE INDEX "survey_leads_driver_id_created_at_idx" ON "survey_leads"("driver_id", "created_at");

-- CreateIndex
CREATE INDEX "survey_leads_phone_idx" ON "survey_leads"("phone");

-- AddForeignKey
ALTER TABLE "survey_leads" ADD CONSTRAINT "survey_leads_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
