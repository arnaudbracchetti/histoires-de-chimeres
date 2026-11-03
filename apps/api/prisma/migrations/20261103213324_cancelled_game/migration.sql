-- CreateTable
CREATE TABLE "CancelledGame" (
    "gameId" UUID NOT NULL,
    "timeSlotId" UUID NOT NULL,

    CONSTRAINT "CancelledGame_pkey" PRIMARY KEY ("gameId")
);

-- CreateIndex
CREATE INDEX "CancelledGame_timeSlotId_idx" ON "CancelledGame"("timeSlotId");

-- AddForeignKey
ALTER TABLE "CancelledGame" ADD CONSTRAINT "CancelledGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancelledGame" ADD CONSTRAINT "CancelledGame_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "Draw"("timeSlotId") ON DELETE CASCADE ON UPDATE CASCADE;
