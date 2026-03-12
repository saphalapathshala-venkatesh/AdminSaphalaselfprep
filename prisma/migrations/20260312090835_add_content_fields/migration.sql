-- AlterTable
ALTER TABLE "ContentPage" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "topicId" TEXT;

-- AlterTable
ALTER TABLE "FlashcardDeck" ADD COLUMN     "subtopicId" TEXT;

-- AlterTable
ALTER TABLE "PdfAsset" ADD COLUMN     "isDownloadable" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "ContentPage_categoryId_idx" ON "ContentPage"("categoryId");

-- CreateIndex
CREATE INDEX "PdfAsset_categoryId_idx" ON "PdfAsset"("categoryId");
