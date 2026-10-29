-- Un MJ est un participant (ADR 0012) : chaque MJ reçoit son participant, sous son propre
-- identifiant et avec son pseudo, qui ne vit plus que là.
INSERT INTO "Participant" ("id", "conventionId", "nickname")
SELECT "id", "conventionId", "nickname" FROM "GameMaster";

-- AlterTable
ALTER TABLE "GameMaster" ADD COLUMN "participantId" UUID;
UPDATE "GameMaster" SET "participantId" = "id";
ALTER TABLE "GameMaster" ALTER COLUMN "participantId" SET NOT NULL;
ALTER TABLE "GameMaster" DROP COLUMN "nickname";

-- CreateIndex
CREATE UNIQUE INDEX "GameMaster_participantId_key" ON "GameMaster"("participantId");

-- AddForeignKey
ALTER TABLE "GameMaster" ADD CONSTRAINT "GameMaster_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
