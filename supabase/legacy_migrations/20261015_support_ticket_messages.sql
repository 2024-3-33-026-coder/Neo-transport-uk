-- ==============================================================================
-- NEO TRANSPORT SUPPORT TICKET MESSAGES / REPLIES MIGRATION
-- Migration Date: 2026-10-15
-- Description:
--   1. Creates support_ticket_messages table linking replies to support_tickets.
--   2. Enables Row-Level Security (RLS) with strict company isolation.
--   3. Guarantees authorized sender identification and prevents role/ID spoofing.
--   4. Grants necessary table permissions to authenticated users.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id TEXT PRIMARY KEY DEFAULT ('msg-' || substr(md5(random()::text), 1, 12)),
    ticket_id TEXT NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'customer')),
    message TEXT NOT NULL CHECK (length(trim(message)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance indexes for ticket thread retrieval & ordering
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id 
    ON public.support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_created_at 
    ON public.support_ticket_messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Trigger to guard against role spoofing & ensure sender_id matches authenticated user
CREATE OR REPLACE FUNCTION public.handle_ticket_message_insert_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically bind the authenticated user's ID
  IF auth.uid() IS NOT NULL THEN
    NEW.sender_id := auth.uid();
  END IF;

  -- Strictly set sender_role based on verified profile role, preventing spoofing
  IF public.is_admin() THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'customer';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_ticket_message_inserts ON public.support_ticket_messages;
CREATE TRIGGER trg_guard_ticket_message_inserts
  BEFORE INSERT ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_message_insert_guard();

-- 1. SELECT Policy:
-- Admins can view all messages. Customers can view messages ONLY for tickets belonging to their company.
DROP POLICY IF EXISTS "Users or admin view ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users or admin view ticket messages" ON public.support_ticket_messages
    FOR SELECT USING (
        public.is_admin() OR
        ticket_id IN (
            SELECT st.id FROM public.support_tickets st
            JOIN public.profiles p ON p.company_id = st.company_id
            WHERE p.id = auth.uid()
        )
    );

-- 2. INSERT Policy:
-- Admins can reply to any ticket. Customers can insert messages ONLY on tickets belonging to their company.
DROP POLICY IF EXISTS "Users or admin insert ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Users or admin insert ticket messages" ON public.support_ticket_messages
    FOR INSERT WITH CHECK (
        public.is_admin() OR
        ticket_id IN (
            SELECT st.id FROM public.support_tickets st
            JOIN public.profiles p ON p.company_id = st.company_id
            WHERE p.id = auth.uid()
        )
    );

-- 3. UPDATE & DELETE Policy: Admin only
DROP POLICY IF EXISTS "Admins manage ticket messages" ON public.support_ticket_messages;
CREATE POLICY "Admins manage ticket messages" ON public.support_ticket_messages
    FOR ALL USING (public.is_admin());

-- Grants
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
