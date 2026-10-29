-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "conventionId" UUID NOT NULL,
    "nickname" TEXT NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedPhone" (
    "id" TEXT NOT NULL,
    "participantId" UUID NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participant_conventionId_idx" ON "Participant"("conventionId");

-- CreateIndex
CREATE INDEX "LinkedPhone_participantId_idx" ON "LinkedPhone"("participantId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedPhone" ADD CONSTRAINT "LinkedPhone_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
