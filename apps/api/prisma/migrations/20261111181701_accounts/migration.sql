-- AlterTable
ALTER TABLE "Convention" ADD COLUMN     "firstOrganizerFingerprint" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "organizer" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSession" (
    "idHash" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSession_pkey" PRIMARY KEY ("idHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_participantId_key" ON "Account"("participantId");

-- CreateIndex
CREATE INDEX "AccountSession_accountId_idx" ON "AccountSession"("accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSession" ADD CONSTRAINT "AccountSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
