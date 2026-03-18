-- CreateEnum
CREATE TYPE "AuthRateLimitScope" AS ENUM ('EMAIL', 'IP');

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "id" TEXT NOT NULL,
    "scopeType" "AuthRateLimitScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthRateLimit_scopeType_scopeKey_key" ON "AuthRateLimit"("scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "AuthRateLimit_lockedUntil_idx" ON "AuthRateLimit"("lockedUntil");
