/*
  Warnings:

  - You are about to drop the column `rawOutput` on the `AiAttempt` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AiAnalysis" ADD COLUMN     "assumptions" JSONB,
ADD COLUMN     "centerShape" TEXT,
ADD COLUMN     "jewelryType" TEXT,
ADD COLUMN     "model" TEXT NOT NULL DEFAULT 'gpt-5-mini',
ADD COLUMN     "modelVersion" TEXT NOT NULL DEFAULT 'gpt-5-mini',
ADD COLUMN     "moderationFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderationModel" TEXT,
ADD COLUMN     "moderationResult" JSONB,
ADD COLUMN     "output" JSONB,
ADD COLUMN     "promptVersion" TEXT NOT NULL DEFAULT 'jewelry-analysis-v1',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "sourceImageMimeType" TEXT,
ADD COLUMN     "sourceImageSizeBytes" INTEGER;

-- AlterTable
ALTER TABLE "AiAttempt" DROP COLUMN "rawOutput",
ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "errorType" TEXT,
ADD COLUMN     "latencyMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "modelVersion" TEXT NOT NULL DEFAULT 'gpt-5-mini',
ADD COLUMN     "output" JSONB,
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "promptVersion" TEXT NOT NULL DEFAULT 'jewelry-analysis-v1',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "rawResponse" JSONB,
ADD COLUMN     "responseId" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTokens" INTEGER,
ALTER COLUMN "model" SET DEFAULT 'gpt-5-mini';
