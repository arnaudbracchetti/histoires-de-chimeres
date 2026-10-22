-- CreateTable
CREATE TABLE "Table" (
    "id" UUID NOT NULL,
    "conventionId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Table_conventionId_idx" ON "Table"("conventionId");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "Convention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
