-- Product identity + keyword semantic gate (P0)
CREATE TABLE "ProductTruthProfile" (
    "id" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "productId" TEXT,
    "coreProduct" TEXT NOT NULL,
    "productFamily" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "verifiedAttributes" JSONB NOT NULL,
    "specifications" JSONB NOT NULL,
    "applications" JSONB NOT NULL,
    "materials" JSONB NOT NULL,
    "certifications" JSONB NOT NULL,
    "capabilities" JSONB NOT NULL,
    "unverifiedClaims" JSONB NOT NULL,
    "conflictingClaims" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "identityConfidence" DOUBLE PRECISION NOT NULL,
    "userVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityConflict" JSONB,
    "keywordRecommendationsPaused" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductTruthProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductTruthProfile_pageUrl_key" ON "ProductTruthProfile"("pageUrl");
CREATE INDEX "ProductTruthProfile_productId_idx" ON "ProductTruthProfile"("productId");

CREATE TABLE "KeywordGateLog" (
    "id" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "blockedReasons" JSONB NOT NULL,
    "demand" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KeywordGateLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KeywordGateLog_pageUrl_idx" ON "KeywordGateLog"("pageUrl");
