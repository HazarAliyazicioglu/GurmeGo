-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "address" TEXT,
ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
