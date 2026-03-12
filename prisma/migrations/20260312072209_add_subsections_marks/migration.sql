-- AlterTable
ALTER TABLE "TestQuestion" ADD COLUMN     "marks" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "negativeMarks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TestSection" ADD COLUMN     "parentSectionId" TEXT,
ADD COLUMN     "targetCount" INTEGER;

-- CreateIndex
CREATE INDEX "TestSection_parentSectionId_idx" ON "TestSection"("parentSectionId");

-- AddForeignKey
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "TestSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
