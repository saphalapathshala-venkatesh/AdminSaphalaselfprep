-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "shuffleGroupChildren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shuffleGroups" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false;
