-- CreateTable
CREATE TABLE "BlockedIp" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT,
    "blockedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIp_ipAddress_key" ON "BlockedIp"("ipAddress");

-- CreateIndex
CREATE INDEX "BlockedIp_createdAt_idx" ON "BlockedIp"("createdAt");

-- AddForeignKey
ALTER TABLE "BlockedIp" ADD CONSTRAINT "BlockedIp_blockedByUserId_fkey" FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
