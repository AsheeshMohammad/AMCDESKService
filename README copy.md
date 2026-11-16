# RO Renewal PRO

A responsive, dark-mode operations dashboard for RO dealers. The demo is a Next.js App Router application with local seed data and browser-only interactions. It does not connect to a backend or require Supabase credentials.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `/super-admin` to manage the demo dealer workspaces; tenant edits persist in browser local storage. Tenant selection resolves against a hostname or a first-segment URL slug, and otherwise falls back to **SR WATER SOLUTIONS**.

## Included

- Fourteen workspace areas, searchable customer data, job board, chat inbox, reminder editor, calendar drag/drop, billing preview, and local tenant admin.
- Demo seed data in `lib/data.ts` for 17 customers, 5 technicians and 5 scheduled visits.
- `supabase/schema.sql` with tenant-scoped tables, RLS policies and SQL seed data, ready to apply when backend connectivity is introduced.

## Supabase later

Copy `.env.example` to `.env.local` and add a Supabase project URL and anon key when connecting a backend. The UI intentionally remains usable without those values.
