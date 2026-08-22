-- AlterTable
ALTER TABLE "Company" ADD COLUMN "quotePrefix" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_quotePrefix_key" ON "Company"("quotePrefix");