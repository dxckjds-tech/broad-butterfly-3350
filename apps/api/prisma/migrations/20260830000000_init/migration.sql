-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "shopUrl" TEXT NOT NULL,
    "lastDiagnosisAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platformProductId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisReport" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "rawPageData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisScore" (
    "id" TEXT NOT NULL,
    "diagnosisReportId" TEXT NOT NULL,
    "micSeo" INTEGER NOT NULL,
    "googleSeo" INTEGER NOT NULL,
    "geo" INTEGER NOT NULL,
    "contentQuality" INTEGER NOT NULL,
    "b2bConversion" INTEGER NOT NULL,
    "compliance" INTEGER,

    CONSTRAINT "DiagnosisScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisIssue" (
    "id" TEXT NOT NULL,
    "diagnosisReportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "scoreImpact" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Shop_userId_idx" ON "Shop"("userId");

-- CreateIndex
CREATE INDEX "Shop_platform_companyName_idx" ON "Shop"("platform", "companyName");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE INDEX "Product_url_idx" ON "Product"("url");

-- CreateIndex
CREATE INDEX "DiagnosisReport_shopId_idx" ON "DiagnosisReport"("shopId");

-- CreateIndex
CREATE INDEX "DiagnosisReport_productId_idx" ON "DiagnosisReport"("productId");

-- CreateIndex
CREATE INDEX "DiagnosisReport_createdAt_idx" ON "DiagnosisReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisScore_diagnosisReportId_key" ON "DiagnosisScore"("diagnosisReportId");

-- CreateIndex
CREATE INDEX "DiagnosisIssue_diagnosisReportId_idx" ON "DiagnosisIssue"("diagnosisReportId");

-- CreateIndex
CREATE INDEX "DiagnosisIssue_severity_idx" ON "DiagnosisIssue"("severity");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisReport" ADD CONSTRAINT "DiagnosisReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisReport" ADD CONSTRAINT "DiagnosisReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisScore" ADD CONSTRAINT "DiagnosisScore_diagnosisReportId_fkey" FOREIGN KEY ("diagnosisReportId") REFERENCES "DiagnosisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisIssue" ADD CONSTRAINT "DiagnosisIssue_diagnosisReportId_fkey" FOREIGN KEY ("diagnosisReportId") REFERENCES "DiagnosisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
