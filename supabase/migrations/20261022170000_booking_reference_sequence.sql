-- Migration: 20261022170000_booking_reference_sequence.sql
-- Description: Server-authoritative sequence and collision-free booking reference generator

-- 1. Create sequence starting comfortably above existing production records (highest existing is NT-25011)
CREATE SEQUENCE IF NOT EXISTS public.booking_reference_seq START WITH 25100 INCREMENT BY 1;

-- 2. Create authoritative, concurrency-safe reference generator
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_val bigint;
  v_candidate text;
  v_exists boolean;
BEGIN
  LOOP
    v_next_val := nextval('public.booking_reference_seq');
    v_candidate := 'NT-' || v_next_val::text;
    SELECT EXISTS (SELECT 1 FROM public.bookings WHERE id = v_candidate) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
END;
$$;

-- 3. Set default column value on public.bookings for zero-config persistence
ALTER TABLE public.bookings ALTER COLUMN id SET DEFAULT public.generate_booking_reference();

-- 4. Grant execute and sequence usage permissions
GRANT USAGE, SELECT ON SEQUENCE public.booking_reference_seq TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_booking_reference() TO anon, authenticated, service_role;
