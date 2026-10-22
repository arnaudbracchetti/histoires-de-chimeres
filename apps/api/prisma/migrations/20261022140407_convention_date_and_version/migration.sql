-- AlterTable
ALTER TABLE "Convention" ADD COLUMN     "date" DATE,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
