-- Add a concurrency-safe per-company quote sequence.
ALTER TABLE "Company"
ADD COLUMN "quoteSequence" INTEGER NOT NULL DEFAULT 0;
