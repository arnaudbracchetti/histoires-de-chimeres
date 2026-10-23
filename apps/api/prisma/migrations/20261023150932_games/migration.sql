-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "conventionId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "seatsMin" INTEGER,
    "seatsMax" INTEGER,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTimeSlot" (
    "gameId" UUID NOT NULL,
    "timeSlotId" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "gameMasterId" UUID NOT NULL,

    CONSTRAINT "GameTimeSlot_pkey" PRIMARY KEY ("gameId","timeSlotId")
);

-- CreateIndex
CREATE INDEX "Game_conventionId_idx" ON "Game"("conventionId");

-- CreateIndex
CREATE INDEX "Game_scenarioId_idx" ON "Game"("scenarioId");

-- CreateIndex
CREATE INDEX "GameTimeSlot_tableId_idx" ON "GameTimeSlot"("tableId");

-- CreateIndex
CREATE INDEX "GameTimeSlot_gameMasterId_idx" ON "GameTimeSlot"("gameMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "GameTimeSlot_timeSlotId_tableId_key" ON "GameTimeSlot"("timeSlotId", "tableId");

-- CreateIndex
CREATE UNIQUE INDEX "GameTimeSlot_timeSlotId_gameMasterId_key" ON "GameTimeSlot"("timeSlotId", "gameMasterId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTimeSlot" ADD CONSTRAINT "GameTimeSlot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTimeSlot" ADD CONSTRAINT "GameTimeSlot_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTimeSlot" ADD CONSTRAINT "GameTimeSlot_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTimeSlot" ADD CONSTRAINT "GameTimeSlot_gameMasterId_fkey" FOREIGN KEY ("gameMasterId") REFERENCES "GameMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
