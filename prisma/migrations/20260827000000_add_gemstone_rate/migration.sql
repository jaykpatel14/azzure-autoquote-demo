-- CreateTable
CREATE TABLE "GemstoneRate" (
    "id" TEXT NOT NULL,
    "stone" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "commercialLowPerCt" DECIMAL(65,30) NOT NULL,
    "commercialHighPerCt" DECIMAL(65,30) NOT NULL,
    "fineLowPerCt" DECIMAL(65,30) NOT NULL,
    "fineHighPerCt" DECIMAL(65,30) NOT NULL,
    "premiumLowPerCt" DECIMAL(65,30) NOT NULL,
    "premiumHighPerCt" DECIMAL(65,30) NOT NULL,
    "sources" TEXT,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GemstoneRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GemstoneRate_stone_key" ON "GemstoneRate"("stone");
