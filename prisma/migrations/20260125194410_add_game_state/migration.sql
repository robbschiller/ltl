-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "nhlGameId" INTEGER,
    "opponent" TEXT NOT NULL,
    "opponentLogo" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "startTimeUTC" TEXT,
    "status" TEXT NOT NULL,
    "teamGoals" INTEGER NOT NULL DEFAULT 0,
    "opponentGoals" INTEGER NOT NULL DEFAULT 0,
    "wentToOT" BOOLEAN NOT NULL DEFAULT false,
    "emptyNetGoals" INTEGER NOT NULL DEFAULT 0,
    "shootoutOccurred" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameUserScore" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameUserScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "Game_finalizedAt_idx" ON "Game"("finalizedAt");

-- CreateIndex
CREATE INDEX "GameUserScore_gameId_idx" ON "GameUserScore"("gameId");

-- CreateIndex
CREATE INDEX "GameUserScore_userId_idx" ON "GameUserScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameUserScore_gameId_userId_key" ON "GameUserScore"("gameId", "userId");
