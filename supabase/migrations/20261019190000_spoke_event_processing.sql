-- Migration: 20261019190000_spoke_event_processing.sql
-- Description: Implement Phase 2 Spoke Dispatch event processing infrastructure.
--              1. Adds public.spoke_booking_stop_state for persistent per-stop lifecycle tracking.
--              2. Adds customer-safe tracking columns (pickup_tracking_url, delivery_tracking_url) to public.bookings.
--              3. Creates atomic transaction-safe RPC public.process_spoke_webhook_event.
--              4. Applies least-privilege security: RLS enabled, access restricted strictly to service_role.

-- 1. Create public.spoke_booking_stop_state table
CREATE TABLE IF NOT EXISTS public.spoke_booking_stop_state (
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id text NULL,
  activity text NOT NULL CHECK (activity IN ('pickup', 'delivery')),
  spoke_stop_id text NULL,
  tracking_url text NULL,
  delivery_state text NULL,
  delivery_succeeded boolean NULL,
  latest_event_type text NOT NULL,
  latest_event_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, activity)
);

-- Indexes for stop state queries
CREATE INDEX IF NOT EXISTS idx_spoke_booking_stop_state_stop_id
  ON public.spoke_booking_stop_state (spoke_stop_id);

CREATE INDEX IF NOT EXISTS idx_spoke_booking_stop_state_booking_id
  ON public.spoke_booking_stop_state (booking_id);

-- Enable Row Level Security (RLS) on internal stop state table
ALTER TABLE public.spoke_booking_stop_state ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke all table privileges from PUBLIC, anon, and authenticated roles.
-- This table contains internal operational dispatch telemetry for server-side processing only.
REVOKE ALL ON TABLE public.spoke_booking_stop_state FROM PUBLIC, anon, authenticated;

-- Grant required DML privileges strictly to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.spoke_booking_stop_state TO service_role;

-- 2. Add customer-safe tracking URL columns to public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pickup_tracking_url text NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS delivery_tracking_url text NULL;

-- 3. Comments on tables and columns
COMMENT ON TABLE public.spoke_booking_stop_state IS 'Internal per-stop Spoke Dispatch lifecycle and tracking state keyed by (booking_id, activity).';
COMMENT ON COLUMN public.spoke_booking_stop_state.booking_id IS 'Authoritative NEO Transport booking ID reference.';
COMMENT ON COLUMN public.spoke_booking_stop_state.company_id IS 'Authoritative NEO Transport customer company ID.';
COMMENT ON COLUMN public.spoke_booking_stop_state.activity IS 'Stop activity role: pickup or delivery.';
COMMENT ON COLUMN public.spoke_booking_stop_state.spoke_stop_id IS 'Spoke Dispatch stop ID identifier (supports unassigned to assigned transition).';
COMMENT ON COLUMN public.spoke_booking_stop_state.tracking_url IS 'Official HTTPS tracking URL issued by Spoke Dispatch.';
COMMENT ON COLUMN public.spoke_booking_stop_state.delivery_state IS 'Latest reported delivery state from Spoke Dispatch telemetry.';
COMMENT ON COLUMN public.spoke_booking_stop_state.delivery_succeeded IS 'Flag establishing whether delivery attempt succeeded.';
COMMENT ON COLUMN public.spoke_booking_stop_state.latest_event_type IS 'Type of the latest processed Spoke webhook event.';
COMMENT ON COLUMN public.spoke_booking_stop_state.latest_event_created_at IS 'Spoke generation timestamp of the latest processed event (guards against out-of-order regression).';
COMMENT ON COLUMN public.bookings.pickup_tracking_url IS 'Validated external HTTPS tracking link for pickup stop.';
COMMENT ON COLUMN public.bookings.delivery_tracking_url IS 'Validated external HTTPS tracking link for delivery stop.';

-- 4. Transaction-safe database RPC to process a stored webhook event atomically
CREATE OR REPLACE FUNCTION public.process_spoke_webhook_event(p_event_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event record;
  v_payload jsonb;
  v_type text;
  v_created_epoch bigint;
  v_created_at timestamptz;
  v_data jsonb;
  v_stop jsonb;
  v_booking_id text;
  v_external_id text;
  v_activity text;
  v_stop_id text;
  v_tracking_link text;
  v_clean_tracking_url text;
  v_delivery_info jsonb;
  v_delivery_succeeded boolean;
  v_delivery_state text;
  v_booking record;
  v_existing_stop record;
  v_new_status text;
  v_new_progress numeric(4,2);
BEGIN
  -- Lock and retrieve inbox event row
  SELECT * INTO v_event
  FROM public.spoke_webhook_events
  WHERE event_hash = p_event_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Webhook event not found.');
  END IF;

  -- If already processed or ignored, return status idempotently
  IF v_event.processing_status = 'processed' THEN
    RETURN jsonb_build_object('status', 'already_processed', 'event_hash', p_event_hash);
  END IF;
  IF v_event.processing_status = 'ignored' THEN
    RETURN jsonb_build_object('status', 'already_ignored', 'event_hash', p_event_hash, 'reason', v_event.processing_error);
  END IF;

  v_payload := v_event.payload;
  v_type := v_payload->>'type';
  v_created_epoch := (v_payload->>'created')::bigint;
  v_created_at := to_timestamp(v_created_epoch / 1000.0);

  -- Diagnostic test event: never update real bookings
  IF v_type = 'test.send_event' THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'Diagnostic test event acknowledged (no booking affected).'
    WHERE event_hash = p_event_hash;

    RETURN jsonb_build_object('status', 'ignored', 'reason', 'Diagnostic test event acknowledged.');
  END IF;

  -- Extract stop payload fields
  v_data := v_payload->'data';
  IF v_data IS NULL THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'Event data payload is missing.'
    WHERE event_hash = p_event_hash;
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'Event data payload is missing.');
  END IF;

  v_stop := COALESCE(v_data->'stop', v_data->'unassignedStop', v_data);

  v_booking_id := trim(COALESCE(
    v_stop->'orderInfo'->>'sellerOrderId',
    v_data->'orderInfo'->>'sellerOrderId',
    v_data->>'sellerOrderId'
  ));

  v_external_id := COALESCE(
    v_stop->'recipient'->>'externalId',
    v_data->'recipient'->>'externalId',
    v_data->>'externalId'
  );

  v_activity := LOWER(COALESCE(v_stop->>'activity', v_data->>'activity'));
  v_stop_id := COALESCE(v_stop->>'id', v_data->>'stopId', v_data->>'id');
  v_tracking_link := COALESCE(
    v_stop->>'trackingLink',
    v_stop->>'trackingUrl',
    v_data->>'trackingLink',
    v_data->>'trackingUrl'
  );

  v_delivery_info := v_stop->'deliveryInfo';
  IF v_delivery_info IS NOT NULL THEN
    -- Strict boolean parsing: genuine JSON boolean ONLY.
    -- Strings such as "true"/"false", numbers, objects, arrays, and other malformed values set NULL.
    IF jsonb_typeof(v_delivery_info->'succeeded') = 'boolean' THEN
      v_delivery_succeeded := (v_delivery_info->>'succeeded')::boolean;
    ELSE
      v_delivery_succeeded := NULL;
    END IF;
    v_delivery_state := v_delivery_info->>'state';
  END IF;

  -- Validate HTTPS tracking URL
  IF v_tracking_link IS NOT NULL AND v_tracking_link ~* '^https://[^\s$.?#].[^\s]*$' THEN
    v_clean_tracking_url := v_tracking_link;
  ELSE
    v_clean_tracking_url := NULL;
  END IF;

  -- Validate correlation identifiers: presence
  IF v_booking_id IS NULL OR v_booking_id = '' THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'Missing sellerOrderId in event payload.'
    WHERE event_hash = p_event_hash;
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'Missing sellerOrderId in event payload.');
  END IF;

  -- Lock and query authoritative booking using text booking ID
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'No matching booking found for sellerOrderId.'
    WHERE event_hash = p_event_hash;
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'No matching booking found for sellerOrderId.');
  END IF;

  -- Verify company identity when both are present using explicit compatible types
  IF v_external_id IS NOT NULL AND trim(v_external_id) != '' AND
     v_booking.company_id IS NOT NULL AND trim(v_booking.company_id) != '' AND
     trim(v_external_id)::text != trim(v_booking.company_id)::text THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'Company identifier mismatch between externalId and booking.'
    WHERE event_hash = p_event_hash;
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'Company identifier mismatch.');
  END IF;

  -- Validate activity
  IF v_activity IS NULL OR v_activity NOT IN ('pickup', 'delivery') THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'Missing or invalid stop activity (must be pickup or delivery).'
    WHERE event_hash = p_event_hash;
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'Missing or invalid stop activity.');
  END IF;

  -- Lock and query existing per-stop state using text booking ID
  SELECT * INTO v_existing_stop
  FROM public.spoke_booking_stop_state
  WHERE booking_id = v_booking_id AND activity = v_activity
  FOR UPDATE;

  -- Check for out-of-order event
  IF FOUND AND v_existing_stop.latest_event_created_at > v_created_at THEN
    UPDATE public.spoke_webhook_events
    SET processing_status = 'ignored',
        processed_at = now(),
        processing_error = 'Out-of-order event superseded by newer event.'
    WHERE event_hash = p_event_hash;
    RETURN jsonb_build_object('status', 'ignored', 'reason', 'Out-of-order event superseded by newer event.');
  END IF;

  -- Upsert per-stop state using text booking ID
  INSERT INTO public.spoke_booking_stop_state (
    booking_id,
    company_id,
    activity,
    spoke_stop_id,
    tracking_url,
    delivery_state,
    delivery_succeeded,
    latest_event_type,
    latest_event_created_at,
    created_at,
    updated_at
  ) VALUES (
    v_booking_id,
    v_booking.company_id,
    v_activity,
    v_stop_id,
    v_clean_tracking_url,
    COALESCE(v_delivery_state, v_type),
    v_delivery_succeeded,
    v_type,
    v_created_at,
    now(),
    now()
  )
  ON CONFLICT (booking_id, activity) DO UPDATE SET
    spoke_stop_id = COALESCE(EXCLUDED.spoke_stop_id, public.spoke_booking_stop_state.spoke_stop_id),
    tracking_url = COALESCE(EXCLUDED.tracking_url, public.spoke_booking_stop_state.tracking_url),
    delivery_state = COALESCE(EXCLUDED.delivery_state, public.spoke_booking_stop_state.delivery_state),
    delivery_succeeded = COALESCE(EXCLUDED.delivery_succeeded, public.spoke_booking_stop_state.delivery_succeeded),
    latest_event_type = EXCLUDED.latest_event_type,
    latest_event_created_at = EXCLUDED.latest_event_created_at,
    updated_at = now();

  -- Calculate safe booking updates
  v_new_status := v_booking.status;
  v_new_progress := v_booking.progress_t;

  -- Never regress a terminal 'Delivered' status
  IF v_booking.status != 'Delivered' THEN
    -- Mark Delivered ONLY when delivery activity establishes deliveryInfo.succeeded = true
    IF v_activity = 'delivery' AND v_delivery_succeeded IS TRUE THEN
      v_new_status := 'Delivered';
      v_new_progress := 1.00;
    -- stop.out_for_delivery: in transit
    ELSIF v_type = 'stop.out_for_delivery' THEN
      IF v_new_status = 'Scheduled' THEN
        v_new_status := 'In transit';
      END IF;
      v_new_progress := GREATEST(COALESCE(v_new_progress, 0.45), 0.45);
    -- stop.next_in_route: vehicle approaching
    ELSIF v_type = 'stop.next_in_route' THEN
      IF v_new_status = 'Scheduled' THEN
        v_new_status := 'In transit';
      END IF;
      IF v_activity = 'delivery' THEN
        v_new_progress := GREATEST(COALESCE(v_new_progress, 0.45), 0.75);
      END IF;
    -- stop.departed: if pickup stop departed, advance from Scheduled to In transit
    ELSIF v_type = 'stop.departed' AND v_activity = 'pickup' THEN
      IF v_new_status = 'Scheduled' THEN
        v_new_status := 'In transit';
      END IF;
      v_new_progress := GREATEST(COALESCE(v_new_progress, 0.45), 0.45);
    END IF;
  END IF;

  -- Update bookings table with customer-safe fields using text booking ID
  UPDATE public.bookings
  SET status = v_new_status,
      progress_t = v_new_progress,
      pickup_tracking_url = CASE
        WHEN v_activity = 'pickup' AND v_clean_tracking_url IS NOT NULL THEN v_clean_tracking_url
        ELSE pickup_tracking_url
      END,
      delivery_tracking_url = CASE
        WHEN v_activity = 'delivery' AND v_clean_tracking_url IS NOT NULL THEN v_clean_tracking_url
        ELSE delivery_tracking_url
      END
  WHERE id = v_booking_id;

  -- Mark inbox event as processed
  UPDATE public.spoke_webhook_events
  SET processing_status = 'processed',
      processed_at = now(),
      processing_error = NULL
  WHERE event_hash = p_event_hash;

  RETURN jsonb_build_object(
    'status', 'processed',
    'booking_id', v_booking_id,
    'activity', v_activity,
    'booking_status', v_new_status,
    'progress_t', v_new_progress
  );
END;
$$;

-- Grant execution strictly to service_role
REVOKE EXECUTE ON FUNCTION public.process_spoke_webhook_event(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_spoke_webhook_event(text) TO service_role;
