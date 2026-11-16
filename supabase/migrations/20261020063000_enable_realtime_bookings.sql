-- Migration: 20261020063000_enable_realtime_bookings.sql
-- Description: Safely and idempotently adds public.bookings to the supabase_realtime publication
-- and configures REPLICA IDENTITY FULL for complete Realtime update payloads.
-- Row Level Security (RLS) is already enabled on public.bookings and retains company-level tenant isolation.

-- 1. Configure REPLICA IDENTITY FULL so all table columns are published on row UPDATE
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- 2. Safely add public.bookings to supabase_realtime publication only if not already published
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
END $$;
