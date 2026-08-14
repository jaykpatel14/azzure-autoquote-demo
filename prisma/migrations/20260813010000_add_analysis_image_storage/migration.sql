-- Store analysis source images in private S3 when available.
ALTER TABLE "AiAnalysis"
ADD COLUMN IF NOT EXISTS "sourceImageStorageKey" TEXT;
