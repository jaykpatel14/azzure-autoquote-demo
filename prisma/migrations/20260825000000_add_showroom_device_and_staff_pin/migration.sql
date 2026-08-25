-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kioskPinHash" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShowroomDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenIp" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowroomDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KioskStaffSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskStaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShowroomDevice_deviceToken_key" ON "ShowroomDevice"("deviceToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShowroomDevice_companyId_idx" ON "ShowroomDevice"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShowroomDevice_sessionId_idx" ON "ShowroomDevice"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KioskStaffSession_token_key" ON "KioskStaffSession"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KioskStaffSession_companyId_idx" ON "KioskStaffSession"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KioskStaffSession_token_idx" ON "KioskStaffSession"("token");

-- AddForeignKey
ALTER TABLE "ShowroomDevice" ADD CONSTRAINT "ShowroomDevice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ShowroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowroomDevice" ADD CONSTRAINT "ShowroomDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
