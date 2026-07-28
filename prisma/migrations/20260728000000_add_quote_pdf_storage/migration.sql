-- Persist generated quote PDFs in S3-backed storage.
ALTER TABLE "Quote" ADD COLUMN     "pdfStorageKey" TEXT;
ALTER TABLE "Quote" ADD COLUMN     "pdfStoredAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN     "pdfContentType" TEXT NOT NULL DEFAULT 'application/pdf';

CREATE UNIQUE INDEX "Quote_pdfStorageKey_key" ON "Quote"("pdfStorageKey");
