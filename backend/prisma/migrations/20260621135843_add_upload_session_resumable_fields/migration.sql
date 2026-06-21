-- AlterTable
ALTER TABLE "upload_sessions" ADD COLUMN "google_session_uri" TEXT;
ALTER TABLE "upload_sessions" ADD COLUMN "s3_key" TEXT;
ALTER TABLE "upload_sessions" ADD COLUMN "s3_upload_id" TEXT;
