# AMC Desk

AMC Desk is a multi-tenant service-operations app built with Next.js, Supabase Auth, and Postgres. Customer and operational records are loaded from Supabase; the application does not include browser-side demo records or a local-data fallback.

## Run locally

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). Rerun this file after schema updates; it adds business contact fields and replaces the workspace RLS policies.
   If workspace creation still reports an RLS violation, run [`supabase/fix-workspace-rls.sql`](./supabase/fix-workspace-rls.sql) separately. It removes every old tenant/membership policy by name and recreates only the authenticated workspace policies.
3. Copy `.env.example` to `.env.local` and set your Supabase project URL and publishable key:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

4. In Supabase Authentication, configure the allowed sign-in methods, email confirmation, and redirect URLs for your local and production app URLs.
5. Install and start the app:

   ```bash
   npm install
   npm run dev
   ```

After signing up, create a workspace directly from the app. A user can access additional workspaces only through a membership row.

## Backend included

- Tenant and membership tables; membership-based row-level security on operational data.
- Composite foreign keys that prevent records from referencing another tenant's customer, purifier, technician, or job.
- Customer, purifier, technician, service job, AMC, inventory, invoice, catalog, WhatsApp message, notification-rule, inventory transaction, and service-reading tables.
- Direct table operations for workspace creation, membership assignment, customer creation, job booking, status updates, and dashboard totals.
- Tenant-first indexes and paginated customer/job tables in the UI.
- The selected workspace, page, and color theme persist across refreshes in the current browser tab. Dashboard and report summaries use a short-lived session cache with background refresh; customer and service records are not cached in browser storage.

The UI supports creating customers, service jobs, AMC contracts, technicians, stock items, catalog items, invoices, and notification rules, plus service-job status updates. Reports can graph customer growth, job volume/status, AMC contract end dates, and paid revenue as interactive 2D bar, line, pie, and donut charts, plus 3D columns and trends.

## Meta WhatsApp Cloud API

The WhatsApp inbox sends one-to-one text messages through Meta's Cloud API. Sending is restricted to opted-in customers who messaged the configured business number within the previous 24 hours; bulk sends and template messages are not enabled.

1. In the [Meta for Developers](https://developers.facebook.com/) dashboard, create or select a Business app, add the WhatsApp product, and open **WhatsApp > API Setup**:
   - Copy the **Temporary access token** to `META_WHATSAPP_ACCESS_TOKEN` for initial testing. For production, create a System User token in Meta Business Settings with the required WhatsApp permissions and use that instead.
   - Copy the registered sender's **Phone number ID** (not the displayed phone number) to `META_WHATSAPP_PHONE_NUMBER_ID`.
   - In **App settings > Basic**, copy the **App secret** to `META_WHATSAPP_APP_SECRET`.
   - Set `META_WHATSAPP_VERIFY_TOKEN` to a random secret string you generate; enter the same string when configuring the webhook in Meta.
   - Set `META_GRAPH_API_VERSION` to a currently supported Graph API version shown in Meta's documentation.
   - `META_WHATSAPP_TENANT_ID` is the AMC Desk workspace UUID, not a Meta ID. Find it with `select id, name from public.tenants;`.
2. In your Supabase project's **Project Settings > API**, copy the **service_role** key to `SUPABASE_SERVICE_ROLE_KEY`. It is only for the server-side webhook; never expose or commit it.
3. Configure the Meta webhook callback URL as `https://YOUR_APP_HOST/api/whatsapp/webhook`, enter the same value as `META_WHATSAPP_VERIFY_TOKEN`, and subscribe to the `messages` field. Meta's webhook signature is checked against `META_WHATSAPP_APP_SECRET`.
4. Rerun [`supabase/schema.sql`](./supabase/schema.sql) to add WhatsApp consent and normalized phone-number fields. New customers are not opted in by default. Record consent only after the customer explicitly agrees. Use full international numbers for non-Indian customers; 10-digit Indian numbers are normalized with country code `+91`.

Inbound webhook messages are matched by normalized phone number and stored in the workspace inbox. Unmatched or ambiguous numbers are ignored. The 24-hour reply window is checked on the server immediately before sending. Meta credentials are never sent to the browser.

## Deployment and scale

The schema and UI are tenant-scoped and use indexed, bounded queries to support growth beyond 1,000 customers and thousands of authenticated users. Capacity for 10,000 users depends on the selected Supabase compute, connection, and Auth limits; load-test with expected concurrency and upgrade/tune the project as needed. Do not expose a Supabase service-role key in the browser. The app uses only the publishable/anon key, with RLS as the data boundary.

The SQL file creates no seed data and does not delete existing database rows. If the earlier demo schema was already applied, review any old demo tenant and records in Supabase before deciding whether to remove them.
For an existing tenant, add membership rows for its real users directly through the `tenant_memberships` table. The app and RLS policies enforce tenant membership and role access.
