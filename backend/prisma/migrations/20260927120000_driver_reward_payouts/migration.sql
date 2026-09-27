-- CreateEnum
CREATE TYPE "DriverRewardSource" AS ENUM ('DriverCommission', 'SurveyReward');

-- CreateTable
CREATE TABLE "driver_reward_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "source" "DriverRewardSource" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" VARCHAR(400) NOT NULL DEFAULT '',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_reward_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_reward_payouts_driver_id_source_created_at_idx" ON "driver_reward_payouts"("driver_id", "source", "created_at");

-- AddForeignKey
ALTER TABLE "driver_reward_payouts" ADD CONSTRAINT "driver_reward_payouts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
