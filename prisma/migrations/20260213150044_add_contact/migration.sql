/*
  Warnings:

  - You are about to drop the column `name` on the `contact_messages` table. All the data in the column will be lost.
  - You are about to drop the column `sender` on the `contact_messages` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `contact_messages` table. All the data in the column will be lost.
  - You are about to drop the column `visitorId` on the `contact_messages` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `contact_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `contact_messages` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `contact_messages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "contact_messages" DROP COLUMN "name",
DROP COLUMN "sender",
DROP COLUMN "subject",
DROP COLUMN "visitorId",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ALTER COLUMN "email" SET NOT NULL;
