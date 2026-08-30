-- MIC Virtual Office sync tables
CREATE TABLE "MicAccountConnection" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "lastLoginDetectedAt" TIMESTAMP(3),
    "inquiryRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MicAccountConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MicAccountConnection_shopId_key" ON "MicAccountConnection"("shopId");
ALTER TABLE "MicAccountConnection" ADD CONSTRAINT "MicAccountConnection_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
