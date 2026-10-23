-- CreateTable
CREATE TABLE "Scenario" (
    "id" UUID NOT NULL,
    "gameMasterId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "presentation" TEXT NOT NULL,
    "contentWarnings" TEXT NOT NULL,
    "seatsMin" INTEGER NOT NULL,
    "seatsMax" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scenario_gameMasterId_idx" ON "Scenario"("gameMasterId");

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_gameMasterId_fkey" FOREIGN KEY ("gameMasterId") REFERENCES "GameMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
