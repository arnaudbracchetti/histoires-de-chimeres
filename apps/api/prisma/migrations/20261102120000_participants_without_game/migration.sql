-- CreateTable
CREATE TABLE "ParticipantWithoutGame" (
    "participantId" UUID NOT NULL,
    "timeSlotId" UUID NOT NULL,

    CONSTRAINT "ParticipantWithoutGame_pkey" PRIMARY KEY ("participantId","timeSlotId")
);

-- CreateIndex
CREATE INDEX "ParticipantWithoutGame_timeSlotId_idx" ON "ParticipantWithoutGame"("timeSlotId");

-- AddForeignKey
ALTER TABLE "ParticipantWithoutGame" ADD CONSTRAINT "ParticipantWithoutGame_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantWithoutGame" ADD CONSTRAINT "ParticipantWithoutGame_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
