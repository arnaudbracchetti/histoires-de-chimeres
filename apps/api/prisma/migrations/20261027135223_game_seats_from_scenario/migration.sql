/*
  Warnings:

  - You are about to drop the column `seatsMax` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `seatsMin` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "seatsMax",
DROP COLUMN "seatsMin";
