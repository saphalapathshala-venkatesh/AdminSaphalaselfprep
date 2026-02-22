-- Compat migration: ensure enum has SUPER_ADMIN and User table has isActive

DO $$
BEGIN
  -- add isActive if missing
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='User'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='User' AND column_name='isActive'
    ) THEN
      ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
  END IF;

  -- add SUPER_ADMIN to enum Role if Role exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Role' AND e.enumlabel = 'SUPER_ADMIN'
    ) THEN
      ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
    END IF;
  END IF;

  -- add SUPER_ADMIN to enum UserRole if UserRole exists
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
