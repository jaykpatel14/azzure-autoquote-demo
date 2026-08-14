ALTER TABLE "Quote" ADD COLUMN "publicShareToken" TEXT;
ALTER TABLE "Quote" ADD COLUMN "sharedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Quote_publicShareToken_key" ON "Quote"("publicShareToken");
