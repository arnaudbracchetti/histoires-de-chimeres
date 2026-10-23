-- CreateTable
CREATE TABLE "GameMaster" (
    "id" UUID NOT NULL,
    "conventionId" UUID NOT NULL,
    "nickname" TEXT NOT NULL,

    CONSTRAINT "GameMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameMaster_conventionId_idx" ON "GameMaster"("conventionId");

-- AddForeignKey
ALTER TABLE "GameMaster" ADD CONSTRAINT "GameMaster_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
