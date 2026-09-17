-- CreateTable
CREATE TABLE "job_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedTitle" TEXT,
    "parsedCompany" TEXT,
    "parsedLocation" TEXT,
    "parsedDescription" TEXT,
    "parsedRequirements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_posts_userId_urlHash_key" ON "job_posts"("userId", "urlHash");

-- AddForeignKey
ALTER TABLE "job_posts" ADD CONSTRAINT "job_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
