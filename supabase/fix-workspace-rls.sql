-- Temporary setup: remove RLS policies from workspace tables.
-- Run this in the Supabase SQL Editor. Policies can be added later.

-- Remove every policy currently attached to tenants.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
  loop
    execute format(
      'drop policy if exists %I on public.tenants',
      policy_row.policyname
    );
  end loop;
end
$$;

-- Remove every policy currently attached to tenant_memberships.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_memberships'
  loop
    execute format(
      'drop policy if exists %I on public.tenant_memberships',
      policy_row.policyname
    );
  end loop;
end
$$;

-- RLS is disabled until policies are configured.
alter table public.tenants disable row level security;
alter table public.tenant_memberships disable row level security;

-- Allow only authenticated frontend/API users to reach these tables.
revoke all on table public.tenants from anon;
revoke all on table public.tenant_memberships from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.tenants to authenticated;
grant select, insert, update, delete on table public.tenant_memberships to authenticated;

-- Verification: both policy queries should return no rows.
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('tenants', 'tenant_memberships');
