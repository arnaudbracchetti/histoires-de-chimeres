-- AlterTable
ALTER TABLE "LinkedPhone" ADD COLUMN     "pushAuth" TEXT,
ADD COLUMN     "pushEndpoint" TEXT,
ADD COLUMN     "pushP256dh" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LinkedPhone_pushEndpoint_key" ON "LinkedPhone"("pushEndpoint");
