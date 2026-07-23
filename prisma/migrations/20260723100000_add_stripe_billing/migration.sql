-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "isConfigurable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN     "stripeProductId" TEXT;
ALTER TABLE "Plan" ADD COLUMN     "stripePriceId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "stripeProductId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN     "stripePriceId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN     "overageEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN     "overagePriceCents" INTEGER;

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_eventId_key" ON "StripeWebhookEvent"("eventId");
