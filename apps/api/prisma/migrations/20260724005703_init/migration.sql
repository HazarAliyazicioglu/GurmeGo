-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "PriceRange" AS ENUM ('BUDGET', 'MODERATE', 'EXPENSIVE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VenueSource" AS ENUM ('MANUAL', 'USER', 'AUTO');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('REPORT', 'NEW_VENUE', 'EDIT', 'OWNER_VERIFICATION');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'APPROVED_RATER', 'CURATOR', 'ADMIN');

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "location" geography(Point,4326) NOT NULL,
    "category" TEXT NOT NULL,
    "cuisineType" TEXT,
    "priceRange" "PriceRange" NOT NULL,
    "signatureItems" TEXT[],
    "transportNote" TEXT,
    "openingHours" JSONB NOT NULL,
    "editorialNote" TEXT,
    "isBoutique" BOOLEAN NOT NULL DEFAULT false,
    "branchCount" INTEGER NOT NULL DEFAULT 1,
    "franchiseFlag" BOOLEAN NOT NULL DEFAULT false,
    "source" "VenueSource" NOT NULL DEFAULT 'MANUAL',
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
    "googleRating" DOUBLE PRECISION,
    "googleRatingCount" INTEGER,
    "googlePlaceId" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueVersion" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "VenueVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionQueue" (
    "id" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "venueId" TEXT,
    "payload" JSONB NOT NULL,
    "submittedBy" TEXT,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "District_slug_key" ON "District"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_districtId_idx" ON "Venue"("districtId");

-- CreateIndex
CREATE INDEX "Venue_status_idx" ON "Venue"("status");

-- CreateIndex
CREATE INDEX "VenueVersion_venueId_idx" ON "VenueVersion"("venueId");

-- CreateIndex
CREATE INDEX "ContributionQueue_venueId_status_idx" ON "ContributionQueue"("venueId", "status");

-- CreateIndex
CREATE INDEX "ContributionQueue_type_status_idx" ON "ContributionQueue"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_listId_venueId_key" ON "Favorite"("listId", "venueId");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueVersion" ADD CONSTRAINT "VenueVersion_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionQueue" ADD CONSTRAINT "ContributionQueue_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteList" ADD CONSTRAINT "FavoriteList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_listId_fkey" FOREIGN KEY ("listId") REFERENCES "FavoriteList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateIndex (GIST for geography column, Prisma cannot express this)
CREATE INDEX "Venue_location_idx" ON "Venue" USING GIST ("location");
