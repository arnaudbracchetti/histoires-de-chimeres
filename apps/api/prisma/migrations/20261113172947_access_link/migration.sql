-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accessLinkExpiresAt" TIMESTAMP(3),
ADD COLUMN     "accessLinkTokenHash" TEXT,
ADD COLUMN     "accessLinkUsed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Account_accessLinkTokenHash_key" ON "Account"("accessLinkTokenHash");

