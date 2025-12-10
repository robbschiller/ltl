-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerPosition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSeasonPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickOrder" (
    "id" TEXT NOT NULL,
    "userIds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Pick_userId_idx" ON "Pick"("userId");

-- CreateIndex
CREATE INDEX "Pick_gameId_idx" ON "Pick"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_userId_gameId_key" ON "Pick"("userId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "UserScore_userId_key" ON "UserScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PickOrder_id_key" ON "PickOrder"("id");

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScore" ADD CONSTRAINT "UserScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

