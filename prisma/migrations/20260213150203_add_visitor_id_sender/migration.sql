-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "sender" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "visitorId" TEXT;
