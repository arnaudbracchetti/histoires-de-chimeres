-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "imageId" UUID;

-- CreateTable
CREATE TABLE "ScenarioImage" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "ScenarioImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioImage_scenarioId_idx" ON "ScenarioImage"("scenarioId");

-- AddForeignKey
ALTER TABLE "ScenarioImage" ADD CONSTRAINT "ScenarioImage_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
