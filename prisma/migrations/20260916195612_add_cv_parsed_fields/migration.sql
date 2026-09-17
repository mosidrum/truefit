-- AlterTable
ALTER TABLE "cvs" ADD COLUMN     "parsedHeadline" TEXT,
ADD COLUMN     "parsedLocation" TEXT,
ADD COLUMN     "parsedRoles" JSONB,
ADD COLUMN     "parsedSkills" JSONB,
ADD COLUMN     "parsedYears" INTEGER;
