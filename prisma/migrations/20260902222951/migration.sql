-- CreateTable
CREATE TABLE "ProjectModuleProgressMeasurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "moduleId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" DATETIME NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "totalWorkItems" INTEGER NOT NULL,
    "name" TEXT NOT NULL
);
