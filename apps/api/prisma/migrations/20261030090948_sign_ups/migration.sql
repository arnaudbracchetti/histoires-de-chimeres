-- CreateTable
CREATE TABLE "SignUp" (
    "participantId" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "signedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignUp_pkey" PRIMARY KEY ("participantId","gameId")
);

-- CreateIndex
CREATE INDEX "SignUp_gameId_idx" ON "SignUp"("gameId");

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
