-- CreateEnum
CREATE TYPE "ThemeId" AS ENUM ('premium_light', 'premium_dark', 'editorial', 'high_conversion');

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "themeId" "ThemeId" NOT NULL DEFAULT 'premium_light';
