-- CreateTable
CREATE TABLE "tailorings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tailoredCv" JSONB NOT NULL,
    "coverLetter" TEXT NOT NULL,
    "whatChanged" JSONB NOT NULL,
    "atsScore" INTEGER NOT NULL,
    "keywordsCovered" JSONB NOT NULL,
    "unmetRequirement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tailorings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tailorings_jobPostId_key" ON "tailorings"("jobPostId");

-- CreateIndex
CREATE INDEX "tailorings_userId_idx" ON "tailorings"("userId");

-- AddForeignKey
ALTER TABLE "tailorings" ADD CONSTRAINT "tailorings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailorings" ADD CONSTRAINT "tailorings_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
