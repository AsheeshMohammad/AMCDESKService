-- AMC Desk direct-table Supabase schema.
-- This file creates no demo records and contains no stored procedures.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  city text not null default '',
  custom_domain text unique,
  slug text not null unique,
  logo_url text,
  gstin text,
  upi_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'manager', 'technician', 'accountant')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_code text not null,
  full_name text not null,
  phone text not null,
  whatsapp_phone_e164 text,
  whatsapp_opt_in boolean not null default false,
  email text,
  address text,
  area text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, customer_code)
);

alter table public.customers
  add column if not exists whatsapp_phone_e164 text,
  add column if not exists whatsapp_opt_in boolean not null default false;

update public.customers as customer
set whatsapp_phone_e164 = case
  when left(customer.phone, 1) = '+'
    and length(normalized.digits) between 8 and 15 then '+' || normalized.digits
  when left(customer.phone, 2) = '00'
    and length(normalized.digits) between 10 and 17 then '+' || substr(normalized.digits, 3)
  when length(normalized.digits) = 10 then '+91' || normalized.digits
  when length(normalized.digits) = 11 and left(normalized.digits, 1) = '0'
    then '+91' || substr(normalized.digits, 2)
  when length(normalized.digits) between 11 and 15 then '+' || normalized.digits
  else null
end
from (
  select id, regexp_replace(phone, '[^0-9]', '', 'g') as digits
  from public.customers
) as normalized
where customer.id = normalized.id
  and customer.whatsapp_phone_e164 is null;

create table if not exists public.purifier_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  model text not null,
  serial_number text not null,
  installed_at date,
  input_tds integer check (input_tds is null or input_tds >= 0),
  output_tds integer check (output_tds is null or output_tds >= 0),
  next_filter_due date,
  filter_lifecycle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, serial_number)
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  phone text,
  area text,
  pin_code text,
  is_active boolean not null default true,
  van_stock jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  purifier_unit_id uuid,
  technician_id uuid,
  job_number text not null,
  service_type text not null check (service_type in ('Installation', 'Routine Filter Change', 'Breakdown Repair', 'AMC Visit')),
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Technician En Route', 'In Progress', 'Completed', 'Cancelled')),
  scheduled_at timestamptz not null,
  input_tds integer check (input_tds is null or input_tds >= 0),
  output_tds integer check (output_tds is null or output_tds >= 0),
  spare_parts jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, job_number)
);

create table if not exists public.amc_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  purifier_unit_id uuid,
  contract_number text not null,
  tier text not null check (tier in ('Basic', 'Comprehensive', 'Gold')),
  starts_on date not null,
  ends_on date not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'Active' check (status in ('Active', 'Expiring soon', 'Expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, contract_number),
  check (ends_on >= starts_on)
);

create table if not exists public.inventory_spares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  unit text not null default 'pcs',
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  spare_id uuid not null,
  service_job_id uuid,
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ro_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text not null,
  mrp numeric(12,2) not null default 0 check (mrp >= 0),
  dealer_price numeric(12,2) not null default 0 check (dealer_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  invoice_number text not null,
  description text not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  gst_amount numeric(12,2) not null default 0 check (gst_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'Pending' check (status in ('Paid', 'Pending', 'Overdue', 'Cancelled')),
  issued_at date not null default current_date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  sent_at timestamptz not null default now(),
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  external_message_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, external_message_id)
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'sms', 'in_app')),
  trigger_type text not null,
  is_enabled boolean not null default false,
  message_template text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.service_readings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  purifier_unit_id uuid,
  service_job_id uuid,
  input_tds integer not null check (input_tds >= 0),
  output_tds integer not null check (output_tds >= 0),
  notes text,
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists customers_tenant_id_id_uq on public.customers (tenant_id, id);
create unique index if not exists purifier_units_tenant_id_id_uq on public.purifier_units (tenant_id, id);
create unique index if not exists technicians_tenant_id_id_uq on public.technicians (tenant_id, id);
create unique index if not exists service_jobs_tenant_id_id_uq on public.service_jobs (tenant_id, id);
create unique index if not exists inventory_spares_tenant_id_id_uq on public.inventory_spares (tenant_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purifier_units_customer_tenant_fk') then
    alter table public.purifier_units add constraint purifier_units_customer_tenant_fk
      foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_jobs_customer_tenant_fk') then
    alter table public.service_jobs add constraint service_jobs_customer_tenant_fk
      foreign key (tenant_id, customer_id) references public.customers (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_jobs_technician_tenant_fk') then
    alter table public.service_jobs add constraint service_jobs_technician_tenant_fk
      foreign key (tenant_id, technician_id) references public.technicians (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'amc_contracts_customer_tenant_fk') then
    alter table public.amc_contracts add constraint amc_contracts_customer_tenant_fk
      foreign key (tenant_id, customer_id) references public.customers (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_customer_tenant_fk') then
    alter table public.invoices add constraint invoices_customer_tenant_fk
      foreign key (tenant_id, customer_id) references public.customers (tenant_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_messages_customer_tenant_fk') then
    alter table public.whatsapp_messages add constraint whatsapp_messages_customer_tenant_fk
      foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete cascade;
  end if;
end
$$;

create index if not exists customers_tenant_name_idx on public.customers (tenant_id, full_name, id);
create index if not exists customers_tenant_phone_idx on public.customers (tenant_id, phone);
create index if not exists customers_tenant_whatsapp_phone_idx on public.customers (tenant_id, whatsapp_phone_e164);
create index if not exists technicians_tenant_active_idx on public.technicians (tenant_id, is_active, full_name);
create index if not exists service_jobs_tenant_schedule_idx on public.service_jobs (tenant_id, scheduled_at desc, id);
create index if not exists service_jobs_tenant_status_idx on public.service_jobs (tenant_id, status, scheduled_at);
create index if not exists amc_contracts_tenant_end_idx on public.amc_contracts (tenant_id, ends_on, status);
create index if not exists inventory_spares_tenant_name_idx on public.inventory_spares (tenant_id, name);
create index if not exists invoices_tenant_issued_idx on public.invoices (tenant_id, issued_at desc, id);
create index if not exists whatsapp_messages_tenant_sent_idx on public.whatsapp_messages (tenant_id, sent_at desc, id);

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;

-- Replace policies left by an older schema or earlier app version.
drop policy if exists tenant_self_read on public.tenants;
drop policy if exists tenant_self_update on public.tenants;
drop policy if exists tenant_insert on public.tenants;
drop policy if exists tenant_isolation on public.tenants;
drop policy if exists tenant_read on public.tenants;
drop policy if exists tenant_create on public.tenants;
drop policy if exists tenant_update on public.tenants;

drop policy if exists tenant_self_read on public.tenant_memberships;
drop policy if exists tenant_isolation on public.tenant_memberships;
drop policy if exists membership_read on public.tenant_memberships;
drop policy if exists membership_create on public.tenant_memberships;
drop policy if exists membership_manage on public.tenant_memberships;
drop policy if exists membership_delete on public.tenant_memberships;

drop policy if exists tenant_read on public.tenants;
create policy tenant_read on public.tenants
  for select to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenants.id and m.user_id = auth.uid()
  ));

drop policy if exists tenant_create on public.tenants;
create policy tenant_create on public.tenants
  for insert to public
  with check ((select auth.uid()) is not null);

drop policy if exists tenant_update on public.tenants;
create policy tenant_update on public.tenants
  for update to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenants.id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'manager')
  ))
  with check (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenants.id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'manager')
  ));

drop policy if exists membership_read on public.tenant_memberships;
create policy membership_read on public.tenant_memberships
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists membership_create on public.tenant_memberships;
create policy membership_create on public.tenant_memberships
  for insert to public
  with check (user_id = auth.uid());

drop policy if exists membership_manage on public.tenant_memberships;
create policy membership_manage on public.tenant_memberships
  for update to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_memberships.tenant_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_memberships.tenant_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ));

drop policy if exists membership_delete on public.tenant_memberships;
create policy membership_delete on public.tenant_memberships
  for delete to authenticated
  using (exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_memberships.tenant_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ));

do $$
declare
  table_name text;
  table_names text[] := array[
    'customers', 'purifier_units', 'technicians', 'service_jobs', 'amc_contracts',
    'inventory_spares', 'inventory_transactions', 'ro_catalog', 'invoices',
    'whatsapp_messages', 'notification_rules', 'service_readings'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_read on public.%I', table_name);
    execute format(
      'create policy tenant_read on public.%I for select to authenticated using (exists (
        select 1 from public.tenant_memberships m
        where m.tenant_id = %I.tenant_id and m.user_id = auth.uid()
      ))',
      table_name, table_name
    );

    if table_name = 'service_jobs' then
      execute format('drop policy if exists tenant_insert on public.%I', table_name);
      execute format(
        'create policy tenant_insert on public.%I for insert to authenticated with check (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'')
        ))',
        table_name, table_name
      );
      execute format('drop policy if exists tenant_update on public.%I', table_name);
      execute format(
        'create policy tenant_update on public.%I for update to authenticated using (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'', ''technician'')
        )) with check (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'', ''technician'')
        ))',
        table_name, table_name, table_name
      );
      execute format('drop policy if exists tenant_delete on public.%I', table_name);
      execute format(
        'create policy tenant_delete on public.%I for delete to authenticated using (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'')
        ))',
        table_name, table_name
      );
    elsif table_name = 'invoices' then
      execute format('drop policy if exists tenant_write on public.%I', table_name);
      execute format(
        'create policy tenant_write on public.%I for all to authenticated using (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'', ''accountant'')
        )) with check (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'', ''accountant'')
        ))',
        table_name, table_name, table_name
      );
    elsif table_name = 'service_readings' then
      execute format('drop policy if exists tenant_write on public.%I', table_name);
      execute format(
        'create policy tenant_write on public.%I for all to authenticated using (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'', ''technician'')
        )) with check (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'', ''technician'')
        ))',
        table_name, table_name, table_name
      );
    else
      execute format('drop policy if exists tenant_write on public.%I', table_name);
      execute format(
        'create policy tenant_write on public.%I for all to authenticated using (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'')
        )) with check (exists (
          select 1 from public.tenant_memberships m
          where m.tenant_id = %I.tenant_id
            and m.user_id = auth.uid()
            and m.role in (''owner'', ''admin'', ''manager'')
        ))',
        table_name, table_name, table_name
      );
    end if;

    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end
$$;

grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.tenant_memberships to authenticated;
