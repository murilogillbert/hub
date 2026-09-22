-- CreateTable
CREATE TABLE "survey_video_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "video_url" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" "SurveyWhatsappStatus" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_video_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_video_deliveries_scheduled_at_status_idx" ON "survey_video_deliveries"("scheduled_at", "status");

-- AddForeignKey
ALTER TABLE "survey_video_deliveries" ADD CONSTRAINT "survey_video_deliveries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "survey_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
