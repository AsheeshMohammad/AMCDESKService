# AMC Desk

AMC Desk is a multi-tenant service-operations app built with Next.js, Supabase Auth, and Postgres. Customer and operational records are loaded from Supabase; the application does not include browser-side demo records or a local-data fallback.

## Run locally

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). Rerun this file after schema updates; it replaces the workspace RLS policies.
   If workspace creation still reports an RLS violation, run [`supabase/fix-workspace-rls.sql`](./supabase/fix-workspace-rls.sql) separately. It removes every old tenant/membership policy by name and recreates only the authenticated workspace policies.
3. Copy `.env.example` to `.env.local` and set:

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

The UI supports creating customers, service jobs, AMC contracts, technicians, stock items, catalog items, invoices, and notification rules, plus service-job status updates. All other lists are tenant-scoped live Supabase views. WhatsApp delivery and payment collection require provider integrations and are intentionally not simulated.

## Deployment and scale

The schema and UI are tenant-scoped and use indexed, bounded queries to support growth beyond 1,000 customers and thousands of authenticated users. Capacity for 10,000 users depends on the selected Supabase compute, connection, and Auth limits; load-test with expected concurrency and upgrade/tune the project as needed. Do not expose a Supabase service-role key in the browser. The app uses only the publishable/anon key, with RLS as the data boundary.

The SQL file creates no seed data and does not delete existing database rows. If the earlier demo schema was already applied, review any old demo tenant and records in Supabase before deciding whether to remove them.
For an existing tenant, add membership rows for its real users directly through the `tenant_memberships` table. The app and RLS policies enforce tenant membership and role access.
