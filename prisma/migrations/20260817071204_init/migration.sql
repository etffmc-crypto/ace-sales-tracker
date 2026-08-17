-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CONTRACTOR', 'RESTAURANT', 'PROPERTY_MGMT', 'MUNICIPAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('PROSPECT', 'CONTACTED', 'QUOTED', 'ACTIVE_CUSTOMER', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AccountSource" AS ENUM ('INHERITED', 'PROSPECTED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VISIT', 'CALL', 'EMAIL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Harrisburg',
    "state" TEXT NOT NULL DEFAULT 'PA',
    "zip" TEXT,
    "phone" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'OTHER',
    "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'PROSPECT',
    "source" "AccountSource" NOT NULL DEFAULT 'PROSPECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "InteractionType" NOT NULL,
    "notes" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_pipelineStage_idx" ON "Account"("pipelineStage");

-- CreateIndex
CREATE INDEX "Account_accountType_idx" ON "Account"("accountType");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Interaction_accountId_idx" ON "Interaction"("accountId");

-- CreateIndex
CREATE INDEX "Interaction_date_idx" ON "Interaction"("date");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
