-- AlterTable
ALTER TABLE "Guild" ADD COLUMN "permanenceChannelId" TEXT;

-- CreateTable
CREATE TABLE "Availability" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Availability_userId_day_key" ON "Availability"("userId", "day");
