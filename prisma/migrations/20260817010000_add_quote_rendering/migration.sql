CREATE TYPE "RenderingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "Quote"
ADD COLUMN "renderingStatus" "RenderingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "renderingStorageKey" TEXT,
ADD COLUMN "renderingDataUrl" TEXT,
ADD COLUMN "renderingMimeType" TEXT DEFAULT 'image/jpeg',
ADD COLUMN "renderingModel" TEXT,
ADD COLUMN "renderingError" TEXT,
ADD COLUMN "renderingCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Quote_renderingStorageKey_key" ON "Quote"("renderingStorageKey");
