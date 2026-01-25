-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "isMock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resultNhlGameId" INTEGER;
