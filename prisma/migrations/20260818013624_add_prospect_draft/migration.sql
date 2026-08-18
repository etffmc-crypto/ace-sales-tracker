-- CreateTable
CREATE TABLE "ProspectDraft" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectDraft_reviewed_idx" ON "ProspectDraft"("reviewed");

-- AddForeignKey
ALTER TABLE "ProspectDraft" ADD CONSTRAINT "ProspectDraft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
