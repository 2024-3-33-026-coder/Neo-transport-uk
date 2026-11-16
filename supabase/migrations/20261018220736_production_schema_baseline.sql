


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_audit_log_insert_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.admin_id := auth.uid();
  END IF;
  NEW.created_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_audit_log_insert_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profile_update_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Trusted backend calls use the service_role JWT. Keep this key server-side only.
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    -- Non-admin customers cannot change their role, company_id, id, email, or status
    NEW.role := OLD.role;
    NEW.company_id := OLD.company_id;
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.status := OLD.status;
  END IF;

  -- Prevent self-demotion or self-suspension by administrators
  IF auth.uid() = OLD.id THEN
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      RAISE EXCEPTION 'Administrators cannot demote their own account. Another administrator must perform this action.';
    END IF;
    IF OLD.status = 'active' AND NEW.status = 'suspended' THEN
      RAISE EXCEPTION 'Administrators cannot suspend their own account.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_profile_update_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_quote_update_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Trusted backend calls may update pricing/quote metadata after server-side authorization.
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    -- Customers cannot change price, company_id, pickup, dropoff, route, vehicle, service
    NEW.price_gbp := OLD.price_gbp;
    NEW.company_id := OLD.company_id;
    NEW.id := OLD.id;
    NEW.pickup := OLD.pickup;
    NEW.dropoff := OLD.dropoff;
    NEW.route := OLD.route;
    NEW.vehicle := OLD.vehicle;
    NEW.service := OLD.service;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_quote_update_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_ticket_message_insert_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Trusted server-side calls may provide validated sender fields; the key must never reach the browser.
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.sender_id := auth.uid();
  END IF;

  IF public.is_admin() THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'customer';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_ticket_message_insert_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_audit_log_modification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable. Modifications and deletions are strictly prohibited.';
END;
$$;


ALTER FUNCTION "public"."prevent_audit_log_modification"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "text" DEFAULT ('aud-'::"text" || "substr"("md5"(("random"())::"text"), 1, 14)) NOT NULL,
    "admin_id" "uuid",
    "admin_email" "text" NOT NULL,
    "admin_name" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target_entity" "text" NOT NULL,
    "target_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "text" NOT NULL,
    "company_id" "text",
    "date_label" "text" DEFAULT 'Today'::"text" NOT NULL,
    "pickup" "text" NOT NULL,
    "pickup_contact" "text" NOT NULL,
    "pickup_phone" "text" NOT NULL,
    "collection_window" "text" DEFAULT 'ASAP — ready now'::"text" NOT NULL,
    "dropoff" "text" NOT NULL,
    "recipient_name" "text" NOT NULL,
    "recipient_phone" "text" NOT NULL,
    "delivery_instructions" "text",
    "goods" "text" NOT NULL,
    "weight_kg" numeric(8,2) DEFAULT 0.00 NOT NULL,
    "items_count" integer DEFAULT 1 NOT NULL,
    "vehicle" "text" NOT NULL,
    "service" "text" NOT NULL,
    "distance_miles" numeric(8,2) DEFAULT 0.00 NOT NULL,
    "total_gbp" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "payment_method" "text" DEFAULT 'standby-account'::"text" NOT NULL,
    "po_reference" "text",
    "eta_label" "text" DEFAULT '88 min'::"text",
    "status" "text" DEFAULT 'In transit'::"text" NOT NULL,
    "driver_name" "text" DEFAULT 'Marek Kowalski'::"text",
    "driver_vehicle" "text" DEFAULT 'Sprinter LWB'::"text",
    "driver_reg" "text" DEFAULT 'GN71 XPO'::"text",
    "progress_t" numeric(4,2) DEFAULT 0.45,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['Scheduled'::"text", 'In transit'::"text", 'Delivered'::"text", 'Cancelled'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "text" DEFAULT ('comp-'::"text" || "substr"("md5"(("random"())::"text"), 1, 12)) NOT NULL,
    "name" "text" NOT NULL,
    "account_code" "text" DEFAULT ('NEO-SB-'::"text" || ("floor"((("random"() * (((9999 - 1000) + 1))::double precision) + (1000)::double precision)))::"text") NOT NULL,
    "standby_active" boolean DEFAULT true NOT NULL,
    "verified" boolean DEFAULT true NOT NULL,
    "monthly_spend" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "paid_ytd" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "next_statement_date" "text" DEFAULT '01 Sep'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "text" DEFAULT ('doc-'::"text" || "substr"("md5"(("random"())::"text"), 1, 10)) NOT NULL,
    "company_id" "text",
    "booking_id" "text",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "date_label" "text" NOT NULL,
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "text" NOT NULL,
    "company_id" "text",
    "date_label" "text" NOT NULL,
    "period_label" "text" NOT NULL,
    "amount_gbp" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'Paid'::"text" NOT NULL,
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['Paid'::"text", 'Due'::"text", 'Overdue'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "company_id" "text",
    "full_name" "text" NOT NULL,
    "initials" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'customer'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "text" NOT NULL,
    "company_id" "text",
    "pickup" "text" NOT NULL,
    "dropoff" "text" NOT NULL,
    "route" "text" NOT NULL,
    "vehicle" "text" NOT NULL,
    "service" "text" NOT NULL,
    "price_gbp" numeric(10,2) NOT NULL,
    "expires_label" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "quotes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'accepted'::"text", 'discarded'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spoke_smoke_test_claims" (
    "id" "text" DEFAULT ('claim-'::"text" || "substr"("md5"(("random"())::"text"), 1, 16)) NOT NULL,
    "test_run_token" "text" NOT NULL,
    "status" "text" NOT NULL,
    "admin_id" "uuid",
    "admin_email" "text" NOT NULL,
    "admin_name" "text" NOT NULL,
    "plan_id" "text",
    "plan_title" "text",
    "plan_date" "text",
    "stops_count" integer DEFAULT 0,
    "synthetic_pickup" "text",
    "synthetic_dropoff" "text",
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "spoke_smoke_test_claims_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'succeeded'::"text", 'failed_unknown'::"text", 'cleaned_up'::"text"])))
);


ALTER TABLE "public"."spoke_smoke_test_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."standby_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "trading_name" "text",
    "dispatch_address" "text" NOT NULL,
    "town_city" "text" NOT NULL,
    "postcode" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "job_title" "text" NOT NULL,
    "driver_mobile" "text" NOT NULL,
    "ops_email" "text" NOT NULL,
    "accounts_email" "text" NOT NULL,
    "emergency_line" "text" NOT NULL,
    "selected_carriers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "volume" "text" DEFAULT '5-15 loads/month'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "account_code" "text" DEFAULT ('NEO-SB-'::"text" || ("floor"((("random"() * (((9999 - 1000) + 1))::double precision) + (1000)::double precision)))::"text"),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "standby_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."standby_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_messages" (
    "id" "text" DEFAULT ('msg-'::"text" || "substr"("md5"(("random"())::"text"), 1, 12)) NOT NULL,
    "ticket_id" "text" NOT NULL,
    "sender_id" "uuid",
    "sender_name" "text" NOT NULL,
    "sender_role" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "support_ticket_messages_message_check" CHECK (("length"(TRIM(BOTH FROM "message")) > 0)),
    CONSTRAINT "support_ticket_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['admin'::"text", 'customer'::"text"])))
);


ALTER TABLE "public"."support_ticket_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "text" DEFAULT ('SR-'::"text" || ("floor"((("random"() * (((9999 - 1000) + 1))::double precision) + (1000)::double precision)))::"text") NOT NULL,
    "company_id" "text",
    "topic" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'Open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['Open'::"text", 'In Progress'::"text", 'Resolved'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_account_code_key" UNIQUE ("account_code");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spoke_smoke_test_claims"
    ADD CONSTRAINT "spoke_smoke_test_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spoke_smoke_test_claims"
    ADD CONSTRAINT "spoke_smoke_test_claims_test_run_token_key" UNIQUE ("test_run_token");



ALTER TABLE ONLY "public"."standby_applications"
    ADD CONSTRAINT "standby_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_audit_logs_action" ON "public"."admin_audit_logs" USING "btree" ("action");



CREATE INDEX "idx_admin_audit_logs_created_at" ON "public"."admin_audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_admin_audit_logs_target" ON "public"."admin_audit_logs" USING "btree" ("target_entity", "target_id");



CREATE INDEX "idx_bookings_company_id" ON "public"."bookings" USING "btree" ("company_id");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_documents_booking_id" ON "public"."documents" USING "btree" ("booking_id");



CREATE INDEX "idx_documents_company_id" ON "public"."documents" USING "btree" ("company_id");



CREATE INDEX "idx_invoices_company_id" ON "public"."invoices" USING "btree" ("company_id");



CREATE INDEX "idx_profiles_company_id" ON "public"."profiles" USING "btree" ("company_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("status");



CREATE INDEX "idx_quotes_company_id" ON "public"."quotes" USING "btree" ("company_id");



CREATE INDEX "idx_spoke_smoke_claims_status" ON "public"."spoke_smoke_test_claims" USING "btree" ("status");



CREATE INDEX "idx_spoke_smoke_claims_token" ON "public"."spoke_smoke_test_claims" USING "btree" ("test_run_token");



CREATE INDEX "idx_standby_applications_status" ON "public"."standby_applications" USING "btree" ("status");



CREATE INDEX "idx_support_ticket_messages_created_at" ON "public"."support_ticket_messages" USING "btree" ("created_at");



CREATE INDEX "idx_support_ticket_messages_ticket_id" ON "public"."support_ticket_messages" USING "btree" ("ticket_id");



CREATE INDEX "idx_support_tickets_company_id" ON "public"."support_tickets" USING "btree" ("company_id");



CREATE OR REPLACE TRIGGER "trg_guard_audit_log_inserts" BEFORE INSERT ON "public"."admin_audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_log_insert_guard"();



CREATE OR REPLACE TRIGGER "trg_guard_profile_updates" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_profile_update_guard"();



CREATE OR REPLACE TRIGGER "trg_guard_quote_updates" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_quote_update_guard"();



CREATE OR REPLACE TRIGGER "trg_guard_ticket_message_inserts" BEFORE INSERT ON "public"."support_ticket_messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_ticket_message_insert_guard"();



CREATE OR REPLACE TRIGGER "trg_prevent_audit_log_tamper" BEFORE DELETE OR UPDATE ON "public"."admin_audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_log_modification"();



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spoke_smoke_test_claims"
    ADD CONSTRAINT "spoke_smoke_test_claims_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



CREATE POLICY "Admin users can insert smoke test claims" ON "public"."spoke_smoke_test_claims" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin users can select smoke test claims" ON "public"."spoke_smoke_test_claims" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin users can update smoke test claims" ON "public"."spoke_smoke_test_claims" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins delete bookings" ON "public"."bookings" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins delete standby applications" ON "public"."standby_applications" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admins insert audit logs" ON "public"."admin_audit_logs" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage companies" ON "public"."companies" USING ("public"."is_admin"());



CREATE POLICY "Admins manage documents" ON "public"."documents" USING ("public"."is_admin"());



CREATE POLICY "Admins manage invoices" ON "public"."invoices" USING ("public"."is_admin"());



CREATE POLICY "Admins manage profiles" ON "public"."profiles" USING ("public"."is_admin"());



CREATE POLICY "Admins manage quotes" ON "public"."quotes" USING ("public"."is_admin"());



CREATE POLICY "Admins manage ticket messages" ON "public"."support_ticket_messages" USING ("public"."is_admin"());



CREATE POLICY "Admins manage tickets" ON "public"."support_tickets" USING ("public"."is_admin"());



CREATE POLICY "Admins update bookings" ON "public"."bookings" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins update standby applications" ON "public"."standby_applications" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Admins view audit logs" ON "public"."admin_audit_logs" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins view standby applications" ON "public"."standby_applications" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Public can submit standby applications" ON "public"."standby_applications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users or admin delete quotes" ON "public"."quotes" FOR DELETE USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin insert bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin insert documents" ON "public"."documents" FOR INSERT WITH CHECK (("public"."is_admin"() OR (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND (("file_url" IS NULL) OR ("file_url" ~~ ("company_id" || '/%'::"text"))))));



CREATE POLICY "Users or admin insert quotes" ON "public"."quotes" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin insert ticket messages" ON "public"."support_ticket_messages" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("ticket_id" IN ( SELECT "st"."id"
   FROM ("public"."support_tickets" "st"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "st"."company_id")))
  WHERE ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin insert tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("public"."is_admin"() OR (("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) AND ("status" = 'Open'::"text"))));



CREATE POLICY "Users or admin update quotes" ON "public"."quotes" FOR UPDATE USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view bookings" ON "public"."bookings" FOR SELECT USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view companies" ON "public"."companies" FOR SELECT USING (("public"."is_admin"() OR ("id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view documents" ON "public"."documents" FOR SELECT USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view invoices" ON "public"."invoices" FOR SELECT USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view profiles" ON "public"."profiles" FOR SELECT USING (("public"."is_admin"() OR ("id" = "auth"."uid"())));



CREATE POLICY "Users or admin view quotes" ON "public"."quotes" FOR SELECT USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view ticket messages" ON "public"."support_ticket_messages" FOR SELECT USING (("public"."is_admin"() OR ("ticket_id" IN ( SELECT "st"."id"
   FROM ("public"."support_tickets" "st"
     JOIN "public"."profiles" "p" ON (("p"."company_id" = "st"."company_id")))
  WHERE ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users or admin view tickets" ON "public"."support_tickets" FOR SELECT USING (("public"."is_admin"() OR ("company_id" IN ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE USING (("public"."is_admin"() OR ("id" = "auth"."uid"()))) WITH CHECK (("public"."is_admin"() OR (("id" = "auth"."uid"()) AND ("role" = 'customer'::"text"))));



ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spoke_smoke_test_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."standby_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_ticket_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_audit_log_insert_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_audit_log_insert_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_audit_log_insert_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_profile_update_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_profile_update_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_profile_update_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_quote_update_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_quote_update_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_quote_update_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_ticket_message_insert_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_ticket_message_insert_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_ticket_message_insert_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."spoke_smoke_test_claims" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."spoke_smoke_test_claims" TO "authenticated";



GRANT ALL ON TABLE "public"."standby_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."standby_applications" TO "service_role";
GRANT INSERT ON TABLE "public"."standby_applications" TO "anon";



GRANT ALL ON TABLE "public"."support_ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke delete on table "public"."admin_audit_logs" from "anon";

revoke insert on table "public"."admin_audit_logs" from "anon";

revoke references on table "public"."admin_audit_logs" from "anon";

revoke select on table "public"."admin_audit_logs" from "anon";

revoke trigger on table "public"."admin_audit_logs" from "anon";

revoke truncate on table "public"."admin_audit_logs" from "anon";

revoke update on table "public"."admin_audit_logs" from "anon";

revoke delete on table "public"."bookings" from "anon";

revoke insert on table "public"."bookings" from "anon";

revoke references on table "public"."bookings" from "anon";

revoke select on table "public"."bookings" from "anon";

revoke trigger on table "public"."bookings" from "anon";

revoke truncate on table "public"."bookings" from "anon";

revoke update on table "public"."bookings" from "anon";

revoke delete on table "public"."companies" from "anon";

revoke insert on table "public"."companies" from "anon";

revoke references on table "public"."companies" from "anon";

revoke select on table "public"."companies" from "anon";

revoke trigger on table "public"."companies" from "anon";

revoke truncate on table "public"."companies" from "anon";

revoke update on table "public"."companies" from "anon";

revoke delete on table "public"."documents" from "anon";

revoke insert on table "public"."documents" from "anon";

revoke references on table "public"."documents" from "anon";

revoke select on table "public"."documents" from "anon";

revoke trigger on table "public"."documents" from "anon";

revoke truncate on table "public"."documents" from "anon";

revoke update on table "public"."documents" from "anon";

revoke delete on table "public"."invoices" from "anon";

revoke insert on table "public"."invoices" from "anon";

revoke references on table "public"."invoices" from "anon";

revoke select on table "public"."invoices" from "anon";

revoke trigger on table "public"."invoices" from "anon";

revoke truncate on table "public"."invoices" from "anon";

revoke update on table "public"."invoices" from "anon";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."quotes" from "anon";

revoke insert on table "public"."quotes" from "anon";

revoke references on table "public"."quotes" from "anon";

revoke select on table "public"."quotes" from "anon";

revoke trigger on table "public"."quotes" from "anon";

revoke truncate on table "public"."quotes" from "anon";

revoke update on table "public"."quotes" from "anon";

revoke delete on table "public"."spoke_smoke_test_claims" from "anon";

revoke insert on table "public"."spoke_smoke_test_claims" from "anon";

revoke references on table "public"."spoke_smoke_test_claims" from "anon";

revoke select on table "public"."spoke_smoke_test_claims" from "anon";

revoke trigger on table "public"."spoke_smoke_test_claims" from "anon";

revoke truncate on table "public"."spoke_smoke_test_claims" from "anon";

revoke update on table "public"."spoke_smoke_test_claims" from "anon";

revoke delete on table "public"."spoke_smoke_test_claims" from "authenticated";

revoke references on table "public"."spoke_smoke_test_claims" from "authenticated";

revoke trigger on table "public"."spoke_smoke_test_claims" from "authenticated";

revoke truncate on table "public"."spoke_smoke_test_claims" from "authenticated";

revoke delete on table "public"."standby_applications" from "anon";

revoke references on table "public"."standby_applications" from "anon";

revoke select on table "public"."standby_applications" from "anon";

revoke trigger on table "public"."standby_applications" from "anon";

revoke truncate on table "public"."standby_applications" from "anon";

revoke update on table "public"."standby_applications" from "anon";

revoke delete on table "public"."support_ticket_messages" from "anon";

revoke insert on table "public"."support_ticket_messages" from "anon";

revoke references on table "public"."support_ticket_messages" from "anon";

revoke select on table "public"."support_ticket_messages" from "anon";

revoke trigger on table "public"."support_ticket_messages" from "anon";

revoke truncate on table "public"."support_ticket_messages" from "anon";

revoke update on table "public"."support_ticket_messages" from "anon";

revoke delete on table "public"."support_tickets" from "anon";

revoke insert on table "public"."support_tickets" from "anon";

revoke references on table "public"."support_tickets" from "anon";

revoke select on table "public"."support_tickets" from "anon";

revoke trigger on table "public"."support_tickets" from "anon";

revoke truncate on table "public"."support_tickets" from "anon";

revoke update on table "public"."support_tickets" from "anon";
