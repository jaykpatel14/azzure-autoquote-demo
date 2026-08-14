-- Add avatar URL support for the settings profile screen
ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT;
