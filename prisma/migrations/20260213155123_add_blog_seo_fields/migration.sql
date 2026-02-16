-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaKeywords" TEXT[],
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "ogImage" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "readTime" INTEGER,
ADD COLUMN     "structuredData" TEXT,
ADD COLUMN     "tags" TEXT[];
