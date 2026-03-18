-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('SSM', 'SSH', 'AGENT');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('NONE', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('GOOGLE_SYNC', 'CCD_PUSH', 'CERT_OPERATION', 'IMPORT');

-- CreateEnum
CREATE TYPE "MembershipSource" AS ENUM ('MANUAL', 'GOOGLE_SYNC');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "VpnServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "transport" "TransportType" NOT NULL DEFAULT 'SSM',
    "instanceId" TEXT,
    "region" TEXT,
    "sshHost" TEXT,
    "sshPort" INTEGER DEFAULT 22,
    "sshUser" TEXT,
    "sshKeySecretId" TEXT,
    "sshHostKey" TEXT,
    "agentUrl" TEXT,
    "agentApiKeySecretId" TEXT,
    "ccdPath" TEXT NOT NULL,
    "easyRsaPath" TEXT NOT NULL,
    "serverConf" TEXT NOT NULL,
    "vpnNetwork" TEXT NOT NULL DEFAULT '10.8.0.0/24',
    "dnsServers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "routeMode" TEXT NOT NULL DEFAULT 'NAT',
    "splitTunnel" BOOLEAN NOT NULL DEFAULT false,
    "compression" TEXT NOT NULL DEFAULT 'off',
    "protocol" TEXT NOT NULL DEFAULT 'udp',
    "port" INTEGER NOT NULL DEFAULT 1194,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "require2fa" BOOLEAN NOT NULL DEFAULT false,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CidrBlock" (
    "id" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CidrBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "displayName" TEXT,
    "googleUserId" TEXT,
    "certStatus" "CertStatus" NOT NULL DEFAULT 'NONE',
    "certCreatedAt" TIMESTAMP(3),
    "certExpiresAt" TIMESTAMP(3),
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "serverId" TEXT NOT NULL,
    "staticIp" TEXT,
    "allowInternet" BOOLEAN NOT NULL DEFAULT true,
    "maxConnections" INTEGER NOT NULL DEFAULT 1,
    "require2fa" BOOLEAN NOT NULL DEFAULT false,
    "allowedSourceIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ccdSyncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastCcdPush" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VpnUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "method" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "googleSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveUsers" BOOLEAN NOT NULL DEFAULT false,
    "defaultUserRole" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "sessionMaxAge" INTEGER NOT NULL DEFAULT 86400,
    "certExpiryWarnDays" INTEGER NOT NULL DEFAULT 30,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnUserGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "source" "MembershipSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpnUserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleGroupMapping" (
    "id" TEXT NOT NULL,
    "googleGroupEmail" TEXT NOT NULL,
    "googleGroupName" TEXT,
    "vpnGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "type" "SyncType" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "serverId" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "details" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "reason" TEXT,
    "grantedBy" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemporaryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "serverId" TEXT NOT NULL,
    "groupIds" TEXT[],
    "reason" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnConnection" (
    "id" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "realAddress" TEXT NOT NULL,
    "vpnAddress" TEXT NOT NULL,
    "bytesIn" BIGINT NOT NULL DEFAULT 0,
    "bytesOut" BIGINT NOT NULL DEFAULT 0,
    "serverId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "VpnConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VpnGroup_name_serverId_key" ON "VpnGroup"("name", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "CidrBlock_cidr_groupId_key" ON "CidrBlock"("cidr", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnUser_email_serverId_key" ON "VpnUser"("email", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnUser_commonName_serverId_key" ON "VpnUser"("commonName", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnUser_googleUserId_serverId_key" ON "VpnUser"("googleUserId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_idx" ON "LoginHistory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VpnUserGroup_userId_groupId_key" ON "VpnUserGroup"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleGroupMapping_googleGroupEmail_vpnGroupId_key" ON "GoogleGroupMapping"("googleGroupEmail", "vpnGroupId");

-- CreateIndex
CREATE INDEX "TemporaryAccess_userId_idx" ON "TemporaryAccess"("userId");

-- CreateIndex
CREATE INDEX "TemporaryAccess_expiresAt_idx" ON "TemporaryAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "TemporaryAccess_isActive_idx" ON "TemporaryAccess"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");

-- CreateIndex
CREATE INDEX "AccessRequest_createdAt_idx" ON "AccessRequest"("createdAt");

-- CreateIndex
CREATE INDEX "VpnConnection_serverId_idx" ON "VpnConnection"("serverId");

-- CreateIndex
CREATE INDEX "VpnConnection_connectedAt_idx" ON "VpnConnection"("connectedAt");

-- CreateIndex
CREATE INDEX "VpnConnection_commonName_idx" ON "VpnConnection"("commonName");

-- AddForeignKey
ALTER TABLE "VpnGroup" ADD CONSTRAINT "VpnGroup_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CidrBlock" ADD CONSTRAINT "CidrBlock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VpnGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUser" ADD CONSTRAINT "VpnUser_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUserGroup" ADD CONSTRAINT "VpnUserGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VpnUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnUserGroup" ADD CONSTRAINT "VpnUserGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "VpnGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleGroupMapping" ADD CONSTRAINT "GoogleGroupMapping_vpnGroupId_fkey" FOREIGN KEY ("vpnGroupId") REFERENCES "VpnGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryAccess" ADD CONSTRAINT "TemporaryAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VpnUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryAccess" ADD CONSTRAINT "TemporaryAccess_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VpnUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnConnection" ADD CONSTRAINT "VpnConnection_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "VpnServer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
