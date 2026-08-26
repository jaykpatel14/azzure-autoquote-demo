CREATE TYPE "DeviceStatus" AS ENUM ('PRE_PROVISIONED', 'ACTIVATED', 'DEACTIVATED');
CREATE TYPE "DeviceType" AS ENUM ('KIOSK', 'PRINTER');

ALTER TABLE "ShowroomDevice"
ADD COLUMN "azzureSerial" TEXT;

CREATE TABLE "AzzureDevice" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PRE_PROVISIONED',
    "companyId" TEXT,
    "showroomDeviceId" TEXT,
    "orderId" TEXT,
    "notes" TEXT,
    "kioskDestination" TEXT NOT NULL DEFAULT 'AI_QUOTE',
    "shippedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AzzureDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AzzureDevice_serialNumber_key" ON "AzzureDevice"("serialNumber");
CREATE UNIQUE INDEX "AzzureDevice_showroomDeviceId_key" ON "AzzureDevice"("showroomDeviceId");
CREATE INDEX "AzzureDevice_companyId_idx" ON "AzzureDevice"("companyId");
CREATE INDEX "AzzureDevice_status_idx" ON "AzzureDevice"("status");

ALTER TABLE "AzzureDevice"
ADD CONSTRAINT "AzzureDevice_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AzzureDevice"
ADD CONSTRAINT "AzzureDevice_showroomDeviceId_fkey"
FOREIGN KEY ("showroomDeviceId") REFERENCES "ShowroomDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
