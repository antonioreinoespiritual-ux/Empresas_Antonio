/*
  Warnings:

  - Added the required column `updatedAt` to the `admin_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `admin_verifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `user_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `user_verifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "admin_sessions" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "admin_verifications" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "user_verifications" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
