-- Compat migration: ensure UserRole enum has SUPER_ADMIN and User table has isActive

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole' AND e.enumlabel = 'SUPER_ADMIN'
    ) THEN
      ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
    END IF;
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
