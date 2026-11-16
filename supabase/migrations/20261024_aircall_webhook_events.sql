-- Migration: 20261024_aircall_webhook_events.sql
-- Durable persistence for inbound Aircall telephony events and webhooks

CREATE TABLE IF NOT EXISTS public.aircall_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    event_hash TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    call_id BIGINT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_aircall_events_call_id ON public.aircall_webhook_events(call_id);
CREATE INDEX IF NOT EXISTS idx_aircall_events_type ON public.aircall_webhook_events(event_type);

ALTER TABLE public.aircall_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages aircall events"
    ON public.aircall_webhook_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Admins read-only access for diagnostics
CREATE POLICY "Admins read aircall events"
    ON public.aircall_webhook_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
