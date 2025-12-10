-- CreateTable
CREATE TABLE "PickOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PickOrder_id_key" ON "PickOrder"("id");
