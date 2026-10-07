-- CreateTable
CREATE TABLE "Quote3DModel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteId" TEXT,
    "analysisId" TEXT,
    "meshyTaskId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sourceImageUrl" TEXT,
    "glbStorageKey" TEXT,
    "usdzStorageKey" TEXT,
    "objStorageKey" TEXT,
    "glbUrl" TEXT,
    "usdzUrl" TEXT,
    "objUrl" TEXT,
    "fbxUrl" TEXT,
    "thumbnailUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote3DModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote3DModel_meshyTaskId_key" ON "Quote3DModel"("meshyTaskId");

-- AddForeignKey
ALTER TABLE "Quote3DModel" ADD CONSTRAINT "Quote3DModel_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote3DModel" ADD CONSTRAINT "Quote3DModel_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
