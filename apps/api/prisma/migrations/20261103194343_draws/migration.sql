-- CreateTable
CREATE TABLE "Draw" (
    "timeSlotId" UUID NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("timeSlotId")
);

-- CreateTable
CREATE TABLE "DrawAssignment" (
    "timeSlotId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "gameId" UUID,
    "movedByHand" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DrawAssignment_pkey" PRIMARY KEY ("timeSlotId","participantId")
);

-- CreateIndex
CREATE INDEX "DrawAssignment_participantId_idx" ON "DrawAssignment"("participantId");

-- CreateIndex
CREATE INDEX "DrawAssignment_gameId_idx" ON "DrawAssignment"("gameId");

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawAssignment" ADD CONSTRAINT "DrawAssignment_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "Draw"("timeSlotId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawAssignment" ADD CONSTRAINT "DrawAssignment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawAssignment" ADD CONSTRAINT "DrawAssignment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
