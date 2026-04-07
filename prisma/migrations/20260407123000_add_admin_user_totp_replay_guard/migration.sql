ALTER TABLE "AdminUser"
ADD COLUMN "lastTotpStep" INTEGER,
ADD COLUMN "lastTotpSecretHash" TEXT;
