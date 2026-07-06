-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "failureReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;
