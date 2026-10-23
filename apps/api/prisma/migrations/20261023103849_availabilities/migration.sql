-- CreateTable
CREATE TABLE "Availability" (
    "gameMasterId" UUID NOT NULL,
    "timeSlotId" UUID NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("gameMasterId","timeSlotId")
);

-- CreateIndex
CREATE INDEX "Availability_timeSlotId_idx" ON "Availability"("timeSlotId");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_gameMasterId_fkey" FOREIGN KEY ("gameMasterId") REFERENCES "GameMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
